
import crypto from "node:crypto";
import { prisma } from "../config/prisma";
import { verifyPassword } from "./auth.service";
import type { PublicUser } from "../types/auth.types";

interface SessionUserRecord extends PublicUser {
  passwordHash: string;
}

interface SessionRecord {
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

interface SessionServiceDatabase {
  user: {
    findFirst(args: {
      where: {
        OR: [{ username: string }, { email: string }];
      };
    }): Promise<SessionUserRecord | null>;
  };
  session: {
    create(args: {
      data: {
        userId: string;
        tokenHash: string;
        expiresAt: Date;
      };
    }): Promise<unknown>;
    findUnique(args: {
      where: { tokenHash: string };
    }): Promise<SessionRecord | null>;
  };
}

interface SessionServiceOptions {
  database?: SessionServiceDatabase;
  passwordVerifier?: typeof verifyPassword;
}

const productionDatabase = {
  user: prisma.user,
  session: prisma.session,
} as unknown as SessionServiceDatabase;

export function createSessionService({
  database = productionDatabase,
  passwordVerifier = verifyPassword,
}: SessionServiceOptions = {}) {
  async function authenticateUser(
    identifier: string,
    password: string,
  ): Promise<PublicUser | null> {
    const normalizedIdentifier = identifier.trim();

    const user = await database.user.findFirst({
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

    const passwordValid = await passwordVerifier(
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

  async function createSession(
    userId: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    const token = crypto.randomBytes(32).toString("hex");

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const expiresAt = new Date(
      Date.now() + 1000 * 60 * 60 * 24 * 30,
    );

    await database.session.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return { token, expiresAt };
  }

  async function validateSession(
    token: string,
  ): Promise<string | null> {
    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const session = await database.session.findUnique({
      where: { tokenHash },
    });

    if (
      !session ||
      session.revokedAt !== null ||
      session.expiresAt <= new Date()
    ) {
      return null;
    }

    return session.userId;
  }

  return {
    authenticateUser,
    createSession,
    validateSession,
  };
}

// Existing production callers continue using these functions unchanged.
const sessionService = createSessionService();

export const authenticateUser = sessionService.authenticateUser;
export const createSession = sessionService.createSession;
export const validateSession = sessionService.validateSession;
