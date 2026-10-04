import { Router } from "express";
import { prisma } from "../config/prisma";
import { requireAuth } from "../middleware/auth.middleware";
import { createRateLimiter } from "../middleware/rate-limit.middleware";
import {
  login,
  logout,
  register,
} from "../controllers/auth.controller";
import { updateUserProfile } from "../services/user.service";

const router = Router();

const authAttemptRateLimit = createRateLimiter({
  keyPrefix: "auth-attempt",
  windowMs: 15 * 60 * 1000,
  max: 10,
  message:
    "Too many authentication attempts. Please try again later.",
});

const profileUpdateRateLimit = createRateLimiter({
  keyPrefix: "profile-update",
  windowMs: 15 * 60 * 1000,
  max: 20,
  message:
    "Too many profile updates. Please try again later.",
});

router.post(
  "/register",
  authAttemptRateLimit,
  register,
);

router.post(
  "/login",
  authAttemptRateLimit,
  login,
);

router.post(
  "/logout",
  requireAuth,
  logout,
);

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: {
      id: req.userId,
    },
    select: {
      id: true,
      username: true,
      email: true,
      displayName: true,
      avatarUrl: true,
      gender: true,
      bio: true,
      createdAt: true,
    },
  });

  if (!user) {
    res.status(401).json({
      error: "User not found",
    });
    return;
  }

  res.json({
    user,
  });
});

router.patch(
  "/me",
  requireAuth,
  profileUpdateRateLimit,
  async (req, res): Promise<void> => {
    try {
      const userId = req.userId;

      if (!userId) {
        res.status(401).json({
          error: "Authentication required",
        });
        return;
      }

      const body = req.body;

      if (
        body === null ||
        typeof body !== "object" ||
        Array.isArray(body)
      ) {
        res.status(400).json({
          error: "Invalid profile data",
        });
        return;
      }

      const allowedKeys = new Set([
        "displayName",
        "bio",
      ]);

      const suppliedKeys = Object.keys(body);

      const hasInvalidKey = suppliedKeys.some(
        (key) => !allowedKeys.has(key),
      );

      if (hasInvalidKey) {
        res.status(400).json({
          error:
            "Only displayName and bio can be updated",
        });
        return;
      }

      if (
        "displayName" in body &&
        body.displayName !== null &&
        typeof body.displayName !== "string"
      ) {
        res.status(400).json({
          error: "Invalid display name",
        });
        return;
      }

      if (
        "bio" in body &&
        body.bio !== null &&
        typeof body.bio !== "string"
      ) {
        res.status(400).json({
          error: "Invalid bio",
        });
        return;
      }

      if (
        typeof body.displayName === "string" &&
        body.displayName.trim().length > 100
      ) {
        res.status(400).json({
          error:
            "Display name must be 100 characters or fewer",
        });
        return;
      }

      if (
        typeof body.bio === "string" &&
        body.bio.trim().length > 500
      ) {
        res.status(400).json({
          error:
            "Bio must be 500 characters or fewer",
        });
        return;
      }

      if (suppliedKeys.length === 0) {
        res.status(400).json({
          error: "No profile changes supplied",
        });
        return;
      }

      const user = await updateUserProfile(
        userId,
        {
          ...(Object.prototype.hasOwnProperty.call(
            body,
            "displayName",
          )
            ? {
                displayName:
                  body.displayName,
              }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(
            body,
            "bio",
          )
            ? {
                bio: body.bio,
              }
            : {}),
        },
      );

      res.status(200).json({
        user,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (
          error.message ===
            "Display name must be 100 characters or fewer" ||
          error.message ===
            "Bio must be 500 characters or fewer"
        )
      ) {
        res.status(400).json({
          error: error.message,
        });
        return;
      }

      console.error(
        "Profile update failed:",
        error,
      );

      res.status(500).json({
        error: "Unable to update profile",
      });
    }
  },
);

export default router;