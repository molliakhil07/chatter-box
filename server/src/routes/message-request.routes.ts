import { Router } from "express";
import {
  create,
  listIncoming,
  accepted,
  acceptedSeen,
  reject,
  accept,
} from "../controllers/message-request.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { createRateLimiter } from "../middleware/rate-limit.middleware";

const router = Router();

const messageRequestWriteRateLimit = createRateLimiter({
  keyPrefix: "message-request-write",
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many message request actions. Please try again later.",
});

router.post("/", requireAuth, messageRequestWriteRateLimit, create);
router.get("/incoming", requireAuth, listIncoming);
router.get("/accepted", requireAuth, accepted);
router.post("/:requestId/accepted-seen", requireAuth, messageRequestWriteRateLimit, acceptedSeen);
router.post("/:requestId/accept", requireAuth, messageRequestWriteRateLimit, accept);
router.post("/:requestId/reject", requireAuth, messageRequestWriteRateLimit, reject);

export default router;
