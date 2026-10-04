import { Router } from "express";

import {
  getUserProfile,
  getUsers,
} from "../controllers/user.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get(
  "/",
  requireAuth,
  getUsers,
);

router.get(
  "/:userId/profile",
  requireAuth,
  getUserProfile,
);

export default router;