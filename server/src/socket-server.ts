
import type { Server } from "socket.io";
import { prisma } from "./config/prisma";
import { validateSession } from "./services/session.service";
import { setSocketIO, emitToUser } from "./socket";

interface SocketServerDependencies {
  database?: typeof prisma;
  validateSession?: typeof validateSession;
}

export function configureSocketServer(
  io: Server,
  dependencies: SocketServerDependencies = {},
): void {
  const database = dependencies.database ?? prisma;
  const validate = dependencies.validateSession ?? validateSession;

  setSocketIO(io);

  io.use(async (socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie;

      if (!cookieHeader) {
        return next(new Error("Authentication required"));
      }

      const sessionCookie = cookieHeader
        .split(";")
        .map((cookie) => cookie.trim())
        .find((cookie) => cookie.startsWith("session_token="));

      if (!sessionCookie) {
        return next(new Error("Authentication required"));
      }

      const token = sessionCookie.slice("session_token=".length);
      const userId = await validate(token);

      if (!userId) {
        return next(new Error("Invalid or expired session"));
      }

      socket.data.userId = userId;
      next();
    } catch (error) {
      console.error("Socket authentication failed:", error);
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string;

    socket.join(`user:${userId}`);

    socket.on("conversation:join", async (conversationId, callback) => {
      try {
        if (
          typeof conversationId !== "string" ||
          conversationId.trim().length === 0
        ) {
          callback?.({
            ok: false,
            error: "conversationId is required",
          });
          return;
        }

        const conversation = await database.conversation.findFirst({
          where: {
            id: conversationId,
            members: {
              some: { userId },
            },
          },
          select: { id: true },
        });

        if (!conversation) {
          callback?.({
            ok: false,
            error: "Conversation not found",
          });
          return;
        }

        socket.join(`conversation:${conversationId}`);

        const incomingMessages = await database.message.findMany({
          where: {
            conversationId,
            senderId: { not: userId },
          },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            senderId: true,
            createdAt: true,
          },
        });

        for (const message of incomingMessages) {
          emitToUser(message.senderId, "message_status", {
            messageId: message.id,
            status: "delivered",
          });
        }

        const latestIncomingMessage =
          incomingMessages[incomingMessages.length - 1];

        if (latestIncomingMessage) {
          const currentMember =
            await database.conversationMember.findUnique({
              where: {
                conversationId_userId: {
                  conversationId,
                  userId,
                },
              },
              select: { lastReadMessageId: true },
            });

          let shouldAdvanceReadPointer = true;

          if (currentMember?.lastReadMessageId) {
            const currentReadMessage =
              await database.message.findFirst({
                where: {
                  id: currentMember.lastReadMessageId,
                  conversationId,
                },
                select: { createdAt: true },
              });

            shouldAdvanceReadPointer =
              !currentReadMessage ||
              currentReadMessage.createdAt.getTime() <
                latestIncomingMessage.createdAt.getTime();
          }

          if (shouldAdvanceReadPointer) {
            await database.conversationMember.update({
              where: {
                conversationId_userId: {
                  conversationId,
                  userId,
                },
              },
              data: {
                lastReadMessageId: latestIncomingMessage.id,
              },
            });
          }

          for (const message of incomingMessages) {
            emitToUser(message.senderId, "message_status", {
              messageId: message.id,
              status: "read",
            });
          }
        }

        callback?.({
          ok: true,
          conversationId,
        });
      } catch (error) {
        console.error("Conversation join failed:", error);

        callback?.({
          ok: false,
          error: "Unable to join conversation",
        });
      }
    });

    socket.on("conversation:leave", (conversationId, callback) => {
      if (
        typeof conversationId !== "string" ||
        conversationId.trim().length === 0
      ) {
        callback?.({
          ok: false,
          error: "conversationId is required",
        });
        return;
      }

      socket.leave(`conversation:${conversationId}`);

      callback?.({
        ok: true,
        conversationId,
      });
    });

    socket.on("message_read", async (conversationId, messageId, callback) => {
      try {
        if (
          typeof conversationId !== "string" ||
          conversationId.trim().length === 0
        ) {
          callback?.({
            ok: false,
            error: "conversationId is required",
          });
          return;
        }

        if (
          typeof messageId !== "string" ||
          messageId.trim().length === 0
        ) {
          callback?.({
            ok: false,
            error: "messageId is required",
          });
          return;
        }

        const conversation = await database.conversation.findFirst({
          where: {
            id: conversationId,
            members: {
              some: { userId },
            },
          },
          select: { id: true },
        });

        if (!conversation) {
          callback?.({
            ok: false,
            error: "Conversation not found",
          });
          return;
        }

        const message = await database.message.findFirst({
          where: {
            id: messageId,
            conversationId,
          },
          select: {
            id: true,
            senderId: true,
            createdAt: true,
          },
        });

        if (!message) {
          callback?.({
            ok: false,
            error: "Message not found",
          });
          return;
        }

        if (message.senderId !== userId) {
          const currentMember =
            await database.conversationMember.findUnique({
              where: {
                conversationId_userId: {
                  conversationId,
                  userId,
                },
              },
              select: { lastReadMessageId: true },
            });

          let shouldAdvanceReadPointer = true;

          if (currentMember?.lastReadMessageId) {
            const currentReadMessage =
              await database.message.findFirst({
                where: {
                  id: currentMember.lastReadMessageId,
                  conversationId,
                },
                select: { createdAt: true },
              });

            shouldAdvanceReadPointer =
              !currentReadMessage ||
              currentReadMessage.createdAt.getTime() <
                message.createdAt.getTime();
          }

          if (shouldAdvanceReadPointer) {
            await database.conversationMember.update({
              where: {
                conversationId_userId: {
                  conversationId,
                  userId,
                },
              },
              data: {
                lastReadMessageId: message.id,
              },
            });
          }

          emitToUser(message.senderId, "message_status", {
            messageId: message.id,
            status: "read",
          });
        }

        callback?.({
          ok: true,
          messageId,
        });
      } catch (error) {
        console.error("Message read failed:", error);

        callback?.({
          ok: false,
          error: "Unable to update message read state",
        });
      }
    });

    socket.on("disconnect", () => {
      // No presence/typing state is maintained by the server.
    });
  });
}
