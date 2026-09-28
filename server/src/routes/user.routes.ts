import { Router } from "express";

import { getUsers } from "../controllers/user.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/", requireAuth, getUsers);

export default router;