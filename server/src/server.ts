import authRoutes from "./routes/auth.routes";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { prisma } from "./config/prisma";
import cookieParser from "cookie-parser";
import conversationRoutes from "./routes/conversation.routes";
import messageRoutes from "./routes/message.routes";
import messageRequestRoutes from "./routes/message-request.routes";
import { createServer } from "http";
import { Server } from "socket.io";
import { validateSession } from "./services/session.service";
import { setSocketIO, emitToUser } from "./socket";

dotenv.config();

const app = express();

const PORT = Number(process.env.PORT ?? 5000);
const HOST = process.env.HOST ?? "0.0.0.0";

const configuredCorsOrigins = (
  process.env.CORS_ORIGIN ?? "http://localhost:1204"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOrigin =
  configuredCorsOrigins.length === 1
    ? configuredCorsOrigins[0]
    : configuredCorsOrigins;

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api", messageRoutes);
app.use("/api/message-requests", messageRequestRoutes);

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "Chatter Box server is running",
  });
});

app.get("/api/health/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: "ok",
      database: "connected",
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    res.status(500).json({
      status: "error",
      database: "disconnected",
    });
  }
});

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: corsOrigin,
    credentials: true,
  },
});

setSocketIO(io);

/* ---------------- SOCKET AUTHENTICATION ---------------- */

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
    const userId = await validateSession(token);

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

/* ---------------- SOCKET CONNECTION ---------------- */

io.on("connection", (socket) => {
  const userId = socket.data.userId;

  /*
   * Every authenticated socket joins its private user room.
   * This lets message/status events reach the user even when
   * they are currently viewing another conversation.
   */
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

      const conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          members: {
            some: {
              userId,
            },
          },
        },
        select: {
          id: true,
        },
      });

      if (!conversation) {
        callback?.({
          ok: false,
          error: "Conversation not found",
        });
        return;
      }

      socket.join(`conversation:${conversationId}`);

      /*
       * Opening the conversation means incoming messages are now
       * delivered to this user. Notify each original sender directly.
       * Status is realtime-only in the current v1 schema.
       */
      const incomingMessages = await prisma.message.findMany({
        where: {
          conversationId,
          senderId: {
            not: userId,
          },
        },
        select: {
          id: true,
          senderId: true,
        },
      });

      for (const message of incomingMessages) {
        emitToUser(message.senderId, "message_status", {
          messageId: message.id,
          status: "delivered",
        });
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

      const conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          members: {
            some: {
              userId,
            },
          },
        },
        select: {
          id: true,
        },
      });

      if (!conversation) {
        callback?.({
          ok: false,
          error: "Conversation not found",
        });
        return;
      }

      const message = await prisma.message.findFirst({
        where: {
          id: messageId,
          conversationId,
        },
        select: {
          id: true,
          senderId: true,
        },
      });

      if (!message) {
        callback?.({
          ok: false,
          error: "Message not found",
        });
        return;
      }

      /* Only the original sender should receive the read status. */
      if (message.senderId !== userId) {
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

httpServer.listen(PORT, HOST, () => {
  console.log(
    `Chatter Box server running on http://${HOST}:${PORT}`,
  );
});