import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import {
  create,
  getById,
  list,
} from "../controllers/conversation.controller";

const router = Router();

router.post("/", requireAuth, create);
router.get("/", requireAuth, list);
router.get("/:conversationId", requireAuth, getById);

export default router;