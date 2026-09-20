import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 5000;

app.use(cors({
  origin: "http://localhost:1204",
}));

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "Chatter Box server is running",
  });
});

app.listen(PORT, () => {
  console.log(`Chatter Box server running on http://localhost:${PORT}`);
});