import { prisma } from "../config/prisma";

export async function createConversation(userId: string) {
  return prisma.conversation.create({
    data: {
      members: {
        create: {
          userId,
        },
      },
    },
    include: {
      members: {
        select: {
          userId: true,
          joinedAt: true,
        },
      },
    },
  });
}

export async function getUserConversations(userId: string) {
  return prisma.conversation.findMany({
    where: {
      members: {
        some: {
          userId,
        },
      },
    },
    include: {
      members: {
        select: {
          userId: true,
          joinedAt: true,
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}