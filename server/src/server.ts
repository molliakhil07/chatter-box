import authRoutes from "./routes/auth.routes";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { prisma } from "./config/prisma";
import cookieParser from "cookie-parser";
import conversationRoutes from "./routes/conversation.routes";
import messageRoutes from "./routes/message.routes";

dotenv.config();

const app = express();
const PORT = 5000;

app.use(
  cors({
    origin: "http://localhost:1204",
  }),
);

app.use(express.json());
app.use(cookieParser());
app.use("/api/auth", authRoutes);
app.use("/api/conversations", conversationRoutes);
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

app.listen(PORT, () => {
  console.log(`Chatter Box server running on http://localhost:${PORT}`);
});