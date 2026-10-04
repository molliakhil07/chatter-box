import { prisma } from "../config/prisma";

type CreateMessageRequestResult =
  | {
      status: "created";
      request: {
        id: string;
        senderId: string;
        receiverId: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
      };
    }
  | {
      status:
        | "self_request"
        | "user_not_found"
        | "already_connected"
        | "request_exists";
    };

export async function createMessageRequest(
  senderId: string,
  receiverId: string,
): Promise<CreateMessageRequestResult> {
  if (senderId === receiverId) {
    return {
      status: "self_request",
    };
  }

  const receiver = await prisma.user.findUnique({
    where: {
      id: receiverId,
    },
    select: {
      id: true,
    },
  });

  if (!receiver) {
    return {
      status: "user_not_found",
    };
  }

  const existingConversation =
    await prisma.conversation.findFirst({
      where: {
        AND: [
          {
            members: {
              some: {
                userId: senderId,
              },
            },
          },
          {
            members: {
              some: {
                userId: receiverId,
              },
            },
          },
        ],
      },
      select: {
        id: true,
      },
    });

  if (existingConversation) {
    return {
      status: "already_connected",
    };
  }

  /*
   * A MessageRequest is retained after accept/reject in the current
   * schema. Reusing that record is important because deployments may
   * enforce one request row per sender/receiver pair.
   *
   * This also fixes the case where a conversation was deleted after an
   * earlier request was accepted: the old request is reset to PENDING
   * instead of trying to INSERT a duplicate row.
   */
  const existingRequest =
    await prisma.messageRequest.findFirst({
      where: {
        senderId,
        receiverId,
      },
      select: {
        id: true,
        status: true,
      },
    });

  if (existingRequest?.status === "PENDING") {
    return {
      status: "request_exists",
    };
  }

  if (existingRequest) {
    const request =
      await prisma.messageRequest.update({
        where: {
          id: existingRequest.id,
        },
        data: {
          status: "PENDING",
          respondedAt: null,
          acceptedSeenAt: null,
        },
        select: {
          id: true,
          senderId: true,
          receiverId: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });

    return {
      status: "created",
      request,
    };
  }

  const request =
    await prisma.messageRequest.create({
      data: {
        senderId,
        receiverId,
      },
      select: {
        id: true,
        senderId: true,
        receiverId: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

  return {
    status: "created",
    request,
  };
}

export async function getIncomingMessageRequests(
  userId: string,
) {
  return prisma.messageRequest.findMany({
    where: {
      receiverId: userId,
      status: "PENDING",
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      senderId: true,
      receiverId: true,
      status: true,
      createdAt: true,
      updatedAt: true,
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

export async function acceptMessageRequest(
  requestId: string,
  userId: string,
) {
  const request = await prisma.messageRequest.findUnique({
    where: {
      id: requestId,
    },
    select: {
      id: true,
      senderId: true,
      receiverId: true,
      status: true,
      receiver: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });

  if (!request) {
    return {
      status: "request_not_found" as const,
    };
  }

  if (request.receiverId !== userId) {
    return {
      status: "forbidden" as const,
    };
  }

  if (request.status !== "PENDING") {
    return {
      status: "request_not_pending" as const,
    };
  }

  const existingConversation =
    await prisma.conversation.findFirst({
      where: {
        AND: [
          {
            members: {
              some: {
                userId: request.senderId,
              },
            },
          },
          {
            members: {
              some: {
                userId: request.receiverId,
              },
            },
          },
        ],
      },
      select: {
        id: true,
      },
    });

  if (existingConversation) {
    return {
      status: "already_connected" as const,
    };
  }

  const result = await prisma.$transaction(
    async (tx) => {
      const conversation =
        await tx.conversation.create({
          data: {
            members: {
              create: [
                {
                  userId: request.senderId,
                },
                {
                  userId: request.receiverId,
                },
              ],
            },
          },
          select: {
            id: true,
            createdAt: true,
            updatedAt: true,
            members: {
              select: {
                id: true,
                userId: true,
                joinedAt: true,
              },
            },
          },
        });

      const updatedRequest =
        await tx.messageRequest.update({
          where: {
            id: request.id,
          },
          data: {
            status: "ACCEPTED",
            respondedAt: new Date(),
          },
          select: {
            id: true,
            senderId: true,
            receiverId: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            respondedAt: true,
          },
        });

      return {
        conversation,
        request: updatedRequest,
      };
    },
  );

  return {
    status: "accepted" as const,
    ...result,
    acceptedBy: request.receiver,
  };
}

export async function getAcceptedMessageRequestNotification(
  userId: string,
) {
  const request =
    await prisma.messageRequest.findFirst({
      where: {
        senderId: userId,
        status: "ACCEPTED",
        acceptedSeenAt: null,
        respondedAt: {
          not: null,
        },
      },
      orderBy: {
        respondedAt: "desc",
      },
      select: {
        id: true,
        senderId: true,
        receiverId: true,
        respondedAt: true,
        receiver: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

  if (!request || !request.respondedAt) {
    return null;
  }

  const conversation = await prisma.conversation.findFirst({
    where: {
      AND: [
        {
          members: {
            some: {
              userId: request.senderId,
            },
          },
        },
        {
          members: {
            some: {
              userId: request.receiverId,
            },
          },
        },
      ],
    },
    select: {
      id: true,
    },
  });

  if (!conversation) {
    return null;
  }

  return {
    requestId: request.id,
    conversationId: conversation.id,
    acceptedBy: request.receiver,
    respondedAt: request.respondedAt,
  };
}

export async function markAcceptedMessageRequestSeen(
  requestId: string,
  userId: string,
) {
  const request =
    await prisma.messageRequest.findUnique({
      where: {
        id: requestId,
      },
      select: {
        id: true,
        senderId: true,
        status: true,
      },
    });

  if (!request) {
    return {
      status: "request_not_found" as const,
    };
  }

  if (request.senderId !== userId) {
    return {
      status: "forbidden" as const,
    };
  }

  if (request.status !== "ACCEPTED") {
    return {
      status: "request_not_accepted" as const,
    };
  }

  await prisma.messageRequest.update({
    where: {
      id: request.id,
    },
    data: {
      acceptedSeenAt: new Date(),
    },
  });

  return {
    status: "seen" as const,
  };
}

export async function rejectMessageRequest(
  requestId: string,
  userId: string,
) {
  const request = await prisma.messageRequest.findUnique({
    where: {
      id: requestId,
    },
    select: {
      id: true,
      receiverId: true,
      status: true,
    },
  });

  if (!request) {
    return {
      status: "request_not_found" as const,
    };
  }

  if (request.receiverId !== userId) {
    return {
      status: "forbidden" as const,
    };
  }

  if (request.status !== "PENDING") {
    return {
      status: "request_not_pending" as const,
    };
  }

  const updatedRequest =
    await prisma.messageRequest.update({
      where: {
        id: request.id,
      },
      data: {
        status: "REJECTED",
        respondedAt: new Date(),
      },
      select: {
        id: true,
        senderId: true,
        receiverId: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        respondedAt: true,
      },
    });

  return {
    status: "rejected" as const,
    request: updatedRequest,
  };
}
