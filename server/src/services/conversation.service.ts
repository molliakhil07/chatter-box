import { prisma } from "../config/prisma";

export async function userExists(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
    },
  });

  return user !== null;
}

export async function createConversation(
  userId: string,
  otherUserId: string,
) {
  return prisma.conversation.create({
    data: {
      members: {
        create: [
          {
            userId,
          },
          {
            userId: otherUserId,
          },
        ],
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