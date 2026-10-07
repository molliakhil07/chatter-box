import crypto from "node:crypto";
import argon2 from "argon2";

import { prisma } from "../config/prisma";
import { sendPasswordResetEmail } from "./email.service";

const PASSWORD_RESET_TOKEN_TTL_MS = 1000 * 60 * 60;

function hashToken(token: string): string {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function getFrontendUrl(): string {
  return (
    process.env.FRONTEND_URL?.trim() ??
    "http://localhost:1204"
  ).replace(/\/$/, "");
}

export async function requestPasswordReset(
  email: string,
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      emailVerified: true,
    },
  });

  /*
   * Deliberately return without sending anything when the account does not
   * exist or has not verified its email. The controller always returns the
   * same public response so this does not disclose account existence.
   */
  if (!user || !user.emailVerified) {
    return;
  }

  await prisma.passwordResetToken.deleteMany({
    where: {
      userId: user.id,
    },
  });

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(
    Date.now() + PASSWORD_RESET_TOKEN_TTL_MS,
  );

  await prisma.passwordResetToken.create({
    data: {
      id: crypto.randomUUID(),
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  const resetUrl =
    `${getFrontendUrl()}/?reset_password=${encodeURIComponent(rawToken)}`;

  try {
    await sendPasswordResetEmail({
      to: user.email,
      displayName: user.displayName,
      resetUrl,
    });
  } catch (error) {
    await prisma.passwordResetToken.deleteMany({
      where: {
        tokenHash,
      },
    });

    throw error;
  }
}

export async function resetPassword(
  rawToken: string,
  password: string,
): Promise<boolean> {
  const tokenHash = hashToken(rawToken);

  return prisma.$transaction(async (tx) => {
    const tokenRecord =
      await tx.passwordResetToken.findUnique({
        where: {
          tokenHash,
        },
        select: {
          id: true,
          userId: true,
          expiresAt: true,
          usedAt: true,
        },
      });

    if (
      !tokenRecord ||
      tokenRecord.usedAt !== null ||
      tokenRecord.expiresAt <= new Date()
    ) {
      return false;
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
    });

    const markedUsed = await tx.passwordResetToken.updateMany({
      where: {
        id: tokenRecord.id,
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      data: {
        usedAt: new Date(),
      },
    });

    if (markedUsed.count !== 1) {
      return false;
    }

    await tx.user.update({
      where: {
        id: tokenRecord.userId,
      },
      data: {
        passwordHash,
      },
    });

    await tx.passwordResetToken.deleteMany({
      where: {
        userId: tokenRecord.userId,
        id: {
          not: tokenRecord.id,
        },
      },
    });

    await tx.session.updateMany({
      where: {
        userId: tokenRecord.userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return true;
  });
}