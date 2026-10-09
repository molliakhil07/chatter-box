
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { Server } from "socket.io";

import { prisma } from "./config/prisma";
import authRoutes from "./routes/auth.routes";
import conversationRoutes from "./routes/conversation.routes";
import messageRoutes from "./routes/message.routes";
import messageRequestRoutes from "./routes/message-request.routes";
import userRoutes from "./routes/user.routes";
import { configureSocketServer } from "./socket-server";

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

app.use(express.json({ limit: "32kb" }));
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
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

configureSocketServer(io);

httpServer.listen(PORT, HOST, () => {
  console.log(
    `Chatter Box server running on http://${HOST}:${PORT}`,
  );
});
