import crypto from "node:crypto";
import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import { registerUser } from "../services/user.service";
import {
  authenticateUser,
  createSession,
} from "../services/session.service";

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

    if (password.length < 8) {
      res.status(400).json({
        error: "Password must be at least 8 characters long",
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(normalizedEmail)) {
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

    const user = await registerUser({
      username: normalizedUsername,
      email: normalizedEmail,
      password,
      displayName:
        typeof displayName === "string" ? displayName : undefined,
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

    res.cookie("session_token", session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
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

    res.clearCookie("session_token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
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