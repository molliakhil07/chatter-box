import crypto from "node:crypto";
import argon2 from "argon2";

import { prisma } from "../config/prisma";
import { sendPasswordResetEmail } from "./email.service";

const PASSWORD_RESET_TOKEN_TTL_MS = 1000 * 60 * 60;

let passwordResetTableReady: Promise<void> | null = null;

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

async function ensurePasswordResetTable(): Promise<void> {
  if (!passwordResetTableReady) {
    passwordResetTableReady = prisma
      .$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
          "id" TEXT PRIMARY KEY,
          "userId" TEXT NOT NULL,
          "tokenHash" TEXT NOT NULL,
          "expiresAt" TIMESTAMPTZ NOT NULL,
          "usedAt" TIMESTAMPTZ NULL,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT "PasswordResetToken_userId_fkey"
            FOREIGN KEY ("userId")
            REFERENCES "User"("id")
            ON DELETE CASCADE
        )
      `)
      .then(async () => {
        await prisma.$executeRawUnsafe(`
          CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_key"
          ON "PasswordResetToken" ("tokenHash")
        `);

        await prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx"
          ON "PasswordResetToken" ("userId")
        `);

        await prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "PasswordResetToken_expiresAt_idx"
          ON "PasswordResetToken" ("expiresAt")
        `);
      })
      .catch((error) => {
        passwordResetTableReady = null;
        throw error;
      });
  }

  await passwordResetTableReady;
}

export async function requestPasswordReset(
  email: string,
): Promise<void> {
  await ensurePasswordResetTable();

  const normalizedEmail = email.trim().toLowerCase();

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      email: string;
      displayName: string | null;
      emailVerified: boolean;
    }>
  >`
    SELECT
      "id",
      "email",
      "displayName",
      "emailVerified"
    FROM "User"
    WHERE "email" = ${normalizedEmail}
    LIMIT 1
  `;

  const user = rows[0];

  /*
   * Deliberately return without sending anything when the account does not
   * exist or has not verified its email. The controller always returns the
   * same public response so this does not disclose account existence.
   */
  if (!user || !user.emailVerified) {
    return;
  }

  await prisma.$executeRaw`
    DELETE FROM "PasswordResetToken"
    WHERE "userId" = ${user.id}
  `;

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(
    Date.now() + PASSWORD_RESET_TOKEN_TTL_MS,
  );

  await prisma.$executeRaw`
    INSERT INTO "PasswordResetToken" (
      "id",
      "userId",
      "tokenHash",
      "expiresAt",
      "createdAt"
    )
    VALUES (
      ${crypto.randomUUID()},
      ${user.id},
      ${tokenHash},
      ${expiresAt},
      NOW()
    )
  `;

  const resetUrl =
    `${getFrontendUrl()}/?reset_password=${encodeURIComponent(rawToken)}`;

  try {
    await sendPasswordResetEmail({
      to: user.email,
      displayName: user.displayName,
      resetUrl,
    });
  } catch (error) {
    await prisma.$executeRaw`
      DELETE FROM "PasswordResetToken"
      WHERE "tokenHash" = ${tokenHash}
    `;
    throw error;
  }
}

export async function resetPassword(
  rawToken: string,
  password: string,
): Promise<boolean> {
  await ensurePasswordResetTable();

  const tokenHash = hashToken(rawToken);

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
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
      FROM "PasswordResetToken"
      WHERE "tokenHash" = ${tokenHash}
      LIMIT 1
      FOR UPDATE
    `;

    const tokenRecord = rows[0];

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

    await tx.$executeRaw`
      UPDATE "User"
      SET "passwordHash" = ${passwordHash},
          "updatedAt" = NOW()
      WHERE "id" = ${tokenRecord.userId}
    `;

    await tx.$executeRaw`
      UPDATE "PasswordResetToken"
      SET "usedAt" = NOW()
      WHERE "id" = ${tokenRecord.id}
    `;

    await tx.$executeRaw`
      DELETE FROM "PasswordResetToken"
      WHERE "userId" = ${tokenRecord.userId}
        AND "id" <> ${tokenRecord.id}
    `;

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
