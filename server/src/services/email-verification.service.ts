import crypto from "node:crypto";

import { prisma } from "../config/prisma";
import { sendVerificationEmail } from "./email.service";

const VERIFICATION_TOKEN_TTL_MS = 1000 * 60 * 60 * 24;

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

type VerificationUser = {
  id: string;
  email: string;
  displayName: string | null;
  emailVerified: boolean;
};

async function getVerificationUser(
  userId: string,
): Promise<VerificationUser | null> {
  return prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      emailVerified: true,
    },
  });
}

export async function createAndSendVerificationEmail(
  userId: string,
): Promise<void> {
  const user = await getVerificationUser(userId);

  if (!user) {
    throw new Error("User not found");
  }

  if (user.emailVerified) {
    return;
  }

  await prisma.emailVerificationToken.deleteMany({
    where: {
      userId,
      usedAt: null,
    },
  });

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(
    Date.now() + VERIFICATION_TOKEN_TTL_MS,
  );

  await prisma.emailVerificationToken.create({
    data: {
      id: crypto.randomUUID(),
      userId,
      tokenHash,
      expiresAt,
    },
  });

  const verificationUrl =
    `${getFrontendUrl()}/?verify_email=${encodeURIComponent(rawToken)}`;

  try {
    await sendVerificationEmail({
      to: user.email,
      displayName: user.displayName,
      verificationUrl,
    });
  } catch (error) {
    await prisma.emailVerificationToken.deleteMany({
      where: {
        tokenHash,
      },
    });

    throw error;
  }
}

export async function verifyEmailToken(
  rawToken: string,
): Promise<boolean> {
  const tokenHash = hashToken(rawToken);

  return prisma.$transaction(async (tx) => {
    const tokenRecord =
      await tx.emailVerificationToken.findUnique({
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

    const updatedUser = await tx.user.updateMany({
      where: {
        id: tokenRecord.userId,
        emailVerified: false,
      },
      data: {
        emailVerified: true,
      },
    });

    if (updatedUser.count !== 1) {
      return false;
    }

    await tx.emailVerificationToken.update({
      where: {
        id: tokenRecord.id,
      },
      data: {
        usedAt: new Date(),
      },
    });

    await tx.emailVerificationToken.deleteMany({
      where: {
        userId: tokenRecord.userId,
        id: {
          not: tokenRecord.id,
        },
      },
    });

    return true;
  });
}

export async function resendVerificationEmail(
  email: string,
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
    select: {
      id: true,
      emailVerified: true,
    },
  });

  if (!user || user.emailVerified) {
    return;
  }

  await createAndSendVerificationEmail(user.id);
}