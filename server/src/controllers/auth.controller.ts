import crypto from "node:crypto";
import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import { registerUser } from "../services/user.service";
import {
  createAndSendVerificationEmail,
  resendVerificationEmail,
  verifyEmailToken,
} from "../services/email-verification.service";
import {
  authenticateUser,
  createSession,
} from "../services/session.service";
import {
  requestPasswordReset,
  resetPassword,
} from "../services/password-reset.service";

export async function register(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const {
      username,
      email,
      password,
      displayName,
      gender,
      termsAccepted,
      privacyPolicyAcknowledged,
    } = req.body;

    if (termsAccepted !== true || privacyPolicyAcknowledged !== true) {
      res.status(400).json({
        error: "You must agree to the Terms & Conditions and acknowledge the Privacy Policy to create an account.",
      });
      return;
    }

    if (
      typeof username !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      username.trim().length === 0 ||
      email.trim().length === 0 ||
      password.length === 0
    ) {
      res.status(400).json({
        error:
          "username, email, and password are required",
      });
      return;
    }

    if (
      gender !== "MALE" &&
      gender !== "FEMALE"
    ) {
      res.status(400).json({
        error: "Gender must be MALE or FEMALE",
      });
      return;
    }

    const passwordPattern =
      /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

    if (!passwordPattern.test(password)) {
      res.status(400).json({
        error:
          "Password must be at least 8 characters and include at least one alphabet, one number, and one special character",
      });
      return;
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    const emailPattern =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(normalizedEmail)) {
      res.status(400).json({
        error: "Invalid email address",
      });
      return;
    }

    const normalizedUsername =
      username.trim();

    const usernamePattern =
      /^[a-zA-Z0-9_]{3,30}$/;

    if (!usernamePattern.test(normalizedUsername)) {
      res.status(400).json({
        error:
          "Username must be 3-30 characters and contain only letters, numbers, and underscores",
      });
      return;
    }

    if (
      typeof displayName === "string" &&
      displayName.trim().length > 100
    ) {
      res.status(400).json({
        error:
          "Display name must be 100 characters or fewer",
      });
      return;
    }

    const user = await registerUser({
      username: normalizedUsername,
      email: normalizedEmail,
      password,
      displayName:
        typeof displayName === "string"
          ? displayName
          : undefined,
      gender,
      termsAccepted,
      privacyPolicyAcknowledged,
    });

    try {
      await createAndSendVerificationEmail(user.id);
    } catch (emailError) {
      console.error("Verification email sending failed:", emailError);

      await prisma.user.delete({
        where: { id: user.id },
      });

      res.status(503).json({
        error:
          "Unable to send the verification email. Please try again later.",
      });
      return;
    }

    res.status(201).json({
      verificationRequired: true,
      email: user.email,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message ===
        "Username or email is already registered"
    ) {
      res.status(409).json({
        error: error.message,
      });
      return;
    }

    if (
      error instanceof Error &&
      error.message ===
        "Display name must be 100 characters or fewer"
    ) {
      res.status(400).json({
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

    const user = await authenticateUser(
      identity,
      password,
    );

    if (!user) {
      res.status(401).json({
        error: "Invalid credentials",
      });
      return;
    }

    const verificationRows = await prisma.$queryRaw<
      Array<{ emailVerified: boolean }>
    >`
      SELECT "emailVerified"
      FROM "User"
      WHERE "id" = ${user.id}
      LIMIT 1
    `;

    const verificationState = verificationRows[0];

    if (!verificationState?.emailVerified) {
      res.status(403).json({
        error:
          "Please verify your email address before signing in.",
      });
      return;
    }

    const session = await createSession(user.id);

    const isProduction =
      process.env.NODE_ENV === "production";

    res.cookie("session_token", session.token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge:
        1000 * 60 * 60 * 24 * 30,
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

export async function verifyEmail(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const token =
      typeof req.query.token === "string"
        ? req.query.token.trim()
        : "";

    if (!token) {
      res.status(400).json({
        error: "Verification token is required",
      });
      return;
    }

    const verified = await verifyEmailToken(token);

    if (!verified) {
      res.status(400).json({
        error:
          "This verification link is invalid or has expired.",
      });
      return;
    }

    res.status(200).json({
      message: "Email verified successfully.",
    });
  } catch (error) {
    console.error("Email verification failed:", error);
    res.status(500).json({
      error: "Unable to verify email. Please try again.",
    });
  }
}

export async function resendVerification(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { email } = req.body;

    if (typeof email !== "string" || email.trim().length === 0) {
      res.status(400).json({
        error: "Email is required",
      });
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const normalizedEmail = email.trim().toLowerCase();

    if (!emailPattern.test(normalizedEmail)) {
      res.status(400).json({
        error: "Invalid email address",
      });
      return;
    }

    await resendVerificationEmail(normalizedEmail);

    res.status(200).json({
      message:
        "If an unverified account exists for that email, a verification email has been sent.",
    });
  } catch (error) {
    console.error("Verification email resend failed:", error);
    res.status(503).json({
      error:
        "Unable to send the verification email. Please try again later.",
    });
  }
}

export async function forgotPassword(
  req: Request,
  res: Response,
): Promise<void> {
  const normalizedEmail =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(normalizedEmail)) {
    res.status(400).json({
      error: "Invalid email address",
    });
    return;
  }

  try {
    await requestPasswordReset(normalizedEmail);
  } catch (error) {
    console.error("Password reset request failed:", error);

    /*
     * Do not reveal whether an account exists. The frontend receives the
     * same successful response for existing and non-existing accounts.
     */
  }

  res.status(200).json({
    message:
      "If an account exists for that email, a password reset link has been sent.",
  });
}

export async function resetPasswordWithToken(
  req: Request,
  res: Response,
): Promise<void> {
  const token =
    typeof req.body?.token === "string"
      ? req.body.token.trim()
      : "";

  const password =
    typeof req.body?.password === "string"
      ? req.body.password
      : "";

  if (!token) {
    res.status(400).json({
      error: "Password reset token is required",
    });
    return;
  }

  const passwordPattern =
    /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

  if (!passwordPattern.test(password)) {
    res.status(400).json({
      error:
        "Password must be at least 8 characters and include at least one alphabet, one number, and one special character",
    });
    return;
  }

  try {
    const reset = await resetPassword(token, password);

    if (!reset) {
      res.status(400).json({
        error:
          "This password reset link is invalid or has expired.",
      });
      return;
    }

    res.status(200).json({
      message: "Password reset successfully.",
    });
  } catch (error) {
    console.error("Password reset failed:", error);

    res.status(500).json({
      error: "Unable to reset password. Please try again.",
    });
  }
}

export async function deleteAccount(
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

    /*
     * These token tables are intentionally handled here because the
     * email-verification table is maintained outside Prisma's current
     * schema file. The password-reset table is also created at runtime.
     */
    await prisma.$executeRaw`
      DELETE FROM "EmailVerificationToken"
      WHERE "userId" = ${userId}
    `;

    try {
      await prisma.$executeRaw`
        DELETE FROM "PasswordResetToken"
        WHERE "userId" = ${userId}
      `;
    } catch (passwordResetTableError) {
      /*
       * The reset-token table is created lazily by the forgot-password
       * flow, so it may not exist yet for an older deployment.
       */
      console.warn(
        "Password reset token cleanup skipped:",
        passwordResetTableError,
      );
    }

    /*
     * User relations in the current Prisma schema use cascading deletes
     * for memberships, messages, message requests, and sessions.
     */
    await prisma.user.delete({
      where: {
        id: userId,
      },
    });

    const isProduction =
      process.env.NODE_ENV === "production";

    res.clearCookie("session_token", {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
    });

    res.status(200).json({
      message: "Account deleted permanently.",
    });
  } catch (error) {
    console.error("Account deletion failed:", error);

    res.status(500).json({
      error: "Unable to delete account. Please try again.",
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

    const isProduction =
      process.env.NODE_ENV === "production";

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