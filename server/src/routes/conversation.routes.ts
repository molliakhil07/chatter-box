import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import {
  create,
  getById,
  list,
  removeMember,
} from "../controllers/conversation.controller";

const router = Router();

router.post("/", requireAuth, create);
router.get("/", requireAuth, list);
router.get("/:conversationId", requireAuth, getById);

router.delete(
  "/:conversationId/members/:userId",
  requireAuth,
  removeMember,
);

export default router;