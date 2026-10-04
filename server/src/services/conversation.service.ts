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

export async function findDirectConversation(
  userId: string,
  otherUserId: string,
) {
  return prisma.conversation.findFirst({
    where: {
      AND: [
        {
          members: {
            some: {
              userId,
            },
          },
        },
        {
          members: {
            some: {
              userId: otherUserId,
            },
          },
        },
      ],
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
  const conversations = await prisma.conversation.findMany({
    where: {
      members: {
        some: {
          userId,
        },
      },
    },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
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

  return conversations;
}

export async function getConversationById(
  conversationId: string,
  userId: string,
) {
  return prisma.conversation.findFirst({
    where: {
      id: conversationId,
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
  });
}
export async function removeConversationMember(
  conversationId: string,
  userId: string,
  targetUserId: string,
) {
  return prisma.conversationMember.deleteMany({
    where: {
      conversationId,
      userId: targetUserId,
    },
  });
}
export async function deleteConversation(
  conversationId: string,
  userId: string,
) {
  const membership = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId,
      },
    },
    select: {
      id: true,
    },
  });

  if (!membership) {
    return {
      status: "conversation_not_found" as const,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.conversationMember.updateMany({
      where: {
        conversationId,
      },
      data: {
        lastReadMessageId: null,
      },
    });

    await tx.message.updateMany({
      where: {
        conversationId,
      },
      data: {
        replyToMessageId: null,
      },
    });

    await tx.message.deleteMany({
      where: {
        conversationId,
      },
    });

    await tx.conversationMember.deleteMany({
      where: {
        conversationId,
      },
    });

    await tx.conversation.delete({
      where: {
        id: conversationId,
      },
    });
  });

  return {
    status: "deleted" as const,
  };
}
