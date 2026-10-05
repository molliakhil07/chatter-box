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
  const rows = await prisma.$queryRaw<VerificationUser[]>`
    SELECT
      "id",
      "email",
      "displayName",
      "emailVerified"
    FROM "User"
    WHERE "id" = ${userId}
    LIMIT 1
  `;

  return rows[0] ?? null;
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

  await prisma.$executeRaw`
    DELETE FROM "EmailVerificationToken"
    WHERE "userId" = ${userId}
      AND "usedAt" IS NULL
  `;

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(
    Date.now() + VERIFICATION_TOKEN_TTL_MS,
  );

  await prisma.$executeRaw`
    INSERT INTO "EmailVerificationToken" (
      "id",
      "userId",
      "tokenHash",
      "expiresAt",
      "createdAt"
    )
    VALUES (
      ${crypto.randomUUID()},
      ${userId},
      ${tokenHash},
      ${expiresAt},
      NOW()
    )
  `;

  const verificationUrl =
    `${getFrontendUrl()}/?verify_email=${encodeURIComponent(rawToken)}`;

  try {
    await sendVerificationEmail({
      to: user.email,
      displayName: user.displayName,
      verificationUrl,
    });
  } catch (error) {
    await prisma.$executeRaw`
      DELETE FROM "EmailVerificationToken"
      WHERE "tokenHash" = ${tokenHash}
    `;
    throw error;
  }
}

export async function verifyEmailToken(
  rawToken: string,
): Promise<boolean> {
  const tokenHash = hashToken(rawToken);

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      userId: string;
      expiresAt: Date;
      usedAt: Date | null;
    }>
  >`
    SELECT
      "id",
      "userId",
      "expiresAt",
      "usedAt"
    FROM "EmailVerificationToken"
    WHERE "tokenHash" = ${tokenHash}
    LIMIT 1
  `;

  const tokenRecord = rows[0];

  if (
    !tokenRecord ||
    tokenRecord.usedAt !== null ||
    tokenRecord.expiresAt <= new Date()
  ) {
    return false;
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "User"
      SET "emailVerified" = TRUE,
          "updatedAt" = NOW()
      WHERE "id" = ${tokenRecord.userId}
    `;

    await tx.$executeRaw`
      UPDATE "EmailVerificationToken"
      SET "usedAt" = NOW()
      WHERE "id" = ${tokenRecord.id}
    `;

    await tx.$executeRaw`
      DELETE FROM "EmailVerificationToken"
      WHERE "userId" = ${tokenRecord.userId}
        AND "id" <> ${tokenRecord.id}
    `;
  });

  return true;
}

export async function resendVerificationEmail(
  email: string,
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      emailVerified: boolean;
    }>
  >`
    SELECT
      "id",
      "emailVerified"
    FROM "User"
    WHERE "email" = ${normalizedEmail}
    LIMIT 1
  `;

  const user = rows[0];

  if (!user || user.emailVerified) {
    return;
  }

  await createAndSendVerificationEmail(user.id);
}
