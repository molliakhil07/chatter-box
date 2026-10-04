import { Router } from "express";
import { prisma } from "../config/prisma";
import { requireAuth } from "../middleware/auth.middleware";
import { createRateLimiter } from "../middleware/rate-limit.middleware";
import { login, logout, register } from "../controllers/auth.controller";

const router = Router();

const authAttemptRateLimit = createRateLimiter({
  keyPrefix: "auth-attempt",
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many authentication attempts. Please try again later.",
});

router.post("/register", authAttemptRateLimit, register);
router.post("/login", authAttemptRateLimit, login);
router.post("/logout", requireAuth, logout);

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: {
      id: true,
      username: true,
      email: true,
      displayName: true,
      avatarUrl: true,
      createdAt: true,
    },
  });

  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json({ user });
});

export default router;
