import { prisma } from "../config/prisma";

const messageSelect = {
  id: true,
  conversationId: true,
  senderId: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  replyToMessageId: true,
  sender: {
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
    },
  },
  replyToMessage: {
    select: {
      id: true,
      content: true,
      deletedAt: true,
      sender: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  },
} as const;

export async function createMessage(
  conversationId: string,
  senderId: string,
  content: string,
  replyToMessageId?: string,
) {
  const membership = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId: senderId,
      },
    },
  });

  if (!membership) {
    return {
      status: "conversation_not_found" as const,
    };
  }

  if (replyToMessageId) {
    const replyTarget = await prisma.message.findFirst({
      where: {
        id: replyToMessageId,
        conversationId,
      },
      select: {
        id: true,
      },
    });

    if (!replyTarget) {
      return {
        status: "invalid_reply" as const,
      };
    }
  }

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId,
      content,
      ...(replyToMessageId
        ? { replyToMessageId }
        : {}),
    },
    select: messageSelect,
  });

  return {
    status: "created" as const,
    message,
  };
}

export async function getConversationMessages(
  conversationId: string,
  userId: string,
  cursor?: string,
  limit = 50,
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
      clearedAt: true,
      lastReadMessageId: true,
    },
  });

  if (!membership) {
    return null;
  }

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      ...(membership.clearedAt
        ? {
            createdAt: {
              gt: membership.clearedAt,
            },
          }
        : {}),
    },
    orderBy: {
      createdAt: "desc",
    },
    ...(cursor
      ? {
          cursor: {
            id: cursor,
          },
          skip: 1,
        }
      : {}),
    take: limit,
    select: messageSelect,
  });

  const otherMember = await prisma.conversationMember.findFirst({
    where: {
      conversationId,
      userId: {
        not: userId,
      },
    },
    select: {
      lastReadMessageId: true,
    },
  });

  let lastReadMessageCreatedAt: Date | null = null;

  if (otherMember?.lastReadMessageId) {
    const lastReadMessage = await prisma.message.findFirst({
      where: {
        id: otherMember.lastReadMessageId,
        conversationId,
      },
      select: {
        createdAt: true,
      },
    });

    lastReadMessageCreatedAt =
      lastReadMessage?.createdAt ?? null;
  }

  const readMessageIds = lastReadMessageCreatedAt
    ? messages
        .filter(
          (message) =>
            message.senderId === userId &&
            message.createdAt.getTime() <=
              lastReadMessageCreatedAt!.getTime(),
        )
        .map((message) => message.id)
    : [];

  return {
    items: messages,
    readMessageIds,
  };
}

export async function clearConversationHistory(
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

  await prisma.conversationMember.update({
    where: {
      id: membership.id,
    },
    data: {
      clearedAt: new Date(),
    },
  });

  return {
    status: "cleared" as const,
  };
}

export async function updateMessage(
  messageId: string,
  userId: string,
  action: "edit" | "delete",
  content?: string,
) {
  const message = await prisma.message.findUnique({
    where: {
      id: messageId,
    },
  });

  if (!message) {
    return {
      status: "not_found" as const,
    };
  }

  if (message.senderId !== userId) {
    return {
      status: "forbidden" as const,
    };
  }

  if (action === "edit") {
    if (!content || content.trim().length === 0) {
      return {
        status: "invalid_content" as const,
      };
    }

    if (message.deletedAt) {
      return {
        status: "deleted" as const,
      };
    }

    const updatedMessage = await prisma.message.update({
      where: {
        id: messageId,
      },
      data: {
        content: content.trim(),
      },
      select: messageSelect,
    });

    return {
      status: "updated" as const,
      message: updatedMessage,
    };
  }

  if (message.deletedAt) {
    return {
      status: "deleted" as const,
    };
  }

  const deletedMessage = await prisma.message.update({
    where: {
      id: messageId,
    },
    data: {
      deletedAt: new Date(),
    },
    select: messageSelect,
  });

  return {
    status: "deleted" as const,
    message: deletedMessage,
  };
}
