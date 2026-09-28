import argon2 from "argon2";

import { prisma } from "../config/prisma";

type RegisterUserInput = {
  username: string;
  email: string;
  password: string;
  displayName?: string;
};

export async function registerUser(
  input: RegisterUserInput,
) {
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        {
          username: input.username,
        },
        {
          email: input.email,
        },
      ],
    },
    select: {
      id: true,
    },
  });

  if (existingUser) {
    throw new Error(
      "Username or email is already registered",
    );
  }

  const passwordHash = await argon2.hash(
    input.password,
    {
      type: argon2.argon2id,
    },
  );

  return prisma.user.create({
    data: {
      username: input.username,
      email: input.email,
      passwordHash,
      displayName:
        input.displayName?.trim() || null,
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
}

export async function searchUsers(
  currentUserId: string,
  search?: string,
) {
  const normalizedSearch = search?.trim() ?? "";

  const users = await prisma.user.findMany({
    where: {
      id: {
        not: currentUserId,
      },

      ...(normalizedSearch
        ? {
            OR: [
              {
                username: {
                  contains: normalizedSearch,
                  mode: "insensitive",
                },
              },
              {
                displayName: {
                  contains: normalizedSearch,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    },

    orderBy: [
      {
        displayName: "asc",
      },
      {
        username: "asc",
      },
    ],

    take: 20,

    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
    },
  });

  if (users.length === 0) {
    return users;
  }

  const userIds = users.map((user) => user.id);

  /*
   * Determine the relationship between the signed-in user
   * and each search result.
   *
   * CONNECTED:
   * Both users belong to the same conversation.
   *
   * REQUEST_PENDING:
   * A pending request exists in either direction.
   *
   * REQUESTABLE:
   * Neither relationship exists yet.
   *
   * This is server-derived state. The frontend only uses it
   * to present the correct UI and must not rely on it for
   * authorization.
   */
  const currentUserMemberships =
    await prisma.conversationMember.findMany({
      where: {
        userId: currentUserId,
      },
      select: {
        conversationId: true,
      },
    });

  const conversationIds =
    currentUserMemberships.map(
      (membership) => membership.conversationId,
    );

  const connectedMembers =
    conversationIds.length > 0
      ? await prisma.conversationMember.findMany({
          where: {
            conversationId: {
              in: conversationIds,
            },
            userId: {
              in: userIds,
            },
          },
          select: {
            conversationId: true,
            userId: true,
          },
        })
      : [];

  const connectedUserIds = new Set(
    connectedMembers.map(
      (member) => member.userId,
    ),
  );

  const pendingRequests =
    await prisma.messageRequest.findMany({
      where: {
        status: "PENDING",
        OR: [
          {
            senderId: currentUserId,
            receiverId: {
              in: userIds,
            },
          },
          {
            receiverId: currentUserId,
            senderId: {
              in: userIds,
            },
          },
        ],
      },
      select: {
        senderId: true,
        receiverId: true,
      },
    });

  const pendingRequestUserIds = new Set(
    pendingRequests.map((request) =>
      request.senderId === currentUserId
        ? request.receiverId
        : request.senderId,
    ),
  );

  return users.map((user) => ({
    ...user,
    relationshipState: connectedUserIds.has(user.id)
      ? "CONNECTED"
      : pendingRequestUserIds.has(user.id)
        ? "REQUEST_PENDING"
        : "REQUESTABLE",
  }));
}
