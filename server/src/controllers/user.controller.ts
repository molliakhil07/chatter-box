import type { Request, Response } from "express";

import {
  getUserProfile as getUserProfileById,
  searchUsers,
} from "../services/user.service";

export async function getUsers(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        error: "Authentication required",
      });
      return;
    }

    const search =
      typeof req.query.search === "string"
        ? req.query.search
        : undefined;

    if (search && search.trim().length > 100) {
      res.status(400).json({
        error: "Search query is too long",
      });
      return;
    }

    const users = await searchUsers(
      userId,
      search,
    );

    // searchUsers includes server-derived relationship state
    // for each result. This is presentation state only;
    // protected request/conversation endpoints remain authoritative.
    res.status(200).json({
      users,
    });
  } catch (error) {
    console.error("User search failed:", error);

    res.status(500).json({
      error: "Unable to search users",
    });
  }
}

export async function getUserProfile(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const currentUserId = req.userId;

    if (!currentUserId) {
      res.status(401).json({
        error: "Authentication required",
      });
      return;
    }

    const userId = req.params.userId;

    if (
      typeof userId !== "string" ||
      userId.trim().length === 0
    ) {
      res.status(400).json({
        error: "User ID is required",
      });
      return;
    }

    const user = await getUserProfileById(userId);

    if (!user) {
      res.status(404).json({
        error: "User not found",
      });
      return;
    }

    res.status(200).json({
      user,
    });
  } catch (error) {
    console.error(
      "User profile lookup failed:",
      error,
    );

    res.status(500).json({
      error: "Unable to load user profile",
    });
  }
}