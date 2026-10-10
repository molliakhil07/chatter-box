const configuredApiBaseUrl =
  typeof import.meta.env.VITE_API_URL === "string"
    ? import.meta.env.VITE_API_URL.trim()
    : "";

const API_BASE_URL =
  import.meta.env.DEV
    ? `${window.location.protocol}//${window.location.hostname}:5000/api`
    : configuredApiBaseUrl || "/api";

/* ---------------- AUTH ---------------- */

export async function checkServerHealth() {
  const response = await fetch(`${API_BASE_URL}/health`);

  if (!response.ok) {
    throw new Error("Server health check failed");
  }

  return response.json();
}

export interface CurrentUser {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  gender: "MALE" | "FEMALE";
  bio: string | null;
  createdAt: string;
}

export interface PublicUserProfile {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
}

interface CurrentUserResponse {
  user: CurrentUser;
}

export async function getCurrentUser(): Promise<CurrentUserResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Not authenticated");
  }

  return response.json();
}

export async function registerAccount(input: {
  username: string;
  email: string;
  password: string;
  displayName: string;
  gender: "MALE" | "FEMALE";
  termsAccepted: true;
  privacyPolicyAcknowledged: true;
}): Promise<{ verificationRequired: boolean; email: string }> {
  const response = await fetch(
    `${API_BASE_URL}/auth/register`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      typeof body?.error === "string"
        ? body.error
        : "Unable to create account",
    );
  }

  return {
    verificationRequired: body?.verificationRequired === true,
    email:
      typeof body?.email === "string"
        ? body.email
        : input.email,
  };
}

export async function verifyEmail(
  token: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/auth/verify-email?token=${encodeURIComponent(token)}`,
  );

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      typeof body?.error === "string"
        ? body.error
        : "Unable to verify email",
    );
  }
}

export async function resendVerificationEmail(
  email: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/auth/resend-verification`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    },
  );

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      typeof body?.error === "string"
        ? body.error
        : "Unable to resend verification email",
    );
  }
}

export async function requestPasswordReset(
  email: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/auth/forgot-password`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    },
  );

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      typeof body?.error === "string"
        ? body.error
        : "Unable to process password reset request",
    );
  }
}

export async function resetPassword(
  token: string,
  password: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/auth/reset-password`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token, password }),
    },
  );

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      typeof body?.error === "string"
        ? body.error
        : "Unable to reset password",
    );
  }
}

export async function deleteCurrentUserAccount(): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/auth/me`,
    {
      method: "DELETE",
      credentials: "include",
    },
  );

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      typeof body?.error === "string"
        ? body.error
        : "Unable to delete account",
    );
  }
}

export async function updateCurrentUserProfile(input: {
  displayName?: string | null;
  bio?: string | null;
}): Promise<CurrentUser> {
  const response = await fetch(
    `${API_BASE_URL}/auth/me`,
    {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      typeof body?.error === "string"
        ? body.error
        : "Unable to update profile",
    );
  }

  return body.user as CurrentUser;
}

export async function getUserProfile(
  userId: string,
): Promise<PublicUserProfile> {
  const response = await fetch(
    `${API_BASE_URL}/users/${encodeURIComponent(userId)}/profile`,
    {
      credentials: "include",
    },
  );

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      typeof body?.error === "string"
        ? body.error
        : "Unable to load user profile",
    );
  }

  return body.user as PublicUserProfile;
}

/* ---------------- CONVERSATIONS ---------------- */

export interface ConversationUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface ConversationMember {
  userId: string;
  joinedAt: string;
  user: ConversationUser;
}

export interface Conversation {
  id: string;
  createdAt: string;
  updatedAt: string;
  members: ConversationMember[];
}

interface ConversationsResponse {
  conversations: Conversation[];
}

export async function getConversations(): Promise<ConversationsResponse> {
  const response = await fetch(
    `${API_BASE_URL}/conversations`,
    {
      credentials: "include",
    },
  );

  if (!response.ok) {
    throw new Error("Unable to load conversations");
  }

  return response.json();
}

export async function deleteConversation(
  conversationId: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/conversations/${conversationId}`,
    {
      method: "DELETE",
      credentials: "include",
    },
  );

  if (!response.ok) {
    throw new Error("Unable to delete conversation");
  }
}

/* ---------------- MESSAGES ---------------- */

export interface MessageSender {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  replyToMessageId: string | null;
  replyToMessage: RepliedMessage | null;
  sender: MessageSender;
}

export interface RepliedMessage {
  id: string;
  content: string;
  deletedAt: string | null;
  sender: MessageSender;
}

interface MessagesResponse {
  items: Message[];
  nextCursor: string | null;
  readMessageIds: string[];
}

interface MessagesApiResponse {
  items?: Message[];
  nextCursor?: string | null;
  readMessageIds?: string[];
  messages?:
    | Message[]
    | {
        items?: Message[];
        nextCursor?: string | null;
        readMessageIds?: string[];
      };
}

export async function getConversationMessages(
  conversationId: string,
  cursor?: string,
): Promise<MessagesResponse> {
  const url = new URL(
    `${API_BASE_URL}/conversations/${conversationId}/messages`,
  );

  if (cursor) {
    url.searchParams.set("cursor", cursor);
  }

  const response = await fetch(url.toString(), {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Unable to load messages");
  }

  const data =
    (await response.json()) as MessagesApiResponse;

  /*
   * The production API currently returns the message
   * pagination payload inside a `messages` object:
   *
   * {
   *   messages: {
   *     items: [...],
   *     nextCursor: ...
   *   }
   * }
   *
   * Keep the client normalized to the shape expected
   * by App.tsx. Also accept the direct shape so the
   * client remains compatible with the local API.
   */
  const messagePayload =
    data.messages ?? data;

  if (Array.isArray(messagePayload)) {
    return {
      items: messagePayload,
      nextCursor: null,
      readMessageIds: [],
    };
  }

  return {
    items: messagePayload.items ?? [],
    nextCursor:
      messagePayload.nextCursor ?? null,
    readMessageIds:
      messagePayload.readMessageIds ?? [],
  };
}

export async function clearConversationHistory(
  conversationId: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/conversations/${conversationId}/messages`,
    {
      method: "DELETE",
      credentials: "include",
    },
  );

  if (!response.ok) {
    throw new Error("Unable to clear conversation history");
  }
}

export interface CreateMessageResponse {
  message: Message;
}

export async function sendConversationMessage(
  conversationId: string,
  content: string,
  replyToMessageId?: string,
): Promise<CreateMessageResponse> {
  const response = await fetch(
    `${API_BASE_URL}/conversations/${conversationId}/messages`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content,
        ...(replyToMessageId
          ? { replyToMessageId }
          : {}),
      }),
    },
  );

  if (!response.ok) {
    throw new Error("Unable to send message");
  }

  return response.json();
}

export type UpdateMessageAction = "edit" | "delete";

export interface UpdateMessageResponse {
  message: Message;
}

export async function updateMessage(
  messageId: string,
  action: UpdateMessageAction,
  content?: string,
): Promise<UpdateMessageResponse> {
  const response = await fetch(
    `${API_BASE_URL}/messages/${messageId}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
        ...(action === "edit" ? { content } : {}),
      }),
    },
  );

  if (!response.ok) {
    throw new Error("Unable to update message");
  }

  return response.json();
}
