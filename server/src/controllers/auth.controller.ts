import crypto from "node:crypto";
import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import { registerUser } from "../services/user.service";
import {
  authenticateUser,
  createSession,
} from "../services/session.service";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const MAX_DISPLAY_NAME_LENGTH = 50;

const PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

export async function register(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { username, email, password, displayName } = req.body;

    if (
      typeof username !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      username.trim().length === 0 ||
      email.trim().length === 0 ||
      password.length === 0
    ) {
      res.status(400).json({
        error: "username, email, and password are required",
      });
      return;
    }

    if (
      password.length < MIN_PASSWORD_LENGTH ||
      password.length > MAX_PASSWORD_LENGTH
    ) {
      res.status(400).json({
        error: `Password must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters long`,
      });
      return;
    }

    if (!PASSWORD_PATTERN.test(password)) {
      res.status(400).json({
        error:
          "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    const emailPattern =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (
      normalizedEmail.length > 254 ||
      !emailPattern.test(normalizedEmail)
    ) {
      res.status(400).json({
        error: "Invalid email address",
      });
      return;
    }

    const normalizedUsername = username.trim();

    const usernamePattern = /^[a-zA-Z0-9_]{3,30}$/;

    if (!usernamePattern.test(normalizedUsername)) {
      res.status(400).json({
        error:
          "Username must be 3-30 characters and contain only letters, numbers, and underscores",
      });
      return;
    }

    if (typeof displayName === "string") {
      const normalizedDisplayName = displayName.trim();

      if (normalizedDisplayName.length > MAX_DISPLAY_NAME_LENGTH) {
        res.status(400).json({
          error: `Display name must be at most ${MAX_DISPLAY_NAME_LENGTH} characters long`,
        });
        return;
      }
    }

    const user = await registerUser({
      username: normalizedUsername,
      email: normalizedEmail,
      password,
      displayName:
        typeof displayName === "string"
          ? displayName
          : undefined,
    });

    res.status(201).json({
      user,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Username or email is already registered"
    ) {
      res.status(409).json({
        error: error.message,
      });
      return;
    }

    console.error("Registration failed:", error);

    res.status(500).json({
      error: "Unable to create account",
    });
  }
}

export async function login(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { identity, password } = req.body;

    if (
      typeof identity !== "string" ||
      typeof password !== "string" ||
      identity.trim().length === 0 ||
      password.length === 0
    ) {
      res.status(400).json({
        error: "identity and password are required",
      });
      return;
    }

    const user = await authenticateUser(identity, password);

    if (!user) {
      res.status(401).json({
        error: "Invalid credentials",
      });
      return;
    }

    const session = await createSession(user.id);

    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("session_token", session.token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 24 * 30,
    });

    res.status(200).json({
      user,
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    console.error("Login failed:", error);

    res.status(500).json({
      error: "Unable to log in",
    });
  }
}

export async function logout(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const token = req.cookies?.session_token;

    if (token) {
      const tokenHash = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

      await prisma.session.updateMany({
        where: {
          tokenHash,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    }

    const isProduction = process.env.NODE_ENV === "production";

    res.clearCookie("session_token", {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
    });

    res.status(200).json({
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout failed:", error);

    res.status(500).json({
      error: "Unable to log out",
    });
  }
}
