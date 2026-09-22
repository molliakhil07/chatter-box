import crypto from "node:crypto";
import { prisma } from "../config/prisma";
import { verifyPassword } from "./auth.service";
import type { PublicUser } from "../types/auth.types";

export async function authenticateUser(
  identifier: string,
  password: string,
): Promise<PublicUser | null> {
  const normalizedIdentifier = identifier.trim();

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: normalizedIdentifier },
        { email: normalizedIdentifier.toLowerCase() },
      ],
    },
  });

  if (!user) {
    return null;
  }

  const passwordValid = await verifyPassword(
    password,
    user.passwordHash,
  );

  if (!passwordValid) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  };
}
export async function createSession(
  userId: string,
): Promise<{
  token: string;
  expiresAt: Date;
}> {
  const token = crypto.randomBytes(32).toString("hex");

  const tokenHash = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  const expiresAt = new Date(
    Date.now() + 1000 * 60 * 60 * 24 * 30,
  );

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return {
    token,
    expiresAt,
  };
}