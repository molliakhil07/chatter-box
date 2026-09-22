import { prisma } from "../config/prisma";
import { hashPassword } from "./auth.service";
import type { RegisterInput, PublicUser } from "../types/auth.types";

export async function registerUser(
  input: RegisterInput,
): Promise<PublicUser> {
  const username = input.username.trim();
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName?.trim() || null;

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ username }, { email }],
    },
  });

  if (existingUser) {
    throw new Error("Username or email is already registered");
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      username,
      email,
      passwordHash,
      displayName,
    },
    select: {
      id: true,
      username: true,
      email: true,
      displayName: true,
      avatarUrl: true,
      createdAt: true,
    },
  });

  return user;
}