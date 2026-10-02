const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  "http://localhost:5000/api";

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
  createdAt: string;
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
  sender: MessageSender;
}

interface MessagesResponse {
  items: Message[];
  nextCursor: string | null;
}

interface MessagesApiResponse {
  items?: Message[];
  nextCursor?: string | null;
  messages?: {
    items?: Message[];
    nextCursor?: string | null;
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

  return {
    items: messagePayload.items ?? [],
    nextCursor:
      messagePayload.nextCursor ?? null,
  };
}

export interface CreateMessageResponse {
  message: Message;
}

export async function sendConversationMessage(
  conversationId: string,
  content: string,
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
      }),
    },
  );

  if (!response.ok) {
    throw new Error("Unable to send message");
  }

  return response.json();
}