import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import {
  create,
  list,
} from "../controllers/conversation.controller";

const router = Router();

router.post("/", requireAuth, create);
router.get("/", requireAuth, list);

export default router;