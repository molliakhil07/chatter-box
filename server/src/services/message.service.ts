import { prisma } from "../config/prisma";

export async function createMessage(
  conversationId: string,
  senderId: string,
  content: string,
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
    return null;
  }

  return prisma.message.create({
    data: {
      conversationId,
      senderId,
      content,
    },
    select: {
      id: true,
      conversationId: true,
      senderId: true,
      content: true,
      createdAt: true,
      updatedAt: true,
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
  });
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
  });

  if (!membership) {
    return null;
  }

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
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
    select: {
      id: true,
      conversationId: true,
      senderId: true,
      content: true,
      createdAt: true,
      updatedAt: true,
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
  });

  return messages;
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
      select: {
        id: true,
        conversationId: true,
        senderId: true,
        content: true,
        createdAt: true,
        updatedAt: true,
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
    select: {
      id: true,
      conversationId: true,
      senderId: true,
      content: true,
      createdAt: true,
      updatedAt: true,
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
  });

  return {
    status: "deleted" as const,
    message: deletedMessage,
  };
}