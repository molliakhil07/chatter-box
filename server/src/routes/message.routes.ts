import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import {
  create,
  list,
  update,
} from "../controllers/message.controller";

const router = Router();

router.post(
  "/conversations/:conversationId/messages",
  requireAuth,
  create,
);

router.get(
  "/conversations/:conversationId/messages",
  requireAuth,
  list,
);

router.patch(
  "/messages/:messageId",
  requireAuth,
  update,
);

export default router;