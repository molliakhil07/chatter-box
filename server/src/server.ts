import authRoutes from "./routes/auth.routes";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { prisma } from "./config/prisma";
import cookieParser from "cookie-parser";
import conversationRoutes from "./routes/conversation.routes";
import messageRoutes from "./routes/message.routes";
import userRoutes from "./routes/user.routes";
import messageRequestRoutes from "./routes/message-request.routes";
import { createServer } from "http";
import { Server } from "socket.io";
import { validateSession } from "./services/session.service";
import {
  setSocketIO,
  emitToConversation,
  emitMessageRead,
} from "./socket";

dotenv.config();

const app = express();
const PORT = 5000;

app.use(
  cors({
    origin: "http://localhost:1204",
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/users", userRoutes);
app.use("/api/message-requests", messageRequestRoutes);
app.use("/api", messageRoutes);

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
    origin: "http://localhost:1204",
    credentials: true,
  },
});


setSocketIO(io);

/* ---------------- PRESENCE STATE ---------------- */

const activeConnections = new Map<string, number>();
const lastSeenAt = new Map<string, string>();

function incrementPresence(userId: string): void {
  const currentConnections = activeConnections.get(userId) ?? 0;

  activeConnections.set(userId, currentConnections + 1);

  if (currentConnections === 0) {
    io.emit("presence_updated", {
      userId,
      online: true,
      lastSeenAt: lastSeenAt.get(userId) ?? null,
    });
  }
}

function decrementPresence(userId: string): void {
  const currentConnections = activeConnections.get(userId) ?? 0;

  if (currentConnections <= 1) {
    activeConnections.delete(userId);

    const timestamp = new Date().toISOString();
    lastSeenAt.set(userId, timestamp);

    io.emit("presence_updated", {
      userId,
      online: false,
      lastSeenAt: timestamp,
    });

    return;
  }

  activeConnections.set(userId, currentConnections - 1);
}

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

  incrementPresence(userId);

  /*
   * Private per-user room for account-level realtime events.
   * The room is authenticated from the session-bound socket userId.
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

  socket.on("typing_start", async (conversationId, callback) => {
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

      emitToConversation(
        conversationId,
        "typing_updated",
        {
          conversationId,
          userId,
          isTyping: true,
        },
      );

      callback?.({
        ok: true,
      });
    } catch (error) {
      console.error("Typing start failed:", error);

      callback?.({
        ok: false,
        error: "Unable to update typing state",
      });
    }
  });

  socket.on("typing_stop", async (conversationId, callback) => {
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

      emitToConversation(
        conversationId,
        "typing_updated",
        {
          conversationId,
          userId,
          isTyping: false,
        },
      );

      callback?.({
        ok: true,
      });
    } catch (error) {
      console.error("Typing stop failed:", error);

      callback?.({
        ok: false,
        error: "Unable to update typing state",
      });
    }
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
        },
      });

      if (!message) {
        callback?.({
          ok: false,
          error: "Message not found",
        });
        return;
      }

      emitMessageRead(conversationId, {
  messageId,
  status: "read",
});

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
    decrementPresence(userId);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Chatter Box server running on http://localhost:${PORT}`);
});