import { logError } from "../logger";
import type {
  Request,
  Response,
  NextFunction,
} from "express";
import "../types/express";
import { validateSession } from "../services/session.service";

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

    const userId = await validateSession(token);

    if (!userId) {
      res.status(401).json({
        error: "Invalid or expired session",
      });
      return;
    }

    req.userId = userId;

    next();
  } catch (error) {
    logError("Authentication failed:", error);

    res.status(500).json({
      error: "Authentication check failed",
    });
  }
}