import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import {
  clear,
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

router.delete(
  "/conversations/:conversationId/messages",
  requireAuth,
  clear,
);

router.patch(
  "/messages/:messageId",
  requireAuth,
  update,
);

export default router;
