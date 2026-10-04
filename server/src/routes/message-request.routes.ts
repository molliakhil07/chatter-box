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

const router = Router();

router.post("/", requireAuth, create);

router.get(
  "/incoming",
  requireAuth,
  listIncoming,
);

router.get(
  "/accepted",
  requireAuth,
  accepted,
);

router.post(
  "/:requestId/accepted-seen",
  requireAuth,
  acceptedSeen,
);

router.post(
  "/:requestId/accept",
  requireAuth,
  accept,
);

router.post(
  "/:requestId/reject",
  requireAuth,
  reject,
);

export default router;