import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { createRateLimiter } from "../middleware/rate-limit.middleware";
import { clear, create, list, update } from "../controllers/message.controller";

const router = Router();

const messageWriteRateLimit = createRateLimiter({
  keyPrefix: "message-write",
  windowMs: 60 * 1000,
  max: 60,
  message: "Too many message actions. Please slow down and try again.",
});

router.post("/conversations/:conversationId/messages", requireAuth, messageWriteRateLimit, create);
router.get("/conversations/:conversationId/messages", requireAuth, list);
router.delete("/conversations/:conversationId/messages", requireAuth, clear);
router.patch("/messages/:messageId", requireAuth, messageWriteRateLimit, update);

export default router;
