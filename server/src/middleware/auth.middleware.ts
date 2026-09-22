import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = req.cookies?.session_token;

    if (!token) {
      res.status(401).json({
        error: "Authentication required",
      });
      return;
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const session = await prisma.session.findUnique({
      where: {
        tokenHash,
      },
    });

    if (
      !session ||
      session.revokedAt !== null ||
      session.expiresAt <= new Date()
    ) {
      res.status(401).json({
        error: "Invalid or expired session",
      });
      return;
    }

    req.userId = session.userId;

    next();
  } catch (error) {
    console.error("Authentication failed:", error);

    res.status(500).json({
      error: "Authentication check failed",
    });
  }
}