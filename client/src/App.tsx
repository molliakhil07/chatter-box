import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  getConversationMessages,
  getConversations,
  getCurrentUser,
  sendConversationMessage,
  updateMessage,
  type Conversation,
  type CurrentUser,
  type Message,
} from "./services/api";
import {
  login,
  logout,
  register,
} from "./services/auth";
import {
  connectSocket,
} from "./services/socket";

const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  "http://localhost:5000/api";

type MessageStatus =
  | "sent"
  | "delivered"
  | "read";

type MessageStatusPayload = {
  messageId: string;
  status: MessageStatus;
};

type DiscoverableUser = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  relationshipState:
    | "CONNECTED"
    | "REQUEST_PENDING"
    | "REQUESTABLE";
};

type MessageRequest = {
  id: string;
  senderId: string;
  receiverId: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  createdAt: string;
  updatedAt: string;
  sender: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
};

type AcceptedRequestNotification = {
  requestId: string;
  conversationId: string;
  acceptedBy: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  respondedAt: string;
};

function formatConversationTime(
  updatedAt: string,
): string {
  const date = new Date(updatedAt);
  const now = new Date();

  const differenceMs =
    now.getTime() - date.getTime();

  const differenceMinutes = Math.floor(
    differenceMs / (1000 * 60),
  );

  if (differenceMinutes < 1) {
    return "Just now";
  }

  if (differenceMinutes < 60) {
    return `${differenceMinutes}m`;
  }

  const differenceHours = Math.floor(
    differenceMinutes / 60,
  );

  if (differenceHours < 24) {
    return `${differenceHours}h`;
  }

  const differenceDays = Math.floor(
    differenceHours / 24,
  );

  if (differenceDays < 7) {
    return `${differenceDays}d`;
  }

  return date.toLocaleDateString();
}

function formatMessageRequestTime(
  createdAt: string,
): string {
  const date = new Date(createdAt);
  const now = new Date();

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const differenceMs = Math.max(
    0,
    now.getTime() - date.getTime(),
  );

  const differenceMinutes = Math.floor(
    differenceMs / (1000 * 60),
  );

  if (differenceMinutes < 1) {
    return "Just now";
  }

  if (differenceMinutes < 60) {
    return `${differenceMinutes}m`;
  }

  const differenceHours = Math.floor(
    differenceMinutes / 60,
  );

  if (differenceHours < 24) {
    return `${differenceHours}h`;
  }

  const differenceDays = Math.floor(
    differenceHours / 24,
  );

  if (differenceDays < 7) {
    return `${differenceDays}d`;
  }

  return date.toLocaleDateString([], {
    day: "numeric",
    month: "short",
  });
}

function App() {
  const [user, setUser] =
    useState<CurrentUser | null>(null);

  const [conversations, setConversations] =
    useState<Conversation[]>([]);

  const [conversationSearch, setConversationSearch] =
    useState("");

  const [authLoading, setAuthLoading] =
    useState(true);

  const [conversationsLoading, setConversationsLoading] =
    useState(false);

  const [authError, setAuthError] =
    useState(false);

  const [authMode, setAuthMode] =
    useState<"login" | "register">("login");

  const [authIdentity, setAuthIdentity] =
    useState("");

  const [authEmail, setAuthEmail] =
    useState("");

  const [authUsername, setAuthUsername] =
    useState("");

  const [authDisplayName, setAuthDisplayName] =
    useState("");

  const [authPassword, setAuthPassword] =
    useState("");

  const [authSubmitting, setAuthSubmitting] =
    useState(false);

  const [authFormError, setAuthFormError] =
    useState("");

  const [conversationError, setConversationError] =
    useState(false);

  const [selectedConversationId, setSelectedConversationId] =
    useState<string | null>(null);

  const [profileOpen, setProfileOpen] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(false);

  /*
   * 5D-1 notification indicator state.
   *
   * This stays false until the real incoming-request API is connected
   * in 5D-3. No fake notification count is shown.
   */
  const [hasPendingMessageRequests, setHasPendingMessageRequests] =
    useState(false);

  const [messageRequests, setMessageRequests] =
    useState<MessageRequest[]>([]);
  const [messageRequestsLoading, setMessageRequestsLoading] =
    useState(false);
  const [messageRequestsError, setMessageRequestsError] =
    useState(false);
  const [acceptingMessageRequestId, setAcceptingMessageRequestId] =
    useState<string | null>(null);
  const [messageRequestActionError, setMessageRequestActionError] =
    useState("");

  const [
    acceptedRequestNotification,
    setAcceptedRequestNotification,
  ] = useState<AcceptedRequestNotification | null>(null);
  const [acceptedRequestNotificationLoading, setAcceptedRequestNotificationLoading] =
    useState(false);

  /*
   * 5A user discovery state.
   * New Chat discovers permitted users only.
   */
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [discoverableUsers, setDiscoverableUsers] =
    useState<DiscoverableUser[]>([]);
  const [userSearchLoading, setUserSearchLoading] =
    useState(false);
  const [userSearchError, setUserSearchError] =
    useState(false);
  const [selectedUser, setSelectedUser] =
    useState<DiscoverableUser | null>(null);
  const [sendingMessageRequest, setSendingMessageRequest] =
    useState(false);
  const [messageRequestError, setMessageRequestError] =
    useState("");
  const [messageRequestSent, setMessageRequestSent] =
    useState(false);

  const [messages, setMessages] =
    useState<Message[]>([]);

  const [messageInput, setMessageInput] =
    useState("");

  const [sendingMessage, setSendingMessage] =
    useState(false);

  const [sendMessageError, setSendMessageError] =
    useState(false);

  const [messagesLoading, setMessagesLoading] =
    useState(false);

  const [messagesError, setMessagesError] =
    useState(false);

  const [nextCursor, setNextCursor] =
    useState<string | null>(null);

  const [loadingOlderMessages, setLoadingOlderMessages] =
    useState(false);

  /*
   * 4G message status state.
   *
   * The message object itself remains the
   * backend source of truth. Status is kept
   * separately because the current Message
   * type does not contain a status field.
   */
  const [messageStatuses, setMessageStatuses] =
    useState<Record<string, MessageStatus>>({});

  /*
   * Unread/new-message state for conversations that are
   * not currently open. The count is realtime UI state.
   */
  const [unreadCounts, setUnreadCounts] =
    useState<Record<string, number>>({});

  /*
   * 7B-4A message actions UI state.
   *
   * Only one message menu can be open at a time.
   * Action behavior is intentionally added in 7B-4B/4C/4D.
   */
  const [openMessageActionId, setOpenMessageActionId] =
    useState<string | null>(null);

  /*
   * 7B-4B message editing state.
   */
  const [editingMessageId, setEditingMessageId] =
    useState<string | null>(null);
  const [editingMessageContent, setEditingMessageContent] =
    useState("");
  const [updatingMessage, setUpdatingMessage] =
    useState(false);
  const [messageUpdateError, setMessageUpdateError] =
    useState("");

  /*
   * 7B-4C message deletion state.
   */
  const [deletingMessageId, setDeletingMessageId] =
    useState<string | null>(null);
  const [deletingMessage, setDeletingMessage] =
    useState(false);

  /*
   * 7B-4D reply state.
   */
  const [replyingToMessage, setReplyingToMessage] =
    useState<Message | null>(null);

  const [highlightedMessageId, setHighlightedMessageId] =
    useState<string | null>(null);

  const messageListRef =
    useRef<HTMLDivElement | null>(null);

  const messageHighlightTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  /*
   * 4G-4 read tracking state.
   *
   * A message is marked as read once it is visibly
   * inside the active conversation viewport. The ref
   * prevents duplicate message_read events.
   */
  const readMessageIdsRef =
    useRef<Set<string>>(new Set());

  function markVisibleMessagesAsRead() {
    const conversationId =
      selectedConversationId;

    if (!conversationId || !user) {
      return;
    }

    const messageList =
      messageListRef.current;

    if (!messageList) {
      return;
    }

    const listRect =
      messageList.getBoundingClientRect();

    const messageElements =
      messageList.querySelectorAll<HTMLElement>(
        "[data-message-id][data-message-sender-id]",
      );

    const socket = connectSocket();

    messageElements.forEach((element) => {
      const messageId =
        element.dataset.messageId;
      const senderId =
        element.dataset.messageSenderId;

      if (!messageId || !senderId) {
        return;
      }

      if (senderId === user.id) {
        return;
      }

      if (readMessageIdsRef.current.has(messageId)) {
        return;
      }

      const messageRect =
        element.getBoundingClientRect();

      const isVisible =
        messageRect.bottom > listRect.top &&
        messageRect.top < listRect.bottom;

      if (!isVisible) {
        return;
      }

      readMessageIdsRef.current.add(messageId);

      socket.emit(
        "message_read",
        conversationId,
        messageId,
        (response: {
          ok: boolean;
          messageId?: string;
          error?: string;
        }) => {
          if (!response.ok) {
            readMessageIdsRef.current.delete(
              messageId,
            );
          }
        },
      );
    });
  }

  /*
   * Restore the existing authenticated session.
   * Conversation loading happens separately after
   * a user is available, including immediately after
   * a successful login or registration.
   */
  useEffect(() => {
    async function restoreSession() {
      try {
        const userResponse =
          await getCurrentUser();

        setUser(userResponse.user);
        setAuthError(false);
      } catch {
        setUser(null);
        setAuthError(true);
      } finally {
        setAuthLoading(false);
      }
    }

    restoreSession();
  }, []);

  /*
   * Load conversations whenever authentication becomes
   * available. This also runs after a fresh login.
   */
  useEffect(() => {
    if (!user) {
      setConversations([]);
      setConversationError(false);
      setConversationsLoading(false);
      return;
    }

    let cancelled = false;

    async function loadConversations() {
      setConversationsLoading(true);
      setConversationError(false);

      try {
        const conversationResponse =
          await getConversations();

        if (!cancelled) {
          setConversations(
            conversationResponse.conversations,
          );
        }
      } catch {
        if (!cancelled) {
          setConversationError(true);
        }
      } finally {
        if (!cancelled) {
          setConversationsLoading(false);
        }
      }
    }

    loadConversations();

    return () => {
      cancelled = true;
    };
  }, [user]);

  /*
   * Establish authenticated Socket.IO connection.
   */
  useEffect(() => {
    if (!user) {
      return;
    }

    const socket = connectSocket();

    function handleConnect() {
      console.log(
        "Chatter Box realtime connection established",
      );
    }

    function handleDisconnect(
      reason: string,
    ) {
      console.log(
        "Chatter Box realtime connection closed:",
        reason,
      );
    }

    socket.on(
      "connect",
      handleConnect,
    );

    socket.on(
      "disconnect",
      handleDisconnect,
    );

    return () => {
      socket.off(
        "connect",
        handleConnect,
      );

      socket.off(
        "disconnect",
        handleDisconnect,
      );
    };
  }, [user]);

  /*
   * Receive new-message events at the user level as well as
   * inside the active conversation room. This keeps the
   * conversation list updated even when the chat is closed.
   */
  useEffect(() => {
    if (!user) {
      return;
    }

    const socket = connectSocket();

    const currentUserId = user.id;

    function handleConversationListMessage(payload: {
      conversationId: string;
      message: Message;
    }) {
      if (
        !payload ||
        typeof payload.conversationId !== "string" ||
        !payload.message
      ) {
        return;
      }

      const conversationId = payload.conversationId;
      const message = payload.message;
      const isOwnMessage = message.senderId === currentUserId;
      const isCurrentConversation =
        selectedConversationId === conversationId;

      setConversations((currentConversations) => {
        const existingConversation = currentConversations.find(
          (conversation) => conversation.id === conversationId,
        );

        if (!existingConversation) {
          return currentConversations;
        }

        const updatedConversation = {
          ...existingConversation,
          updatedAt: message.createdAt,
        };

        return [
          updatedConversation,
          ...currentConversations.filter(
            (conversation) => conversation.id !== conversationId,
          ),
        ];
      });

      if (!isOwnMessage && !isCurrentConversation) {
        setUnreadCounts((currentCounts) => ({
          ...currentCounts,
          [conversationId]:
            (currentCounts[conversationId] ?? 0) + 1,
        }));
      }
    }

    socket.on(
      "message_new",
      handleConversationListMessage,
    );

    return () => {
      socket.off(
        "message_new",
        handleConversationListMessage,
      );
    };
  }, [user, selectedConversationId]);

  useEffect(() => {
    return () => {
      if (messageHighlightTimeoutRef.current) {
        clearTimeout(messageHighlightTimeoutRef.current);
      }
    };
  }, []);

  /*
   * 7B-4A: close an open message-actions menu when
   * the user clicks anywhere outside the menu.
   */
  useEffect(() => {
    if (!openMessageActionId) {
      return;
    }

    function handleDocumentPointerDown() {
      setOpenMessageActionId(null);
    }

    document.addEventListener(
      "pointerdown",
      handleDocumentPointerDown,
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        handleDocumentPointerDown,
      );
    };
  }, [openMessageActionId]);

  /*
   * Join selected conversation room,
   * receive realtime messages,
   * receive message status updates.
   */
  useEffect(() => {
    const conversationId =
      selectedConversationId ?? "";

    if (!conversationId) {
      return;
    }

    const socket = connectSocket();

    function handleNewMessage(payload: {
      conversationId: string;
      message: Message;
    }) {
      if (
        payload.conversationId !==
        conversationId
      ) {
        return;
      }

      setMessages(
        (currentMessages) => {
          const messageAlreadyExists =
            currentMessages.some(
              (message) =>
                message.id ===
                payload.message.id,
            );

          if (messageAlreadyExists) {
            return currentMessages;
          }

          return [
            ...currentMessages,
            payload.message,
          ];
        },
      );

      /*
       * The message has reached the realtime
       * transport and is therefore delivered
       * from the sender's perspective.
       */
      if (
        payload.message.senderId ===
        user?.id
      ) {
        setMessageStatuses(
          (currentStatuses) => ({
            ...currentStatuses,
            [payload.message.id]:
              "delivered",
          }),
        );
      }

      requestAnimationFrame(() => {
        const messageList =
          messageListRef.current;

        if (messageList) {
          messageList.scrollTop =
            messageList.scrollHeight;
        }

        markVisibleMessagesAsRead();
      });
    }

    function handleMessageUpdated(payload: {
      conversationId: string;
      message: Message;
    }) {
      if (
        !payload ||
        payload.conversationId !== conversationId ||
        !payload.message
      ) {
        return;
      }

      setMessages((currentMessages) =>
        currentMessages.map((message) => {
          if (message.id === payload.message.id) {
            return payload.message;
          }

          if (message.replyToMessageId === payload.message.id && message.replyToMessage) {
            return {
              ...message,
              replyToMessage: {
                ...message.replyToMessage,
                content: payload.message.content,
                deletedAt: payload.message.deletedAt,
              },
            };
          }

          return message;
        }),
      );

      if (payload.message.deletedAt) {
        setReplyingToMessage((currentReply) =>
          currentReply?.id === payload.message.id
            ? {
                ...currentReply,
                content: payload.message.content,
                deletedAt: payload.message.deletedAt,
              }
            : currentReply,
        );

        setMessageStatuses((currentStatuses) => {
          if (!(payload.message.id in currentStatuses)) {
            return currentStatuses;
          }

          const updatedStatuses = { ...currentStatuses };
          delete updatedStatuses[payload.message.id];
          return updatedStatuses;
        });
      }
    }

    function handleMessageStatus(
      payload: MessageStatusPayload,
    ) {
      if (
        !payload ||
        typeof payload.messageId !==
          "string"
      ) {
        return;
      }

      if (
        payload.status !== "sent" &&
        payload.status !== "delivered" &&
        payload.status !== "read"
      ) {
        return;
      }

      setMessageStatuses(
        (currentStatuses) => {
          const currentStatus =
            currentStatuses[
              payload.messageId
            ];

          /*
           * Never allow a realtime event to
           * move a message backwards.
           */
          if (
            currentStatus === "read"
          ) {
            return currentStatuses;
          }

          if (
            currentStatus === "delivered" &&
            payload.status === "sent"
          ) {
            return currentStatuses;
          }

          return {
            ...currentStatuses,
            [payload.messageId]:
              payload.status,
          };
        },
      );
    }

    socket.on(
      "message_new",
      handleNewMessage,
    );

    socket.on(
      "message_status",
      handleMessageStatus,
    );

    socket.on(
      "message_updated",
      handleMessageUpdated,
    );

    socket.emit(
      "conversation:join",
      conversationId,
      (response: {
        ok: boolean;
        conversationId?: string;
        error?: string;
      }) => {
        if (response.ok) {
          console.log(
            "Joined Chatter Box conversation room:",
            response.conversationId,
          );
        } else {
          console.error(
            "Failed to join Chatter Box conversation room:",
            response.error,
          );
        }
      },
    );

    return () => {
      socket.off(
        "message_new",
        handleNewMessage,
      );

      socket.off(
        "message_status",
        handleMessageStatus,
      );

      socket.off(
        "message_updated",
        handleMessageUpdated,
      );

      socket.emit(
        "conversation:leave",
        conversationId,
        (response: {
          ok: boolean;
          conversationId?: string;
          error?: string;
        }) => {
          if (response.ok) {
            console.log(
              "Left Chatter Box conversation room:",
              response.conversationId,
            );
          } else {
            console.error(
              "Failed to leave Chatter Box conversation room:",
              response.error,
            );
          }
        },
      );
    };
  }, [
    selectedConversationId,
    user?.id,
  ]);

  /*
   * Load messages whenever the selected
   * conversation changes.
   */
  useEffect(() => {
    const conversationId =
      selectedConversationId;

    if (!conversationId) {
      setMessages([]);
      setMessagesError(false);
      setNextCursor(null);
      setMessageStatuses({});
      readMessageIdsRef.current.clear();
      return;
    }

    setMessages([]);
    setMessagesError(false);
    setNextCursor(null);
    setMessageStatuses({});
    readMessageIdsRef.current.clear();
    setOpenMessageActionId(null);
    setEditingMessageId(null);
    setEditingMessageContent("");
    setMessageUpdateError("");

    async function loadMessages() {
      setMessagesLoading(true);
      setMessagesError(false);

      try {
        const response =
          await getConversationMessages(
            conversationId!,
          );

        const loadedMessages =
          [...response.items].reverse();

        setMessages(
          loadedMessages,
        );

        /*
         * Existing own messages have at
         * least been persisted successfully.
         * Until a realtime delivery event is
         * observed, keep them at sent.
         */
        const initialStatuses: Record<
          string,
          MessageStatus
        > = {};

        for (
          const message of loadedMessages
        ) {
          if (
            message.senderId ===
            user?.id
          ) {
            initialStatuses[
              message.id
            ] = "sent";
          }
        }

        setMessageStatuses(
          initialStatuses,
        );

        setNextCursor(
          response.nextCursor,
        );

        requestAnimationFrame(() => {
          const messageList =
            messageListRef.current;

          if (messageList) {
            messageList.scrollTop =
              messageList.scrollHeight;
          }

          markVisibleMessagesAsRead();
        });
      } catch {
        setMessagesError(true);
        setMessages([]);
        setMessageStatuses({});
      } finally {
        setMessagesLoading(false);
      }
    }

    loadMessages();
  }, [
    selectedConversationId,
    user?.id,
  ]);

  /*
   * 4G-4: mark incoming messages that are visible
   * in the active conversation as read after render.
   */
  useEffect(() => {
    if (!selectedConversationId || !messages.length) {
      return;
    }

    const frameId =
      requestAnimationFrame(() => {
        markVisibleMessagesAsRead();
      });

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [
    selectedConversationId,
    messages,
  ]);

  /*
   * Keep the mobile composer visible when the on-screen
   * keyboard changes the visual viewport. This does not
   * move the message history; it only lets the browser
   * keep the focused input in view.
   */
  useEffect(() => {
    if (!selectedConversationId) {
      return;
    }

    const viewport = window.visualViewport;

    if (!viewport) {
      return;
    }

    const handleViewportResize = () => {
      const composer =
        document.querySelector<HTMLTextAreaElement>(
          ".message-composer textarea:focus",
        );

      if (!composer) {
        return;
      }

      requestAnimationFrame(() => {
        composer.scrollIntoView({
          block: "nearest",
          inline: "nearest",
        });
      });
    };

    viewport.addEventListener(
      "resize",
      handleViewportResize,
    );

    return () => {
      viewport.removeEventListener(
        "resize",
        handleViewportResize,
      );
    };
  }, [selectedConversationId]);

  /*
   * Load older messages using cursor pagination.
   */
  async function loadOlderMessages() {
    const conversationId =
      selectedConversationId ?? "";

    if (
      !conversationId ||
      !nextCursor ||
      loadingOlderMessages
    ) {
      return;
    }

    const cursor =
      nextCursor;

    const messageList =
      messageListRef.current;

    if (!messageList) {
      return;
    }

    const previousScrollHeight =
      messageList.scrollHeight;

    const previousScrollTop =
      messageList.scrollTop;

    setLoadingOlderMessages(true);

    try {
      const response =
        await getConversationMessages(
          conversationId,
          cursor,
        );

      const olderMessages =
        [...response.items].reverse();

      setMessages(
        (currentMessages) => [
          ...olderMessages,
          ...currentMessages,
        ],
      );

      /*
       * Add status entries for older own
       * messages without replacing statuses
       * already known for newer messages.
       */
      setMessageStatuses(
        (currentStatuses) => {
          const updatedStatuses = {
            ...currentStatuses,
          };

          for (
            const message of olderMessages
          ) {
            if (
              message.senderId ===
              user?.id &&
              !updatedStatuses[
                message.id
              ]
            ) {
              updatedStatuses[
                message.id
              ] = "sent";
            }
          }

          return updatedStatuses;
        },
      );

      setNextCursor(
        response.nextCursor,
      );

      requestAnimationFrame(() => {
        const updatedMessageList =
          messageListRef.current;

        if (!updatedMessageList) {
          return;
        }

        const newScrollHeight =
          updatedMessageList.scrollHeight;

        updatedMessageList.scrollTop =
          newScrollHeight -
          previousScrollHeight +
          previousScrollTop;

        markVisibleMessagesAsRead();
      });
    } catch {
      setMessagesError(true);
    } finally {
      setLoadingOlderMessages(false);
    }
  }

  function startEditingMessage(message: Message) {
    if (message.deletedAt || message.senderId !== user?.id) {
      return;
    }

    setOpenMessageActionId(null);
    setMessageUpdateError("");
    setEditingMessageId(message.id);
    setEditingMessageContent(message.content);

    requestAnimationFrame(() => {
      const composer = document.querySelector<HTMLTextAreaElement>(
        ".message-composer textarea",
      );

      composer?.focus();
      composer?.setSelectionRange(
        composer.value.length,
        composer.value.length,
      );
    });
  }

  function cancelEditingMessage() {
    setEditingMessageId(null);
    setEditingMessageContent("");
    setMessageUpdateError("");
  }

  function startReplyingToMessage(message: Message) {
    setOpenMessageActionId(null);
    setMessageUpdateError("");

    if (editingMessageId) {
      cancelEditingMessage();
    }

    setReplyingToMessage(message);

    requestAnimationFrame(() => {
      const composer = document.querySelector<HTMLTextAreaElement>(
        ".message-composer textarea",
      );

      composer?.focus();
    });
  }

  function cancelReplyingToMessage() {
    if (sendingMessage) {
      return;
    }

    setReplyingToMessage(null);
  }

  function scrollToMessage(messageId: string) {
    const messageElement = document.querySelector<HTMLElement>(
      `[data-message-id="${messageId}"]`,
    );

    if (!messageElement) {
      return;
    }

    messageElement.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    setHighlightedMessageId(messageId);

    if (messageHighlightTimeoutRef.current) {
      clearTimeout(messageHighlightTimeoutRef.current);
    }

    messageHighlightTimeoutRef.current = setTimeout(() => {
      setHighlightedMessageId(null);
      messageHighlightTimeoutRef.current = null;
    }, 1400);
  }

  async function handleDeleteMessage() {
    const messageId = deletingMessageId;

    if (!messageId || deletingMessage) {
      return;
    }

    setDeletingMessage(true);
    setMessageUpdateError("");

    try {
      const response = await updateMessage(
        messageId,
        "delete",
      );

      setMessages((currentMessages) =>
        currentMessages.map((message) => {
          if (message.id === response.message.id) {
            return response.message;
          }

          if (message.replyToMessageId === response.message.id && message.replyToMessage) {
            return {
              ...message,
              replyToMessage: {
                ...message.replyToMessage,
                content: response.message.content,
                deletedAt: response.message.deletedAt,
              },
            };
          }

          return message;
        }),
      );

      setMessageStatuses((currentStatuses) => {
        if (!(messageId in currentStatuses)) {
          return currentStatuses;
        }

        const updatedStatuses = { ...currentStatuses };
        delete updatedStatuses[messageId];
        return updatedStatuses;
      });

      setDeletingMessageId(null);
      setOpenMessageActionId(null);

      if (editingMessageId === messageId) {
        cancelEditingMessage();
      }
    } catch {
      setMessageUpdateError(
        "Unable to delete message. Please try again.",
      );
    } finally {
      setDeletingMessage(false);
    }
  }

  function cancelDeleteMessage() {
    if (deletingMessage) {
      return;
    }

    setDeletingMessageId(null);
    setMessageUpdateError("");
  }

  async function handleSaveEditedMessage() {
    const messageId = editingMessageId;
    const content = editingMessageContent.trim();

    if (!messageId || !content || updatingMessage) {
      return;
    }

    setUpdatingMessage(true);
    setMessageUpdateError("");

    try {
      const response = await updateMessage(
        messageId,
        "edit",
        content,
      );

      setMessages((currentMessages) =>
        currentMessages.map((message) => {
          if (message.id === response.message.id) {
            return response.message;
          }

          if (
            message.replyToMessageId === response.message.id &&
            message.replyToMessage
          ) {
            return {
              ...message,
              replyToMessage: {
                ...message.replyToMessage,
                content: response.message.content,
                deletedAt: response.message.deletedAt,
              },
            };
          }

          return message;
        }),
      );

      if (response.message.deletedAt) {
        setReplyingToMessage((currentReply) =>
          currentReply?.id === response.message.id
            ? {
                ...currentReply,
                content: response.message.content,
                deletedAt: response.message.deletedAt,
              }
            : currentReply,
        );
      }

      setEditingMessageId(null);
      setEditingMessageContent("");
      setOpenMessageActionId(null);
    } catch {
      setMessageUpdateError("Unable to edit message. Please try again.");
    } finally {
      setUpdatingMessage(false);
    }
  }

  /*
   * Send a message through REST.
   */
  async function handleSendMessage() {
    const conversationId =
      selectedConversationId ?? "";

    const content =
      messageInput.trim();

    if (
      !conversationId ||
      !content ||
      sendingMessage
    ) {
      return;
    }

    setSendingMessage(true);
    setSendMessageError(false);

    try {
      const response =
        await sendConversationMessage(
          conversationId,
          content,
          replyingToMessage?.id,
        );

      setMessages(
        (currentMessages) => {
          const messageAlreadyExists =
            currentMessages.some(
              (message) =>
                message.id ===
                response.message.id,
            );

          if (messageAlreadyExists) {
            return currentMessages;
          }

          return [
            ...currentMessages,
            response.message,
          ];
        },
      );

      /*
       * REST persistence succeeded.
       * The message is therefore at least sent.
       */
      setMessageStatuses(
        (currentStatuses) => ({
          ...currentStatuses,
          [response.message.id]:
            "sent",
        }),
      );

      setMessageInput("");
      setReplyingToMessage(null);

      requestAnimationFrame(() => {
        const messageList =
          messageListRef.current;

        if (messageList) {
          messageList.scrollTop =
            messageList.scrollHeight;
        }
      });
    } catch {
      setSendMessageError(true);
    } finally {
      setSendingMessage(false);
    }
  }

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // The local authenticated state is still cleared below.
    } finally {
      setUser(null);
      setConversations([]);
      setConversationError(false);
      setSelectedConversationId(null);
      setProfileOpen(false);
      setMessages([]);
      setNextCursor(null);
      setMessageStatuses({});
      setReplyingToMessage(null);
      setOpenMessageActionId(null);
      setDeletingMessageId(null);
      cancelEditingMessage();
      setUnreadCounts({});
      setOpenMessageActionId(null);
      setEditingMessageId(null);
      setEditingMessageContent("");
      setMessageUpdateError("");
      setConversationSearch("");
      setAuthMode("login");
      setAuthPassword("");
      setAuthFormError("");
      setAuthError(false);
    }
  }

  async function handleAuthSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (authSubmitting) {
      return;
    }

    setAuthFormError("");
    setAuthSubmitting(true);

    try {
      if (authMode === "login") {
        await login(
          authIdentity.trim().replace(/^@/, ""),
          authPassword,
        );
        const currentUser =
          await getCurrentUser();

        setUser(currentUser.user);
        setAuthError(false);
        setAuthPassword("");
        setSelectedConversationId(null);
        setConversationSearch("");
        return;
      }

      await register({
        email: authEmail.trim(),
        username: authUsername.trim().replace(/^@/, ""),
        password: authPassword,
        displayName: authDisplayName.trim(),
      });

      /*
       * Registration and authentication are separate
       * API operations in the project contract.
       * If registration also establishes a session,
       * continue directly; otherwise switch to login.
       */
      try {
        const currentUser =
          await getCurrentUser();

        setUser(currentUser.user);
        setAuthError(false);
        setAuthPassword("");
        setSelectedConversationId(null);
        setConversationSearch("");
        return;
      } catch {
        setAuthMode("login");
        setAuthIdentity(authUsername.trim().replace(/^@/, ""));
        setAuthPassword("");
        setAuthFormError(
          "Account created. Sign in to continue.",
        );
      }
    } catch (error) {
      setAuthFormError(
        error instanceof Error
          ? error.message
          : "Unable to complete authentication. Please try again.",
      );
    } finally {
      setAuthSubmitting(false);
    }
  }

  useEffect(() => {
    if (!newChatOpen || !user) {
      return;
    }

    const query = userSearch.trim();

    // Do not load every registered user when New Chat opens.
    // User discovery only runs after the user enters a search term.
    if (!query) {
      setDiscoverableUsers([]);
      setUserSearchLoading(false);
      setUserSearchError(false);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setUserSearchLoading(true);
      setUserSearchError(false);

      try {
        const response = await fetch(
          `${API_BASE_URL}/users?search=${encodeURIComponent(query)}`,
          {
            credentials: "include",
          },
        );

        const body = await response.json();

        if (!response.ok) {
          throw new Error(
            typeof body?.error === "string"
              ? body.error
              : "Unable to find users",
          );
        }

        if (!cancelled) {
          setDiscoverableUsers(
            Array.isArray(body?.users) ? body.users : [],
          );
        }
      } catch {
        if (!cancelled) {
          setDiscoverableUsers([]);
          setUserSearchError(true);
        }
      } finally {
        if (!cancelled) {
          setUserSearchLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [newChatOpen, user, userSearch]);

  /*
   * 5D-3: load real incoming message requests.
   *
   * Pending requests are the only requests shown here.
   * The backend remains the source of truth.
   */
  useEffect(() => {
    if (!user) {
      setMessageRequests([]);
      setMessageRequestsError(false);
      setMessageRequestsLoading(false);
      setHasPendingMessageRequests(false);
      return;
    }

    let cancelled = false;

    async function loadIncomingMessageRequests() {
      setMessageRequestsLoading(true);
      setMessageRequestsError(false);

      try {
        const response = await fetch(
          `${API_BASE_URL}/message-requests/incoming`,
          {
            credentials: "include",
          },
        );

        const body = await response.json();

        if (!response.ok) {
          throw new Error(
            typeof body?.error === "string"
              ? body.error
              : "Unable to load message requests.",
          );
        }

        const requests = Array.isArray(body?.requests)
          ? body.requests
          : [];

        if (!cancelled) {
          setMessageRequests(requests);
          setHasPendingMessageRequests(requests.length > 0);
        }
      } catch {
        if (!cancelled) {
          setMessageRequests([]);
          setMessageRequestsError(true);
          setHasPendingMessageRequests(false);
        }
      } finally {
        if (!cancelled) {
          setMessageRequestsLoading(false);
        }
      }
    }

    loadIncomingMessageRequests();

    return () => {
      cancelled = true;
    };
  }, [user?.id, requestsOpen]);

  /*
   * 5D-4A: retrieve accepted message requests that the
   * sender has not acknowledged yet. This makes the
   * acceptance notification recoverable after reconnect/login.
   */
  useEffect(() => {
    if (!user) {
      setAcceptedRequestNotification(null);
      return;
    }

    let cancelled = false;

    async function loadAcceptedRequestNotification() {
      setAcceptedRequestNotificationLoading(true);

      try {
        const response = await fetch(
          `${API_BASE_URL}/message-requests/accepted`,
          {
            credentials: "include",
          },
        );

        const body = await response.json();

        if (!response.ok) {
          throw new Error(
            typeof body?.error === "string"
              ? body.error
              : "Unable to load accepted message requests.",
          );
        }

        const notification =
          body?.notification &&
          typeof body.notification.requestId === "string" &&
          typeof body.notification.conversationId === "string"
            ? body.notification
            : null;

        if (!cancelled) {
          setAcceptedRequestNotification(notification);
        }
      } catch {
        if (!cancelled) {
          setAcceptedRequestNotification(null);
        }
      } finally {
        if (!cancelled) {
          setAcceptedRequestNotificationLoading(false);
        }
      }
    }

    loadAcceptedRequestNotification();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  /*
   * 5D-4A realtime acceptance event.
   */
  useEffect(() => {
    if (!user) {
      return;
    }

    const socket = connectSocket();

    function handleRequestAccepted(
      payload: AcceptedRequestNotification,
    ) {
      if (
        !payload ||
        typeof payload.requestId !== "string" ||
        typeof payload.conversationId !== "string" ||
        !payload.acceptedBy
      ) {
        return;
      }

      setAcceptedRequestNotification(payload);
    }

    socket.on(
      "message_request_accepted",
      handleRequestAccepted,
    );

    return () => {
      socket.off(
        "message_request_accepted",
        handleRequestAccepted,
      );
    };
  }, [user?.id]);

  async function handleChatNowFromAcceptedRequest() {
    const notification = acceptedRequestNotification;

    if (!notification) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/message-requests/${notification.requestId}/accepted-seen`,
        {
          method: "POST",
          credentials: "include",
        },
      );

      if (!response.ok) {
        return;
      }

      const conversationResponse = await getConversations();

      setConversations(
        conversationResponse.conversations,
      );

      setSelectedConversationId(
        notification.conversationId,
      );

      setRequestsOpen(false);
      setAcceptedRequestNotification(null);
    } catch {
      return;
    }
  }

  async function handleAcceptMessageRequest(requestId: string) {
    if (acceptingMessageRequestId) {
      return;
    }

    setAcceptingMessageRequestId(requestId);
    setMessageRequestActionError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/message-requests/${requestId}/accept`,
        {
          method: "POST",
          credentials: "include",
        },
      );

      const body = await response.json();

      if (response.status === 200) {
        const remainingRequests = messageRequests.filter(
          (request) => request.id !== requestId,
        );

        setMessageRequests(remainingRequests);
        setHasPendingMessageRequests(remainingRequests.length > 0);

        const createdConversation =
          body?.conversation &&
          typeof body.conversation.id === "string"
            ? body.conversation
            : null;

        const createdConversationId =
          typeof body?.conversationId === "string"
            ? body.conversationId
            : createdConversation?.id ?? null;

        if (createdConversation) {
          setConversations((currentConversations) => {
            const alreadyExists = currentConversations.some(
              (conversation) =>
                conversation.id === createdConversation.id,
            );

            if (alreadyExists) {
              return currentConversations.map((conversation) =>
                conversation.id === createdConversation.id
                  ? createdConversation
                  : conversation,
              );
            }

            return [
              createdConversation,
              ...currentConversations,
            ];
          });
        } else {
          const conversationResponse = await getConversations();

          setConversations(
            conversationResponse.conversations,
          );
        }

        if (createdConversationId) {
          setSelectedConversationId(
            createdConversationId,
          );
        }

        return;
      }

      if (response.status === 401) {
        setMessageRequestActionError(
          "Your session has expired. Please sign in again.",
        );
        return;
      }

      if (response.status === 403) {
        setMessageRequestActionError(
          "You cannot accept this message request.",
        );
        return;
      }

      if (response.status === 404) {
        setMessageRequestActionError(
          "This message request is no longer available.",
        );
        return;
      }

      if (response.status === 409) {
        setMessageRequestActionError(
          typeof body?.error === "string"
            ? body.error
            : "This message request has already been handled.",
        );
        return;
      }

      setMessageRequestActionError(
        typeof body?.error === "string"
          ? body.error
          : "Unable to accept this message request. Please try again.",
      );
    } catch {
      setMessageRequestActionError(
        "Unable to reach Chatter Box. Please try again.",
      );
    } finally {
      setAcceptingMessageRequestId(null);
    }
  }

  function openNewChat() {
    setNewChatOpen(true);
    setUserSearch("");
    setDiscoverableUsers([]);
    setUserSearchError(false);
    setSelectedUser(null);
    setSendingMessageRequest(false);
    setMessageRequestError("");
    setMessageRequestSent(false);
  }

  function closeNewChat() {
    setNewChatOpen(false);
    setUserSearch("");
    setDiscoverableUsers([]);
    setUserSearchError(false);
    setSelectedUser(null);
    setSendingMessageRequest(false);
    setMessageRequestError("");
    setMessageRequestSent(false);
  }

  async function handleContinueNewChat() {
    if (!selectedUser || sendingMessageRequest) {
      return;
    }

    setSendingMessageRequest(true);
    setMessageRequestError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/message-requests`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            receiverId: selectedUser.id,
          }),
        },
      );

      const body = await response.json();

      if (response.status === 201) {
        console.log(
          "Message request sent:",
          body.request,
        );

        setMessageRequestSent(true);

        window.setTimeout(() => {
          closeNewChat();
        }, 1000);

        return;
      }

      if (response.status === 409) {
        setMessageRequestError(
          typeof body?.error === "string"
            ? body.error
            : "A message request cannot be sent right now.",
        );
        return;
      }

      if (response.status === 404) {
        setMessageRequestError(
          "This user is no longer available. Please search again.",
        );
        return;
      }

      if (response.status === 401) {
        setMessageRequestError(
          "Your session has expired. Please sign in again.",
        );
        return;
      }

      setMessageRequestError(
        typeof body?.error === "string"
          ? body.error
          : "Unable to send message request. Please try again.",
      );
    } catch {
      setMessageRequestError(
        "Unable to reach Chatter Box. Please try again.",
      );
    } finally {
      setSendingMessageRequest(false);
    }
  }

  function getOtherMember(
    conversation: Conversation,
  ) {
    return (
      conversation.members.find(
        (member) =>
          member.userId !==
          user?.id,
      ) ?? null
    );
  }

  const selectedConversation =
    conversations.find(
      (conversation) =>
        conversation.id ===
        selectedConversationId,
    ) ?? null;

  const selectedOtherMember =
    selectedConversation
      ? getOtherMember(
          selectedConversation,
        )
      : null;

  const filteredConversations =
    conversations.filter((conversation) => {
      const otherMember =
        getOtherMember(conversation);

      if (!otherMember) {
        return false;
      }

      const displayName =
        otherMember.user.displayName ||
        otherMember.user.username;

      const searchValue =
        conversationSearch.trim().toLowerCase();

      if (!searchValue) {
        return true;
      }

      return displayName
        .toLowerCase()
        .includes(searchValue);
    });

  if (authLoading) {
    return (
      <div className="messenger-app">
        <div className="chat-empty-state">
          <h2>
            Loading Chatter Box...
          </h2>

          <p>
            Checking your session.
          </p>
        </div>
      </div>
    );
  }

  if (authError || !user) {
    const isLogin = authMode === "login";

    return (
      <div className="auth-page">
        <style>{`
          :root {
            --cb-auth-bg: #f7f8fa;
            --cb-auth-text: #151922;
            --cb-auth-muted: #747b87;
            --cb-auth-input: #f0f1f3;
            --cb-auth-border: rgba(21, 25, 34, 0.10);
            --cb-auth-dark: #111214;
            --cb-auth-error: #b83f3f;
          }

          html,
          body,
          #root {
            width: 100%;
            min-height: 100%;
            margin: 0;
          }

          body {
            background: var(--cb-auth-bg);
            color: var(--cb-auth-text);
            font-family:
              Inter,
              ui-sans-serif,
              system-ui,
              -apple-system,
              BlinkMacSystemFont,
              "Segoe UI",
              sans-serif;
            -webkit-font-smoothing: antialiased;
          }

          .auth-page {
            min-height: 100dvh;
            padding: 42px 28px 50px;
            display: flex;
            justify-content: center;
            overflow-y: auto;
            background: var(--cb-auth-bg);
          }

          .auth-shell {
            width: min(100%, 540px);
            margin: auto;
          }

          .auth-brand {
            margin-bottom: 56px;
          }

          .auth-brand h1 {
            margin: 0;
            color: var(--cb-auth-text);
            font-size: clamp(48px, 7vw, 76px);
            font-weight: 780;
            line-height: 0.98;
            letter-spacing: -0.065em;
          }

          .auth-brand p {
            margin: 18px 0 0;
            color: var(--cb-auth-muted);
            font-size: 23px;
            font-weight: 420;
            line-height: 1.25;
            letter-spacing: -0.025em;
          }

          .auth-form {
            display: grid;
            gap: 27px;
          }

          .auth-field {
            display: grid;
            gap: 10px;
          }

          .auth-field label {
            color: #5f6671;
            font-size: 13px;
            font-weight: 650;
            letter-spacing: 0.13em;
            text-transform: uppercase;
          }

          .auth-field input {
            width: 100%;
            height: 66px;
            padding: 0 19px;
            border: 1px solid transparent;
            border-radius: 17px;
            outline: none;
            background: var(--cb-auth-input);
            color: var(--cb-auth-text);
            font-size: 18px;
            font-weight: 450;
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.38);
            transition:
              background 140ms ease,
              border-color 140ms ease,
              box-shadow 140ms ease;
          }

          .auth-field input::placeholder {
            color: #949aa4;
          }

          .auth-field input:focus {
            border-color: rgba(21, 25, 34, 0.20);
            background: #f5f6f7;
            box-shadow: 0 0 0 4px rgba(21, 25, 34, 0.045);
          }

          .auth-error {
            margin-top: -8px;
            padding: 12px 14px;
            border: 1px solid rgba(184, 63, 63, 0.14);
            border-radius: 12px;
            background: rgba(184, 63, 63, 0.055);
            color: var(--cb-auth-error);
            font-size: 13px;
            line-height: 1.45;
          }

          .auth-submit {
            width: 100%;
            min-height: 66px;
            margin-top: 4px;
            padding: 0 22px;
            border: 0;
            border-radius: 12px;
            background: var(--cb-auth-dark);
            color: #ffffff;
            font-size: 20px;
            font-weight: 700;
            cursor: pointer;
            transition:
              opacity 140ms ease,
              transform 140ms ease;
          }

          .auth-submit:hover:not(:disabled) {
            opacity: 0.90;
          }

          .auth-submit:active:not(:disabled) {
            transform: translateY(1px);
          }

          .auth-submit:disabled {
            cursor: not-allowed;
            opacity: 0.55;
          }

          .auth-switch {
            margin: 8px 0 0;
            color: var(--cb-auth-muted);
            font-size: 16px;
            line-height: 1.45;
            text-align: center;
          }

          .auth-switch button {
            margin: 0;
            padding: 0;
            border: 0;
            background: transparent;
            color: var(--cb-auth-text);
            font-size: inherit;
            font-weight: 700;
            cursor: pointer;
          }

          .auth-switch button:hover {
            text-decoration: underline;
            text-underline-offset: 3px;
          }

          @media (max-width: 600px) {
            .auth-page {
              padding: 34px 22px 40px;
              align-items: flex-start;
            }

            .auth-shell {
              width: 100%;
            }

            .auth-brand {
              margin-bottom: 48px;
            }

            .auth-brand h1 {
              font-size: clamp(44px, 15vw, 62px);
            }

            .auth-brand p {
              margin-top: 14px;
              font-size: 20px;
            }

            .auth-form {
              gap: 23px;
            }

            .auth-field input {
              height: 62px;
              border-radius: 15px;
              font-size: 17px;
            }

            .auth-submit {
              min-height: 62px;
              font-size: 18px;
            }

            .auth-switch {
              font-size: 15px;
            }
          }
        `}</style>

        <main className="auth-shell">
          <header className="auth-brand">
            <h1>ChatterBox</h1>

            {!isLogin && (
              <p>Create your account.</p>
            )}
          </header>

          <form
            className="auth-form"
            onSubmit={handleAuthSubmit}
          >
            {isLogin ? (
              <>
                <div className="auth-field">
                  
                  <input
                    id="auth-identity"
                    name="identity"
                    type="text"
                    value={authIdentity}
                    onChange={(event) => {
                      setAuthIdentity(event.target.value);
                      setAuthFormError("");
                    }}
                    placeholder="Email, username"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                  />
                </div>

                <div className="auth-field">
                
                  <input
                    id="auth-password"
                    name="password"
                    type="password"
                    value={authPassword}
                    onChange={(event) => {
                      setAuthPassword(event.target.value);
                      setAuthFormError("");
                    }}
                    placeholder="Password"
                    autoComplete="current-password"
                    required
                  />
                </div>
              </>
            ) : (
              <>
                <div className="auth-field">
                  <label htmlFor="auth-display-name">
                   Name
                  </label>
                  <input
                    id="auth-display-name"
                    name="displayName"
                    type="text"
                    value={authDisplayName}
                    onChange={(event) => {
                      setAuthDisplayName(event.target.value);
                      setAuthFormError("");
                    }}
                    placeholder="Your name"
                    autoComplete="name"
                    required
                  />
                </div>

                <div className="auth-field">
                  <label htmlFor="auth-email">
                    Email
                  </label>
                  <input
                    id="auth-email"
                    name="email"
                    type="email"
                    value={authEmail}
                    onChange={(event) => {
                      setAuthEmail(event.target.value);
                      setAuthFormError("");
                    }}
                    placeholder="Email address"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                  />
                </div>

                <div className="auth-field">
                  <label htmlFor="auth-username">
                    Username
                  </label>
                  <input
                    id="auth-username"
                    name="username"
                    type="text"
                    value={authUsername}
                    onChange={(event) => {
                      setAuthUsername(event.target.value);
                      setAuthFormError("");
                    }}
                    placeholder="Username"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                  />
                </div>

                <div className="auth-field">
                  <label htmlFor="auth-register-password">
                    Password
                  </label>
                  <input
                    id="auth-register-password"
                    name="password"
                    type="password"
                    value={authPassword}
                    onChange={(event) => {
                      setAuthPassword(event.target.value);
                      setAuthFormError("");
                    }}
                    placeholder="Create a password"
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />
                </div>
              </>
            )}

            {authFormError && (
              <div
                className="auth-error"
                role="alert"
              >
                {authFormError}
              </div>
            )}

            <button
              type="submit"
              className="auth-submit"
              disabled={authSubmitting}
            >
              {authSubmitting
                ? isLogin
                  ? "Signing In..."
                  : "Creating Account..."
                : isLogin
                  ? "Sign In"
                  : "Create Account"}
            </button>

            <p className="auth-switch">
              {isLogin
                ? "Don't have an account? "
                : "Already have an account? "}

              <button
                type="button"
                onClick={() => {
                  setAuthMode(
                    isLogin ? "register" : "login",
                  );
                  setAuthFormError("");
                  setAuthPassword("");
                }}
              >
                {isLogin
                  ? "Create Account"
                  : "Sign In"}
              </button>
            </p>
          </form>
        </main>
      </div>
    );
  }



  if (profileOpen) {
    const profileDisplayName =
      user.displayName || user.username;

    return (
      <div className="profile-page">
        <style>{`
          /* Profile styles are defined in the authenticated app shell. */
        `}</style>

        <header className="profile-header">
          <button
            type="button"
            className="profile-back-button"
            aria-label="Back to Chatter Box"
            onClick={() => setProfileOpen(false)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>

          <h1>Profile</h1>
        </header>

        <main className="profile-content">
          <section className="profile-card">
            <div className="profile-identity">
              <div className="profile-avatar">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={`${profileDisplayName} avatar`}
                  />
                ) : (
                  profileDisplayName
                    .charAt(0)
                    .toUpperCase()
                )}
              </div>

              <div className="profile-name">
                <h2>{profileDisplayName}</h2>
                <p>@{user.username}</p>
              </div>
            </div>

            <div className="profile-details">
              <div className="profile-detail">
                <span className="profile-detail-label">
                  Name
                </span>
                <span className="profile-detail-value">
                  {profileDisplayName}
                </span>
              </div>

              <div className="profile-detail">
                <span className="profile-detail-label">
                  Username
                </span>
                <span className="profile-detail-value">
                  @{user.username}
                </span>
              </div>

              <div className="profile-detail">
                <span className="profile-detail-label">
                  Email
                </span>
                <span className="profile-detail-value">
                  {user.email}
                </span>
              </div>
            </div>

            <div className="profile-actions">
              <button
                type="button"
                className="profile-logout-button"
                onClick={handleLogout}
              >
                Log out
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (requestsOpen) {
    return (
      <div className="requests-page">
        <header className="requests-header">
          <button
            type="button"
            className="requests-back-button"
            aria-label="Back to Chatter Box"
            onClick={() => setRequestsOpen(false)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>

          <h1>Message Requests</h1>
        </header>

        <main className="requests-content">
          {messageRequestActionError && (
            <div className="requests-action-error" role="alert">
              {messageRequestActionError}
            </div>
          )}

          {messageRequestsLoading ? (
            <div className="requests-empty">
              <div>
                <h2>Loading requests</h2>
                <p>Checking for new message requests.</p>
              </div>
            </div>
          ) : messageRequestsError ? (
            <div className="requests-empty">
              <div>
                <h2>Unable to load requests</h2>
                <p>
                  Please refresh the page and try again.
                </p>
              </div>
            </div>
          ) : messageRequests.length === 0 ? (
            <div className="requests-empty">
              <div>
                <h2>No pending message requests</h2>
                <p>
                  New requests will appear here when someone wants
                  to start a conversation with you.
                </p>
              </div>
            </div>
          ) : (
            <div className="requests-list">
              {messageRequests.map((request) => {
                const displayName =
                  request.sender.displayName ||
                  request.sender.username;

                return (
                  <article
                    key={request.id}
                    className="request-row"
                  >
                    <div className="request-avatar">
                      {request.sender.avatarUrl ? (
                        <img
                          src={request.sender.avatarUrl}
                          alt={`${displayName} avatar`}
                        />
                      ) : (
                        displayName.charAt(0).toUpperCase()
                      )}
                    </div>

                    <div className="request-info">
                      <strong>{displayName}</strong>
                      <span>requested to message you</span>
                      <time dateTime={request.createdAt}>
                        {formatMessageRequestTime(
                          request.createdAt,
                        )}
                      </time>
                    </div>

                    <div className="request-actions">
                      <button
                        type="button"
                        className="request-action request-action-accept"
                        onClick={() =>
                          handleAcceptMessageRequest(request.id)
                        }
                        disabled={acceptingMessageRequestId !== null}
                      >
                        {acceptingMessageRequestId === request.id
                          ? "Accepting..."
                          : "Accept"}
                      </button>

                      <button
                        type="button"
                        className="request-action"
                        disabled={acceptingMessageRequestId !== null}
                      >
                        Reject
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="messenger-app">
      {acceptedRequestNotification && !acceptedRequestNotificationLoading && (
        <div className="accepted-request-banner" role="status">
          <div className="accepted-request-banner-copy">
            <strong>
              {acceptedRequestNotification.acceptedBy.displayName ||
                acceptedRequestNotification.acceptedBy.username} accepted your request
            </strong>
            <span>You can now start a conversation.</span>
          </div>

          <button
            type="button"
            className="accepted-request-banner-action"
            onClick={handleChatNowFromAcceptedRequest}
          >
            Chat now
          </button>
        </div>
      )}
      <style>{`
        :root {
  --cb-bg: #f1f1f1;
  --cb-surface: #ffffff;
  --cb-surface-soft: #f7f7f7;
  --cb-surface-hover: #ebebeb;

  --cb-border: #d6d6d6;
  --cb-border-strong: #bdbdbd;

  --cb-text: #111111;
  --cb-text-soft: #5f5f5f;
  --cb-text-muted: #8a8a8a;

  --cb-accent: #111111;
  --cb-accent-soft: #e7e7e7;
  --cb-accent-border: #bdbdbd;

  --cb-danger: #333333;

  --cb-shadow:
    0 12px 30px rgba(0, 0, 0, 0.08),
    0 2px 8px rgba(0, 0, 0, 0.04);

  --cb-shadow-soft:
    0 6px 18px rgba(0, 0, 0, 0.06);

  --cb-radius-xl: 16px;
  --cb-radius-lg: 12px;
  --cb-radius-md: 9px;
}

        html,
        body,
        #root {
          width: 100%;
          height: 100%;
          min-height: 100%;
          margin: 0;
          overflow: hidden;
        }

        body {
          background: var(--cb-bg);
          color: var(--cb-text);
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
          -webkit-font-smoothing: antialiased;
          text-rendering: optimizeLegibility;
        }

        *,
        *::before,
        *::after {
          box-sizing: border-box;
        }

        button,
        input,
        textarea {
          font: inherit;
        }

        button {
          -webkit-tap-highlight-color: transparent;
        }

        .messenger-app {
          width: 100%;
          height: 100dvh;
          min-height: 100dvh;
          padding: 22px;
          overflow: hidden;
          background: var(--cb-bg);
        }

        .messenger-header {
          width: min(1480px, 100%);
          min-height: 76px;
          margin: 0 auto;
          padding: 12px 18px 12px 22px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          border: 1px solid var(--cb-border);
          border-bottom-color: rgba(24, 39, 58, 0.075);
          border-radius: var(--cb-radius-xl) var(--cb-radius-xl) 0 0;
          background: var(--cb-surface);
          box-shadow: var(--cb-shadow-soft);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
        }

        .messenger-brand {
          min-width: 0;
          display: flex !important;
          flex-direction: row !important;
          align-items: center;
          gap: 12px;
        }

        .brand-logo {
          width: 42px;
          height: 42px;
          flex: 0 0 42px;
          display: block;
          object-fit: contain;
          border-radius: 6px;
        }

        .messenger-brand-copy {
          min-width: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .messenger-brand-copy h1 {
          margin: 0;
          color: var(--cb-text);
          font-size: 21px;
          font-weight: 750;
          letter-spacing: -0.035em;
        }

        .messenger-brand-copy span {
          display: block;
          margin-top: 1px;
          color: var(--cb-text-muted);
          font-size: 11px;
          font-weight: 500;
        }

        .desktop-header-profile {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 10px;
        }


        .desktop-notification-button {
          position: relative;
          width: 42px;
          height: 42px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          padding: 0;
          border: 1px solid var(--cb-border);
          border-radius: 50%;
          background: var(--cb-surface-soft);
          color: var(--cb-text-soft);
          cursor: pointer;
          box-shadow: 0 3px 10px rgba(36, 50, 70, 0.045);
        }

        .desktop-notification-button svg {
          width: 21px;
          height: 21px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.65;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .notification-dot {
          position: absolute;
          top: 6px;
          right: 6px;
          width: 7px;
          height: 7px;
          border: 1.5px solid #ffffff;
          border-radius: 50%;
          background: #ef8d9c;
          box-sizing: content-box;
        }

        .desktop-profile-button {
          width: 42px;
          height: 42px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          border: 1px solid var(--cb-border);
          border-radius: 50%;
          background: var(--cb-surface-soft);
          color: var(--cb-text-soft);
          cursor: pointer;
          box-shadow: 0 3px 10px rgba(36, 50, 70, 0.045);
        }

        .desktop-profile-button svg {
          width: 22px;
          height: 22px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.65;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .user-info {
          display: none;
        }

        .logout-button {
          min-height: 38px;
          padding: 0 14px;
          border: 1px solid var(--cb-border-strong);
          border-radius: 10px;
          background: var(--cb-surface);
          color: var(--cb-text);
          font: inherit;
          font-size: 14px;
          font-weight: 650;
          cursor: pointer;
        }

        .logout-button:hover {
          background: var(--cb-surface-hover);
        }

        .requests-page {
          width: 100%;
          height: 100dvh;
          min-height: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: var(--cb-bg);
        }

        .requests-header {
          width: min(980px, calc(100% - 44px));
          min-height: 76px;
          margin: 22px auto 0;
          padding: 12px 0;
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .requests-back-button {
          width: 42px;
          height: 42px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          padding: 0;
          border: 1px solid var(--cb-border);
          border-radius: 50%;
          background: var(--cb-surface);
          color: var(--cb-text);
          cursor: pointer;
        }

        .requests-back-button svg {
          width: 20px;
          height: 20px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.8;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .requests-header h1 {
          margin: 0;
          color: var(--cb-text);
          font-size: 24px;
          font-weight: 720;
          letter-spacing: -0.035em;
        }

        .requests-content {
          width: min(980px, calc(100% - 44px));
          margin: 8px auto 40px;
          min-height: 0;
          flex: 1 1 auto;
          overflow-y: auto;
        }

        .requests-list {
          width: 100%;
          border-top: 1px solid var(--cb-border);
        }

        .request-row {
          min-height: 94px;
          padding: 16px 0;
          display: flex;
          align-items: center;
          gap: 16px;
          border-bottom: 1px solid var(--cb-border);
        }

        .request-avatar {
          width: 54px;
          height: 54px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          overflow: hidden;
          border: 1px solid rgba(24, 39, 58, 0.08);
          border-radius: 50%;
          background: #e9eef6;
          color: var(--cb-text-soft);
          font-size: 17px;
          font-weight: 700;
        }

        .request-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .request-info {
          min-width: 0;
          flex: 1 1 auto;
        }

        .request-info strong {
          display: block;
          overflow: hidden;
          color: var(--cb-text);
          font-size: 15px;
          font-weight: 700;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .request-info span {
          display: block;
          margin-top: 4px;
          overflow: hidden;
          color: var(--cb-text-soft);
          font-size: 13px;
          line-height: 1.35;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .request-info time {
          display: block;
          margin-top: 4px;
          color: var(--cb-text-muted);
          font-size: 11px;
        }

        .request-actions {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .request-action {
          min-height: 40px;
          padding: 0 16px;
          border: 1px solid var(--cb-border-strong);
          border-radius: 10px;
          background: #ffffff;
          color: var(--cb-text);
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .request-action:hover {
          background: var(--cb-surface-hover);
        }

        .request-action-accept {
          border-color: rgba(47, 114, 232, 0.16);
          background: var(--cb-accent);
          color: #ffffff;
        }

        .request-action-accept:hover {
          background: #2866d4;
        }

        .requests-action-error {
          margin-bottom: 12px;
          padding: 10px 12px;
          border: 1px solid #efc4ca;
          border-radius: 10px;
          background: #fff5f6;
          color: #9f4652;
          font-size: 12px;
          line-height: 1.4;
        }

        .requests-empty {
          min-height: 320px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
          text-align: center;
        }

        .requests-empty h2 {
          margin: 0;
          color: var(--cb-text);
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -0.025em;
        }

        .requests-empty p {
          margin: 8px 0 0;
          color: var(--cb-text-soft);
          font-size: 13px;
          line-height: 1.5;
        }

        .profile-page {
          width: 100%;
          height: 100%;
          min-height: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: var(--cb-bg);
        }

        .profile-header {
          width: min(760px, calc(100% - 44px));
          min-height: 76px;
          margin: 22px auto 0;
          padding: 12px 0;
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .profile-back-button {
          width: 42px;
          height: 42px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          padding: 0;
          border: 1px solid var(--cb-border);
          border-radius: 50%;
          background: var(--cb-surface);
          color: var(--cb-text);
          cursor: pointer;
        }

        .profile-back-button svg {
          width: 20px;
          height: 20px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.8;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .profile-header h1 {
          margin: 0;
          color: var(--cb-text);
          font-size: 24px;
          font-weight: 720;
          letter-spacing: -0.035em;
        }

        .profile-content {
          width: min(760px, calc(100% - 44px));
          margin: 20px auto 40px;
          overflow-y: auto;
        }

        .profile-card {
          padding: 30px;
          border: 1px solid var(--cb-border);
          border-radius: var(--cb-radius-xl);
          background: var(--cb-surface);
          box-shadow: var(--cb-shadow-soft);
        }

        .profile-identity {
          display: flex;
          align-items: center;
          gap: 18px;
          padding-bottom: 28px;
          border-bottom: 1px solid var(--cb-border);
        }

        .profile-avatar {
          width: 76px;
          height: 76px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          overflow: hidden;
          border: 1px solid rgba(24, 39, 58, 0.08);
          border-radius: 50%;
          background: #e9eef6;
          color: var(--cb-text-soft);
          font-size: 25px;
          font-weight: 700;
        }

        .profile-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .profile-name {
          min-width: 0;
        }

        .profile-name h2 {
          margin: 0;
          overflow: hidden;
          color: var(--cb-text);
          font-size: 21px;
          font-weight: 700;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .profile-name p {
          margin: 5px 0 0;
          overflow: hidden;
          color: var(--cb-text-soft);
          font-size: 14px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .profile-details {
          display: grid;
          gap: 0;
          padding: 8px 0 0;
        }

        .profile-detail {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 18px 0;
          border-bottom: 1px solid var(--cb-border);
        }

        .profile-detail:last-child {
          border-bottom: 0;
        }

        .profile-detail-label {
          color: var(--cb-text-muted);
          font-size: 12px;
          font-weight: 650;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .profile-detail-value {
          min-width: 0;
          overflow: hidden;
          color: var(--cb-text);
          font-size: 14px;
          font-weight: 600;
          text-align: right;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .profile-actions {
          padding-top: 22px;
        }

        .profile-logout-button {
          width: 100%;
          min-height: 48px;
          padding: 0 18px;
          border: 1px solid rgba(200, 77, 77, 0.24);
          border-radius: 11px;
          background: #fff;
          color: var(--cb-danger);
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }

        .profile-logout-button:hover {
          background: rgba(200, 77, 77, 0.045);
        }

        .messenger-layout {
          position: relative;
          width: min(1480px, 100%);
          height: calc(100dvh - 120px);
          min-height: 560px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 350px minmax(0, 1fr);
          overflow: hidden;
          border: 1px solid var(--cb-border);
          border-top: 0;
          border-radius: 0 0 var(--cb-radius-xl) var(--cb-radius-xl);
          background: var(--cb-surface);
          box-shadow: var(--cb-shadow);
        }

        .conversation-sidebar {
          position: relative;
          min-width: 0;
          display: flex;
          flex-direction: column;
          border-right: 1px solid var(--cb-border);
          background: rgba(248, 250, 253, 0.76);
        }

        .sidebar-header {
          min-height: 105px;
          padding: 16px 14px 14px;
          display: block;
          border-bottom: 1px solid var(--cb-border);
        }

        .sidebar-desktop-heading {
          display: none;
        }

        .conversation-count {
          display: none;
        }

        .desktop-sidebar-content {
          display: block;
        }

        .desktop-search {
          width: 100%;
          height: 44px;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 0 13px;
          border: 1px solid transparent;
          border-radius: 11px;
          background: #f0f3f8;
          color: var(--cb-text-muted);
          transition:
            background 140ms ease,
            border-color 140ms ease,
            box-shadow 140ms ease;
        }

        .desktop-search:focus-within {
          border-color: var(--cb-accent-border);
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(47, 114, 232, 0.055);
        }

        .desktop-search svg {
          width: 21px;
          height: 21px;
          flex: 0 0 auto;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.65;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .desktop-search input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: var(--cb-text);
          font-size: 13px;
        }

        .desktop-search input::placeholder {
          color: var(--cb-text-muted);
        }

        .sidebar-desktop-new {
          display: none;
        }

        .conversation-list {
          flex: 1 1 auto;
          min-height: 0;
          overflow-y: auto;
          overscroll-behavior-y: contain;
          scrollbar-width: thin;
        }

        .conversation-item {
          position: relative;
          width: 100%;
          min-height: 74px;
          padding: 12px 15px 12px 17px;
          display: flex;
          align-items: center;
          gap: 12px;
          border: 0;
          border-bottom: 1px solid rgba(24, 39, 58, 0.055);
          background: transparent;
          color: inherit;
          text-align: left;
          cursor: pointer;
          transition:
            background 140ms ease,
            box-shadow 140ms ease;
        }

        .conversation-item:hover {
          background: var(--cb-surface-hover);
        }

        .conversation-item-selected {
          background: rgba(47, 114, 232, 0.085);
          box-shadow: inset 3px 0 0 var(--cb-accent);
        }

        .conversation-avatar,
        .chat-header-avatar {
          flex: 0 0 auto;
          width: 46px;
          height: 46px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          border: 1px solid rgba(24, 39, 58, 0.08);
          border-radius: 50%;
          background: #e9eef6;
          color: var(--cb-text-soft);
          font-size: 15px;
          font-weight: 700;
        }

        .conversation-item-selected .conversation-avatar {
          background: #dce9ff;
          color: var(--cb-accent);
          border-color: rgba(47, 114, 232, 0.12);
        }

        .conversation-avatar img,
        .chat-header-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .conversation-details {
          min-width: 0;
          flex: 1 1 auto;
          overflow: hidden;
        }

        .conversation-details strong {
          display: block;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--cb-text);
          font-size: 14px;
          font-weight: 650;
        }

        .conversation-time {
          flex: 0 0 auto;
          align-self: flex-start;
          max-width: 55px;
          margin-top: 3px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--cb-text-muted);
          font-size: 10px;
          text-align: right;
        }

        .conversation-chevron {
          width: 18px;
          height: 18px;
          flex: 0 0 auto;
          fill: none;
          stroke: #8794a8;
          stroke-width: 1.9;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .empty-conversations {
          padding: 32px 22px;
          color: var(--cb-text-soft);
          text-align: center;
        }

        .empty-conversations p {
          margin: 0;
          color: var(--cb-text);
          font-size: 14px;
          font-weight: 650;
        }

        .empty-conversations span {
          display: block;
          margin-top: 7px;
          color: var(--cb-text-muted);
          font-size: 12px;
          line-height: 1.5;
        }

        .chat-area {
          min-width: 0;
          min-height: 0;
          height: 100%;
          display: flex;
          overflow: hidden;
          background: #ffffff;
        }

        .chat-window {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
          min-height: 0;
          overflow: hidden;
        }

        .chat-header {
          min-height: 92px;
          flex: 0 0 auto;
          padding: 16px 28px;
          display: flex;
          align-items: center;
          gap: 14px;
          border-bottom: 1px solid var(--cb-border);
          background: rgba(255, 255, 255, 0.92);
        }

        .chat-header-avatar {
          width: 48px;
          height: 48px;
          background: #e9eef6;
        }

        .chat-header-info {
          min-width: 0;
          overflow: hidden;
        }

        .chat-header-info h2 {
          margin: 0;
          color: var(--cb-text);
          font-size: 18px;
          font-weight: 700;
          letter-spacing: -0.025em;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .chat-header-info small {
          display: block;
          margin-top: 4px;
          color: var(--cb-text-muted);
          font-size: 11px;
          font-weight: 550;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .chat-content {
          min-width: 0;
          min-height: 0;
          flex: 1 1 auto;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .message-list {
          flex: 1 1 0;
          min-width: 0;
          min-height: 0;
          height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 24px 32px 14px;
          overscroll-behavior: contain;
          scrollbar-width: thin;
        }

        .message-row {
          display: flex;
          width: 100%;
          margin: 5px 0;
        }

        .message-row-own {
          justify-content: flex-end;
        }

        .message-row-other {
          justify-content: flex-start;
        }

        /* =========================================================
           7B-4A MESSAGE ACTIONS
           ========================================================= */

        .message-update-error {
          margin: 0 14px 6px;
          padding: 8px 11px;
          border: 1px solid #bcbcbc;
          border-radius: 9px;
          background: #e5e5e5;
          color: #444444;
          font-size: 12px;
          line-height: 1.35;
        }

        .message-composer-editing {
          flex-wrap: wrap;
        }

        .message-replying-bar {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 8px 10px;
          border: 1px solid var(--cb-border);
          border-left: 3px solid var(--cb-accent);
          border-radius: 10px;
          background: #f7f8fa;
        }

        .message-replying-copy {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
          overflow: hidden;
        }

        .message-replying-copy strong {
          color: var(--cb-text);
          font-size: 12px;
          font-weight: 750;
        }

        .message-replying-copy span {
          overflow: hidden;
          color: var(--cb-text-muted);
          font-size: 11px;
          line-height: 1.35;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .message-reply-cancel-icon {
          width: 28px;
          height: 28px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          padding: 0;
          border: 1px solid var(--cb-border);
          border-radius: 8px;
          background: #ffffff;
          color: var(--cb-text-soft);
          font-size: 18px;
          line-height: 1;
          cursor: pointer;
        }

        .message-editing-bar {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 8px 10px;
          border: 1px solid var(--cb-border);
          border-radius: 10px;
          background: #f7f8fa;
        }

        .message-editing-bar div {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .message-editing-bar strong {
          color: var(--cb-text);
          font-size: 12px;
          font-weight: 750;
        }

        .message-editing-bar span {
          color: var(--cb-text-muted);
          font-size: 11px;
        }

        .message-edit-cancel-icon {
          width: 28px;
          height: 28px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          padding: 0;
          border: 1px solid var(--cb-border);
          border-radius: 8px;
          background: #ffffff;
          color: var(--cb-text-soft);
          font-size: 18px;
          line-height: 1;
          cursor: pointer;
        }

        .message-edit-cancel-button {
          background: #ffffff !important;
          border-color: var(--cb-border-strong) !important;
          color: var(--cb-text) !important;
          box-shadow: none !important;
        }

        .message-edit-cancel-button:hover:not(:disabled) {
          background: #f3f5f8 !important;
        }

        .message-composer-editing textarea {
          border-color: var(--cb-accent-border);
          box-shadow: 0 0 0 3px rgba(47, 114, 232, 0.055);
        }

        .message-action-wrap {
          position: relative;
          display: flex;
          align-items: center;
          gap: 7px;
          max-width: 100%;
        }

        .message-action-wrap-own {
          flex-direction: row-reverse;
        }

        .message-action-wrap-other {
          flex-direction: row;
        }

        .message-actions {
          position: relative;
          flex: 0 0 auto;
          align-self: center;
        }

        .message-actions-trigger {
          width: 30px;
          height: 30px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          border: 1px solid transparent;
          border-radius: 9px;
          background: transparent;
          color: var(--cb-text-muted);
          cursor: pointer;
          opacity: 0;
          transition:
            opacity 140ms ease,
            background 140ms ease,
            color 140ms ease;
        }

        .message-row:hover .message-actions-trigger,
        .message-actions-trigger:focus-visible,
        .message-actions-open .message-actions-trigger {
          opacity: 1;
        }

        .message-actions-trigger:hover {
          background: #f1f3f6;
          color: var(--cb-text);
        }

        .message-actions-trigger:focus-visible {
          outline: 2px solid rgba(47, 114, 232, 0.28);
          outline-offset: 1px;
        }

        .message-actions-trigger span {
          display: block;
          transform: translateY(-2px);
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 2px;
          line-height: 1;
        }

        .message-actions-menu {
          position: absolute;
          z-index: 12;
          top: calc(100% + 6px);
          min-width: 128px;
          padding: 5px;
          border: 1px solid var(--cb-border-strong);
          border-radius: 11px;
          background: #ffffff;
          box-shadow: 0 12px 28px rgba(24, 39, 58, 0.14);
        }

        .message-action-wrap-other .message-actions-menu {
          left: 0;
        }

        .message-action-wrap-own .message-actions-menu {
          right: 0;
        }

        .message-actions-menu button {
          width: 100%;
          min-height: 36px;
          display: flex;
          align-items: center;
          padding: 0 10px;
          border: 0;
          border-radius: 7px;
          background: transparent;
          color: var(--cb-text);
          font-size: 12px;
          font-weight: 650;
          text-align: left;
          cursor: pointer;
        }

        .message-actions-menu button:hover,
        .message-actions-menu button:focus-visible {
          background: #f2f4f7;
          outline: none;
        }

        .message-delete-confirm {
          position: absolute;
          z-index: 20;
          top: calc(100% + 7px);
          min-width: 190px;
          max-width: 230px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          border: 1px solid var(--cb-border-strong);
          border-radius: 12px;
          background: #ffffff;
          box-shadow: 0 14px 30px rgba(24, 39, 58, 0.16);
        }

        .message-action-wrap-own .message-delete-confirm {
          right: 0;
        }

        .message-action-wrap-other .message-delete-confirm {
          left: 0;
        }

        .message-delete-confirm strong {
          color: var(--cb-text);
          font-size: 12px;
          font-weight: 750;
        }

        .message-delete-confirm > span {
          color: var(--cb-text-muted);
          font-size: 11px;
          line-height: 1.35;
        }

        .message-delete-confirm-actions {
          display: flex;
          justify-content: flex-end;
          gap: 7px;
          margin-top: 7px;
        }

        .message-delete-confirm-actions button {
          min-height: 32px;
          padding: 0 10px;
          border: 1px solid var(--cb-border-strong);
          border-radius: 8px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }

        .message-delete-cancel {
          background: #ffffff;
          color: var(--cb-text);
        }

        .message-delete-cancel:hover:not(:disabled) {
          background: #f3f5f8;
        }

        .message-delete-confirm-button {
          border-color: #111111 !important;
          background: #111111 !important;
          color: #ffffff !important;
        }

        .message-delete-confirm-button:hover:not(:disabled) {
          background: #303030 !important;
        }

        .message-delete-confirm-actions button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .message-row-highlighted .message-bubble {
          animation: message-reply-highlight 1.4s ease-out;
        }

        @keyframes message-reply-highlight {
          0% {
            transform: scale(1);
            box-shadow: 0 3px 12px rgba(36, 50, 70, 0.04);
          }

          18% {
            transform: scale(1.045);
            box-shadow: 0 0 0 5px rgba(47, 114, 232, 0.16),
              0 10px 28px rgba(47, 114, 232, 0.18);
          }

          42% {
            transform: scale(1.02);
            box-shadow: 0 0 0 3px rgba(47, 114, 232, 0.11),
              0 7px 20px rgba(47, 114, 232, 0.12);
          }

          72% {
            transform: scale(1.03);
            box-shadow: 0 0 0 4px rgba(47, 114, 232, 0.09),
              0 6px 18px rgba(47, 114, 232, 0.09);
          }

          100% {
            transform: scale(1);
            box-shadow: 0 3px 12px rgba(36, 50, 70, 0.04);
          }
        }

        .message-reply-preview {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 2px;
          margin: 0 0 7px;
          padding: 6px 8px;
          border: 0;
          border-left: 3px solid currentColor;
          border-radius: 5px;
          text-align: left;
          cursor: pointer;
          overflow: hidden;
        }

        .message-reply-preview-own {
          background: rgba(255, 255, 255, 0.12);
          color: rgba(255, 255, 255, 0.86);
        }

        .message-reply-preview-other {
          background: rgba(0, 0, 0, 0.045);
          color: var(--cb-text-muted);
        }

        .message-reply-preview:hover:not(:disabled) {
          opacity: 0.86;
        }

        .message-reply-label {
          overflow: hidden;
          font-size: 10px;
          font-weight: 750;
          line-height: 1.2;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .message-reply-content {
          overflow: hidden;
          font-size: 11px;
          line-height: 1.3;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .message-bubble {
          position: relative;
          max-width: min(66%, 620px);
          padding: 10px 13px 8px;
          border: 1px solid var(--cb-border);
          border-radius: 15px;
          box-shadow: 0 3px 12px rgba(36, 50, 70, 0.04);
          font-size: 14px;
          line-height: 1.45;
          overflow-wrap: anywhere;
        }

        .message-bubble-own {
          background: var(--cb-accent);
          border-color: rgba(47, 114, 232, 0.14);
          color: #ffffff;
          border-bottom-right-radius: 5px;
        }

        .message-bubble-other {
          background: #f3f5f8;
          color: var(--cb-text);
          border-bottom-left-radius: 5px;
        }

        .message-time {
          display: inline-block;
          margin-left: 9px;
          color: rgba(255, 255, 255, 0.68);
          font-size: 10px;
          line-height: 1;
          vertical-align: baseline;
          white-space: nowrap;
        }

        .message-bubble-other .message-time {
          color: var(--cb-text-muted);
        }

        .message-status-indicator {
          display: inline-block;
          margin-left: 4px;
          color: rgba(255, 255, 255, 0.72);
          font-size: 10px;
          line-height: 1;
          letter-spacing: -1px;
        }

        .message-status-read {
          color: #dce9ff;
        }

        .deleted-message {
          color: var(--cb-text-muted);
          font-style: italic;
        }

        .message-bubble-own .deleted-message {
          color: rgba(255, 255, 255, 0.72);
        }

        .older-messages-loading {
          padding: 8px 0 12px;
          color: var(--cb-text-muted);
          font-size: 11px;
          text-align: center;
        }

        .chat-empty-state {
          width: min(520px, calc(100% - 48px));
          margin: auto;
          padding: 30px;
          text-align: center;
        }

        .chat-empty-state h2 {
          margin: 0;
          color: var(--cb-text);
          font-size: 21px;
          font-weight: 700;
          letter-spacing: -0.025em;
        }

        .chat-empty-state p {
          margin: 9px 0 0;
          color: var(--cb-text-soft);
          font-size: 13px;
          line-height: 1.55;
        }

        .send-message-error {
          flex: 0 0 auto;
          margin: 0 16px 6px;
          padding: 8px 10px;
          border: 1px solid rgba(200, 77, 77, 0.16);
          border-radius: var(--cb-radius-sm);
          background: rgba(200, 77, 77, 0.06);
          color: var(--cb-danger);
          font-size: 12px;
        }

        .message-composer {
          display: flex;
          align-items: flex-end;
          flex: 0 0 auto;
          width: 100%;
          gap: 9px;
          padding: 12px 18px 14px;
          border-top: 1px solid var(--cb-border);
          background: rgba(255, 255, 255, 0.94);
        }

        .message-composer textarea {
          flex: 1 1 auto;
          width: 0;
          min-width: 0;
          min-height: 44px;
          max-height: 120px;
          padding: 11px 14px;
          resize: none;
          overflow-y: auto;
          border: 1px solid var(--cb-border-strong);
          border-radius: 12px;
          outline: none;
          background: #f5f7fa;
          color: var(--cb-text);
          box-shadow: none;
          transition:
            border-color 140ms ease,
            background 140ms ease,
            box-shadow 140ms ease;
        }

        .message-composer textarea::placeholder {
          color: var(--cb-text-muted);
        }

        .message-composer textarea:focus {
          border-color: var(--cb-accent-border);
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(47, 114, 232, 0.06);
        }

        .message-composer button {
          flex: 0 0 auto;
          min-height: 44px;
          padding: 10px 17px;
          border: 1px solid rgba(47, 114, 232, 0.14);
          border-radius: 11px;
          background: var(--cb-accent);
          color: #ffffff;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 5px 14px rgba(47, 114, 232, 0.14);
          transition:
            background 140ms ease,
            opacity 140ms ease,
            transform 140ms ease;
        }

        .message-composer button:hover:not(:disabled) {
          background: #2866d4;
        }

        .message-composer button:active:not(:disabled) {
          transform: translateY(1px);
        }

        .message-composer button:disabled {
          cursor: not-allowed;
          opacity: 0.46;
          box-shadow: none;
        }

        .desktop-new-chat-fab,
        .mobile-new-chat-fab {
          position: absolute;
          z-index: 5;
          display: grid;
          place-items: center;
          width: 58px;
          height: 58px;
          padding: 0;
          border: 0;
          border-radius: 50%;
          background: var(--cb-accent);
          color: #ffffff;
          cursor: pointer;
          box-shadow:
            0 12px 24px rgba(47, 114, 232, 0.22),
            0 3px 8px rgba(36, 50, 70, 0.08);
        }

        .desktop-new-chat-fab {
          right: 24px;
          bottom: 24px;
        }

        .desktop-new-chat-fab svg,
        .mobile-new-chat-fab svg {
          width: 25px;
          height: 25px;
          fill: none;
          stroke: currentColor;
          stroke-width: 2;
          stroke-linecap: round;
        }

        .mobile-new-chat-fab {
          display: none;
        }

        .mobile-sidebar-content,
        .mobile-back-button {
          display: none;
        }

        @media (prefers-reduced-motion: reduce) {
          .message-row-highlighted .message-bubble {
            animation: none;
          }
        }

        @media (max-width: 1100px) {
          .messenger-app {
            padding: 16px;
          }

          .messenger-layout {
            grid-template-columns: 310px minmax(0, 1fr);
          }

          .message-bubble {
            max-width: 72%;
          }
        }

        @media (max-width: 768px) {
  .message-replying-bar-above-composer {
    margin: 0 10px;
  }
          .user-info {
            display: block;
          }
          .messenger-app {
            min-height: 100dvh;
            height: 100dvh;
            padding: 0;
            overflow: hidden;
            background: #ffffff;
          }

          .messenger-header {
            display: none;
          }

          .messenger-layout {
            width: 100%;
            height: 100dvh;
            min-height: 0;
            margin: 0;
            display: flex;
            border: 0;
            border-radius: 0;
            box-shadow: none;
            background: #ffffff;
          }

          .conversation-sidebar,
          .chat-area {
            width: 100%;
            min-width: 0;
            flex: 1 1 100%;
          }

          .conversation-sidebar.mobile-conversation-hidden {
            display: none !important;
          }

          .chat-area.mobile-chat-hidden {
            display: none !important;
          }

          .chat-area.mobile-chat-visible {
            display: flex !important;
          }

          .sidebar-header {
            min-height: 0;
            padding: 30px 22px 12px;
            border-bottom: 0;
          }

          .sidebar-desktop-heading,
          .desktop-sidebar-content,
          .sidebar-desktop-new {
            display: none;
          }

          .mobile-sidebar-content {
            display: block;
          }

          .mobile-sidebar-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 14px;
            margin-bottom: 23px;
          }

          .mobile-header-actions {
            display: flex;
            align-items: center;
            gap: 8px;
            flex: 0 0 auto;
          }

          .mobile-sidebar-top h2 {
            margin: 0;
            color: var(--cb-text);
            font-size: 30px;
            font-weight: 750;
            letter-spacing: -0.045em;
          }

          .mobile-notification-button {
            position: relative;
            width: 42px;
            height: 42px;
            display: grid;
            place-items: center;
            flex: 0 0 auto;
            padding: 0;
            border: 1px solid rgba(24, 39, 58, 0.045);
            border-radius: 50%;
            background: #eef2f7;
            color: var(--cb-text-soft);
          }

          .mobile-notification-button svg {
            width: 23px;
            height: 23px;
            fill: none;
            stroke: currentColor;
            stroke-width: 1.7;
            stroke-linecap: round;
            stroke-linejoin: round;
          }

          .mobile-notification-button .notification-dot {
            top: 5px;
            right: 5px;
            width: 7px;
            height: 7px;
          }

          .mobile-profile-button {
            width: 46px;
            height: 46px;
            display: grid;
            place-items: center;
            flex: 0 0 auto;
            border: 1px solid rgba(24, 39, 58, 0.045);
            border-radius: 50%;
            background: #eef2f7;
            color: var(--cb-text-soft);
          }

          .mobile-profile-button svg {
            width: 25px;
            height: 25px;
            fill: none;
            stroke: currentColor;
            stroke-width: 1.7;
            stroke-linecap: round;
            stroke-linejoin: round;
          }

          .requests-page {
            background: #ffffff;
          }

          .requests-header {
            width: 100%;
            min-height: 72px;
            margin: 0;
            padding: 18px 18px 10px;
          }

          .requests-header h1 {
            font-size: 22px;
          }

          .requests-back-button {
            width: 40px;
            height: 40px;
            border: 0;
            background: #f2f4f8;
          }

          .requests-content {
            width: 100%;
            margin: 8px 0 0;
            padding: 0 18px 28px;
          }

          .requests-list {
            border-top: 0;
          }

          .request-row {
            min-height: 0;
            padding: 15px 0;
            align-items: flex-start;
            gap: 13px;
          }

          .request-avatar {
            width: 50px;
            height: 50px;
          }

          .request-info strong {
            font-size: 15px;
          }

          .request-info span {
            white-space: normal;
          }

          .request-actions {
            flex: 0 0 auto;
            flex-direction: column;
            align-items: stretch;
            gap: 7px;
          }

          .request-action {
            min-height: 36px;
            padding: 0 12px;
          }

          .requests-action-error {
            margin: 0 0 10px;
          }

          .requests-empty {
            min-height: 260px;
            padding: 32px 18px;
          }

          .requests-empty h2 {
            font-size: 19px;
          }

          .profile-page {
            background: #ffffff;
          }

          .profile-header {
            width: 100%;
            min-height: 72px;
            margin: 0;
            padding: 18px 18px 10px;
          }

          .profile-header h1 {
            font-size: 22px;
          }

          .profile-back-button {
            width: 40px;
            height: 40px;
            border: 0;
            background: #f2f4f8;
          }

          .profile-content {
            width: 100%;
            margin: 8px 0 0;
            padding: 0 18px 28px;
          }

          .profile-card {
            padding: 22px;
            border-radius: 18px;
            box-shadow: none;
          }

          .profile-identity {
            gap: 15px;
            padding-bottom: 24px;
          }

          .profile-avatar {
            width: 64px;
            height: 64px;
            font-size: 21px;
          }

          .profile-name h2 {
            font-size: 19px;
          }

          .profile-detail {
            gap: 16px;
            padding: 16px 0;
          }

          .profile-detail-value {
            max-width: 62%;
          }

          .mobile-search {
            height: 56px;
            display: flex;
            align-items: center;
            gap: 11px;
            padding: 0 15px;
            border-radius: 15px;
            background: #f2f4f8;
            color: #8794a8;
          }

          .mobile-search svg {
            width: 24px;
            height: 24px;
            flex: 0 0 auto;
            fill: none;
            stroke: currentColor;
            stroke-width: 1.65;
            stroke-linecap: round;
            stroke-linejoin: round;
          }

          .mobile-search input {
            width: 100%;
            min-width: 0;
            border: 0;
            outline: 0;
            background: transparent;
            color: var(--cb-text);
            font-size: 17px;
          }

          .mobile-search input::placeholder {
            color: #8794a8;
          }

          .conversation-list {
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
          }

          .conversation-item {
            min-height: 92px;
            padding: 10px 22px;
            gap: 15px;
            border-bottom: 0;
          }

          .conversation-item-selected {
            background: transparent;
            box-shadow: none;
          }

          .conversation-avatar {
            width: 62px;
            height: 62px;
            border-color: rgba(24, 39, 58, 0.04);
            background: #eef2f7;
            font-size: 19px;
          }

          .conversation-item-selected .conversation-avatar {
            background: #eef2f7;
            color: var(--cb-text-soft);
            border-color: rgba(24, 39, 58, 0.04);
          }

          .conversation-details strong {
            font-size: 17px;
            font-weight: 600;
          }

          .conversation-time {
            display: none;
          }

          .conversation-chevron {
            display: block;
            width: 20px;
            height: 20px;
            margin-left: auto;
            stroke: #8794a8;
          }

          .empty-conversations {
            padding: 30px 22px;
          }

          .desktop-new-chat-fab {
            display: none;
          }

          .mobile-new-chat-fab {
            right: 24px;
            bottom: 30px;
            display: grid;
            width: 60px;
            height: 60px;
          }

          .chat-window {
            height: 100%;
            min-height: 0;
          }

          .chat-header {
            min-height: 64px;
            padding: 10px 14px;
            gap: 4px;
          }

          .mobile-back-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            flex: 0 0 auto;
            min-width: 30px;
            min-height: 42px;
            padding: 8px 4px;
            border: 0;
            background: transparent;
            color: var(--cb-text);
            font-size: 22px;
            line-height: 1;
            cursor: pointer;
          }

          .chat-header-avatar {
            width: 42px;
            height: 42px;
          }

          .chat-header-info {
            min-width: 0;
            overflow: hidden;
            flex: 1 1 auto;
          }

          .chat-header-info h2 {
            font-size: 15px;
          }

          .chat-header-info h2,
          .chat-header-info small {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .chat-content {
            display: flex;
            flex: 1 1 auto;
            flex-direction: column;
            min-height: 0;
            overflow: hidden;
          }

          .message-list {
            flex: 1 1 auto;
            min-height: 0;
            overflow-y: auto;
            overflow-x: hidden;
            overscroll-behavior: contain;
            -webkit-overflow-scrolling: touch;
            padding: 16px 12px 8px;
          }

          .message-bubble {
            max-width: 84%;
          }

          .message-actions-trigger {
            width: 28px;
            height: 34px;
            opacity: 1;
          }

          .message-actions-menu {
            min-width: 122px;
          }

          .send-message-error {
            margin: 0 10px 6px;
          }

          .message-composer {
            gap: 8px;
            padding: 8px 10px calc(8px + env(safe-area-inset-bottom));
          }

          .message-editing-bar {
            padding: 8px 9px;
          }

          .message-replying-bar {
            padding: 8px 9px;
          }

          .message-editing-bar span {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .message-composer textarea {
            min-height: 42px;
            max-height: 112px;
            touch-action: manipulation;
            -webkit-user-select: text;
            user-select: text;
          }

          .message-composer button {
            min-height: 42px;
          }

          .chat-empty-state {
            width: calc(100% - 32px);
            padding: 24px 20px;
          }
        }

        .new-chat-overlay {
          position: fixed;
          inset: 0;
          z-index: 20;
          display: grid;
          place-items: center;
          padding: 24px;
          background: rgba(17, 25, 38, 0.28);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
        }

        .new-chat-dialog {
          width: min(100%, 520px);
          max-height: min(680px, calc(100dvh - 48px));
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid var(--cb-border-strong);
          border-radius: 18px;
          background: #ffffff;
          box-shadow: 0 24px 70px rgba(24, 39, 58, 0.18);
        }

        .new-chat-header {
          flex: 0 0 auto;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding: 22px 22px 16px;
          border-bottom: 1px solid var(--cb-border);
        }

        .new-chat-header h2 {
          margin: 0;
          color: var(--cb-text);
          font-size: 20px;
          font-weight: 720;
          letter-spacing: -0.025em;
        }

        .new-chat-header p {
          margin: 6px 0 0;
          color: var(--cb-text-soft);
          font-size: 13px;
          line-height: 1.45;
        }

        .new-chat-close {
          width: 36px;
          height: 36px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          padding: 0;
          border: 1px solid var(--cb-border);
          border-radius: 10px;
          background: #ffffff;
          color: var(--cb-text-soft);
          cursor: pointer;
        }

        .new-chat-close svg {
          width: 18px;
          height: 18px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.8;
          stroke-linecap: round;
        }

        .new-chat-search-wrap {
          flex: 0 0 auto;
          padding: 16px 22px;
          border-bottom: 1px solid var(--cb-border);
        }

        .new-chat-search {
          width: 100%;
          height: 46px;
          padding: 0 13px;
          border: 1px solid var(--cb-border-strong);
          border-radius: 11px;
          outline: none;
          background: #f7f8fa;
          color: var(--cb-text);
          font-size: 14px;
        }

        .new-chat-search:focus {
          border-color: var(--cb-accent-border);
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(47, 114, 232, 0.055);
        }

        .new-chat-results {
          flex: 1 1 auto;
          min-height: 160px;
          overflow-y: auto;
          padding: 8px 0;
        }

        .new-chat-user {
          width: 100%;
          min-height: 68px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 22px;
          border: 0;
          background: transparent;
          color: inherit;
          text-align: left;
          cursor: pointer;
        }

        .new-chat-user:hover {
          background: var(--cb-surface-hover);
        }

        .new-chat-user-selected {
          background: var(--cb-accent-soft);
        }

        .new-chat-user-avatar {
          width: 44px;
          height: 44px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          overflow: hidden;
          border: 1px solid var(--cb-border);
          border-radius: 50%;
          background: #e9eef6;
          color: var(--cb-text-soft);
          font-size: 15px;
          font-weight: 700;
        }

        .new-chat-user-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .new-chat-user-info {
          min-width: 0;
          flex: 1 1 auto;
        }

        .new-chat-user-info strong {
          display: block;
          overflow: hidden;
          color: var(--cb-text);
          font-size: 14px;
          font-weight: 650;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .new-chat-user-info span {
          display: block;
          margin-top: 3px;
          overflow: hidden;
          color: var(--cb-text-muted);
          font-size: 12px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .new-chat-user-state {
          display: block;
          margin-top: 4px;
          color: var(--cb-text-muted);
          font-size: 11px;
          font-weight: 600;
        }

        .new-chat-user-state-connected,
        .new-chat-user-state-pending {
          color: var(--cb-text-soft);
        }

        .new-chat-user-unavailable {
          cursor: default;
        }

        .new-chat-user-unavailable:hover {
          background: transparent;
        }

        .new-chat-selection {
          width: 18px;
          height: 18px;
          flex: 0 0 auto;
          border: 1px solid var(--cb-border-strong);
          border-radius: 50%;
          background: #ffffff;
        }

        .new-chat-user-selected .new-chat-selection {
          border-color: var(--cb-accent);
          background: var(--cb-accent);
          box-shadow: inset 0 0 0 4px #ffffff;
        }

        .new-chat-state {
          padding: 28px 22px;
          color: var(--cb-text-muted);
          font-size: 13px;
          line-height: 1.5;
          text-align: center;
        }

        .new-chat-footer {
          flex: 0 0 auto;
          display: flex;
          justify-content: flex-end;
          gap: 9px;
          padding: 14px 22px;
          border-top: 1px solid var(--cb-border);
          background: #ffffff;
        }

        .new-chat-secondary,
        .new-chat-primary {
          min-height: 42px;
          padding: 0 16px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .new-chat-secondary {
          border: 1px solid var(--cb-border-strong);
          background: #ffffff;
          color: var(--cb-text);
        }

        .new-chat-primary {
          border: 1px solid rgba(47, 114, 232, 0.14);
          background: var(--cb-accent);
          color: #ffffff;
        }

        .new-chat-primary:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        @media (max-width: 600px) {
          .new-chat-overlay {
            align-items: end;
            padding: 0;
          }

          .new-chat-dialog {
            width: 100%;
            max-height: 82dvh;
            border-radius: 18px 18px 0 0;
            border-bottom: 0;
          }

          .new-chat-header,
          .new-chat-search-wrap,
          .new-chat-footer {
            padding-left: 18px;
            padding-right: 18px;
          }

          .new-chat-user {
            padding-left: 18px;
            padding-right: 18px;
          }
        }
      `}</style>


      <header className="messenger-header">
        <div className="messenger-brand">
          <img
            className="brand-logo"
            src="/icon-192.png"
            alt="Chatter Box logo"
            width="42"
            height="42"
          />

          <div className="messenger-brand-copy">
            <h1>
              ChatterBox
            </h1>

            <span>
              Private Messenger
            </span>
          </div>
        </div>

        <div className="desktop-header-profile">
           <button
            type="button"
            className="desktop-notification-button"
            aria-label="Message requests"
            onClick={() => setRequestsOpen(true)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
              <path d="M10 21h4" />
            </svg>

            {hasPendingMessageRequests && (
              <span className="notification-dot" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            className="desktop-profile-button"
            aria-label="Open profile"
            onClick={() => setProfileOpen(true)}
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                cx="12"
                cy="8"
                r="3.5"
              />
              <path
                d="M5.5 20c.8-3.3 3.1-5 6.5-5s5.7 1.7 6.5 5"
              />
            </svg>
          </button>

          <button
            type="button"
            className="logout-button"
            onClick={handleLogout}
          >
            Log out
          </button>
        </div>

        <div className="user-info">
          <button
            type="button"
            className="logout-button"
            onClick={handleLogout}
          >
            Log out
          </button>
        </div>
      </header>

      <main className={`messenger-layout ${selectedConversationId ? "has-selection" : ""}`}>
        <aside
          className={`conversation-sidebar ${
            selectedConversationId
              ? "mobile-conversation-hidden"
              : ""
          }`}
        >
          <div className="sidebar-header">
            <div className="sidebar-desktop-heading">
              <h2>
                Conversations
              </h2>

              <span className="conversation-count">
                {conversations.length}{" "}
                {conversations.length === 1
                  ? "conversation"
                  : "conversations"}
              </span>
            </div>

            <div className="desktop-sidebar-content">
              <label className="desktop-search">
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    cx="10.8"
                    cy="10.8"
                    r="6.7"
                  />
                  <path d="m16 16 4.3 4.3" />
                </svg>

                <input
                  type="search"
                  value={conversationSearch}
                  onChange={(event) =>
                    setConversationSearch(
                      event.target.value,
                    )
                  }
                  placeholder="Search chats..."
                  aria-label="Search conversations"
                />
              </label>
            </div>

            <button
              type="button"
              className="new-chat-button sidebar-desktop-new"
              onClick={openNewChat}
            >
              New Chat
            </button>

            <div className="mobile-sidebar-content">
              <div className="mobile-sidebar-top">
                <h2>
                  ChatterBox
                </h2>

                <div className="mobile-header-actions">
                  <button
                    type="button"
                    className="mobile-notification-button"
                    aria-label="Message requests"
                    onClick={() => setRequestsOpen(true)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                      <path d="M10 21h4" />
                    </svg>

                    {hasPendingMessageRequests && (
                      <span className="notification-dot" aria-hidden="true" />
                    )}
                  </button>

                  <button
                    type="button"
                    className="mobile-profile-button"
                    aria-label="Open profile"
                    onClick={() => setProfileOpen(true)}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <circle
                        cx="12"
                        cy="8"
                        r="3.5"
                      />
                      <path
                        d="M5.5 20c.8-3.3 3.1-5 6.5-5s5.7 1.7 6.5 5"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              <label className="mobile-search">
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    cx="10.8"
                    cy="10.8"
                    r="6.7"
                  />
                  <path d="m16 16 4.3 4.3" />
                </svg>

                <input
                  type="search"
                  value={conversationSearch}
                  onChange={(event) =>
                    setConversationSearch(
                      event.target.value,
                    )
                  }
                  placeholder="Search"
                  aria-label="Search conversations"
                />
              </label>
            </div>
          </div>

          <div className="conversation-list">
            {conversationsLoading && (
              <div className="empty-conversations">
                <p>
                  Loading conversations...
                </p>
              </div>
            )}

            {!conversationsLoading &&
              conversationError && (
                <div className="empty-conversations">
                  <p>
                    Unable to load
                    conversations
                  </p>

                  <span>
                    Please refresh the
                    page and try again.
                  </span>
                </div>
              )}

            {!conversationsLoading &&
              !conversationError &&
              conversations.length === 0 && (
                <div className="empty-conversations">
                  <p>
                    No conversations yet
                  </p>

                  <span>
                    Start a new conversation
                    to begin chatting.
                  </span>
                </div>
              )}

            {!conversationsLoading &&
              !conversationError &&
              filteredConversations.length > 0 &&
              filteredConversations.map(
                (conversation) => {
                  const otherMember =
                    getOtherMember(
                      conversation,
                    );

                  if (!otherMember) {
                    return null;
                  }

                  const displayName =
                    otherMember.user
                      .displayName ||
                    otherMember.user
                      .username;

                  const isSelected =
                    selectedConversationId ===
                    conversation.id;

                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      className={`conversation-item ${
                        isSelected
                          ? "conversation-item-selected"
                          : ""
                      }`}
                      onClick={() => {
                        setUnreadCounts((currentCounts) => {
                          if (!(conversation.id in currentCounts)) {
                            return currentCounts;
                          }

                          const nextCounts = {
                            ...currentCounts,
                          };

                          delete nextCounts[conversation.id];
                          return nextCounts;
                        });

                        setOpenMessageActionId(null);
                        setSelectedConversationId(
                          conversation.id,
                        );
                      }}
                    >
                      <div className="conversation-avatar">
                        {otherMember.user
                          .avatarUrl ? (
                          <img
                            src={
                              otherMember
                                .user
                                .avatarUrl
                            }
                            alt={`${displayName} avatar`}
                          />
                        ) : (
                          displayName
                            .charAt(0)
                            .toUpperCase()
                        )}
                      </div>

                      <div className="conversation-details">
                        <strong>
                          {displayName}
                        </strong>
                      </div>

                      {unreadCounts[conversation.id] > 0 && (
                        <span
                          className="conversation-unread-indicator"
                          aria-label={`${unreadCounts[conversation.id]} unread message${
                            unreadCounts[conversation.id] === 1 ? "" : "s"
                          }`}
                        >
                          {unreadCounts[conversation.id] > 99
                            ? "99+"
                            : unreadCounts[conversation.id]}
                        </span>
                      )}

                      <time
                        className="conversation-time"
                        dateTime={
                          conversation.updatedAt
                        }
                      >
                        {formatConversationTime(
                          conversation.updatedAt,
                        )}
                      </time>

                      <svg
                        className="conversation-chevron"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path d="m9 5 7 7-7 7" />
                      </svg>
                    </button>
                  );
                },
              )}
            {!conversationsLoading &&
              !conversationError &&
              conversations.length > 0 &&
              filteredConversations.length === 0 && (
                <div className="empty-conversations">
                  <p>
                    No conversations found
                  </p>

                  <span>
                    Try a different search.
                  </span>
                </div>
              )}
          </div>

          <button
            type="button"
            className="desktop-new-chat-fab"
            aria-label="New chat"
            onClick={openNewChat}
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          </button>

          <button
            type="button"
            className="mobile-new-chat-fab"
            aria-label="New chat"
            onClick={openNewChat}
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          </button>
        </aside>

        <section
          className={`chat-area ${
            selectedConversationId
              ? "mobile-chat-visible"
              : "mobile-chat-hidden"
          }`}
        >
          {!selectedConversation ||
          !selectedOtherMember ? (
            <div className="chat-empty-state">
              <h2>
                Welcome to Chatter Box
              </h2>

              <p>
                Select a conversation
                from the sidebar to
                start messaging.
              </p>
            </div>
          ) : (
            <div className="chat-window">
              <header className="chat-header">
                <button
                  type="button"
                  className="mobile-back-button"
                  onClick={() => setSelectedConversationId(null)}
                  aria-label="Back to conversations"
                >
                  ←
                </button>

                <div className="chat-header-avatar">
                  {selectedOtherMember
                    .user.avatarUrl ? (
                    <img
                      src={
                        selectedOtherMember
                          .user.avatarUrl
                      }
                      alt={`${selectedOtherMember.user.displayName || selectedOtherMember.user.username} avatar`}
                    />
                  ) : (
                    (
                      selectedOtherMember
                        .user
                        .displayName ||
                      selectedOtherMember
                        .user
                        .username
                    )
                      .charAt(0)
                      .toUpperCase()
                  )}
                </div>

                <div className="chat-header-info">
                  <h2>
                    {
                      selectedOtherMember
                        .user
                        .displayName ||
                      selectedOtherMember
                        .user
                        .username
                    }
                  </h2>

                  <small>@{selectedOtherMember.user.username}</small>
                </div>
              </header>

              <div className="chat-content">
                {messagesLoading ? (
                  <div className="chat-empty-state">
                    <h2>
                      Loading messages...
                    </h2>

                    <p>
                      Retrieving your
                      conversation history.
                    </p>
                  </div>
                ) : messagesError ? (
                  <div className="chat-empty-state">
                    <h2>
                      Unable to load
                      messages
                    </h2>

                    <p>
                      Please refresh the
                      page and try again.
                    </p>
                  </div>
                ) : (
                  <div
                    className="message-list"
                    ref={messageListRef}
                    onScroll={(event) => {
                      const element =
                        event.currentTarget;

                      if (
                        element.scrollTop <=
                          80 &&
                        nextCursor &&
                        !loadingOlderMessages
                      ) {
                        loadOlderMessages();
                      }

                      markVisibleMessagesAsRead();
                    }}
                  >
                    {loadingOlderMessages && (
                      <div className="older-messages-loading">
                        Loading older
                        messages...
                      </div>
                    )}

                    {messages.length === 0 ? (
                      <div className="chat-empty-state">
                        <h2>
                          Your conversation
                        </h2>

                        <p>
                          No messages yet.
                          Start the
                          conversation!
                        </p>
                      </div>
                    ) : (
                      messages.map(
                        (message) => {
                          const isOwnMessage =
                            message.senderId ===
                            user.id;

                          const status =
                            messageStatuses[
                              message.id
                            ];

                          return (
                            <div
                              key={message.id}
                              data-message-id={message.id}
                              data-message-sender-id={message.senderId}
                              className={`message-row ${
                                isOwnMessage
                                  ? "message-row-own"
                                  : "message-row-other"
                              } ${
                                highlightedMessageId === message.id
                                  ? "message-row-highlighted"
                                  : ""
                              }`}
                            >
                              <div
                                className={`message-action-wrap ${
                                  isOwnMessage
                                    ? "message-action-wrap-own"
                                    : "message-action-wrap-other"
                                }`}
                              >
                                <div
                                  className={`message-bubble ${
                                    isOwnMessage
                                      ? "message-bubble-own"
                                      : "message-bubble-other"
                                  }`}
                                >
                                  {!message.deletedAt && message.replyToMessage && (
                                    <button
                                      type="button"
                                      className={`message-reply-preview ${
                                        isOwnMessage
                                          ? "message-reply-preview-own"
                                          : "message-reply-preview-other"
                                      }`}
                                      onClick={() => {
                                        if (message.replyToMessage && !message.replyToMessage.deletedAt) {
                                          scrollToMessage(message.replyToMessage.id);
                                        }
                                      }}
                                      title={
                                        message.replyToMessage.deletedAt
                                          ? "Original message deleted"
                                          : "Jump to replied message"
                                      }
                                      disabled={Boolean(
                                        message.replyToMessage.deletedAt,
                                      )}
                                    >
                                      <span className="message-reply-label">
                                        {message.replyToMessage.deletedAt
                                          ? "Message deleted"
                                          : message.replyToMessage.sender.id === user.id
                                            ? "Replying to yourself"
                                            : `Replying to @${message.replyToMessage.sender.username}`}
                                      </span>
                                      {!message.replyToMessage.deletedAt && (
                                        <span className="message-reply-content">
                                          {message.replyToMessage.content}
                                        </span>
                                      )}
                                    </button>
                                  )}

                                  {message.deletedAt ? (
                                    <span className="deleted-message">
                                      Message deleted
                                    </span>
                                  ) : (
                                    <span>
                                      {
                                        message.content
                                      }
                                    </span>
                                  )}

                                  <time
                                    className="message-time"
                                    dateTime={
                                      message.createdAt
                                    }
                                  >
                                    {new Date(
                                      message.createdAt,
                                    ).toLocaleTimeString(
                                      [],
                                      {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      },
                                    )}
                                  </time>

                                  {isOwnMessage &&
                                    status &&
                                    !message.deletedAt && (
                                      <span
                                        className={`message-status-indicator message-status-${status}`}
                                        aria-label={`Message ${status}`}
                                      >
                                        {status === "sent"
                                          ? "✓"
                                          : "✓✓"}
                                      </span>
                                    )}
                                </div>

                                <div
                                  className={`message-actions ${
                                    openMessageActionId === message.id
                                      ? "message-actions-open"
                                      : ""
                                  }`}
                                  onPointerDown={(event) => {
                                    event.stopPropagation();
                                  }}
                                >
                                  <button
                                    type="button"
                                    className="message-actions-trigger"
                                    aria-label={`Message actions for ${
                                      message.deletedAt
                                        ? "deleted message"
                                        : "message"
                                    }`}
                                    aria-expanded={
                                      openMessageActionId === message.id
                                    }
                                    aria-haspopup="menu"
                                    onClick={() => {
                                      setOpenMessageActionId(
                                        (currentId) =>
                                          currentId === message.id
                                            ? null
                                            : message.id,
                                      );
                                    }}
                                  >
                                    <span aria-hidden="true">•••</span>
                                  </button>

                                  {openMessageActionId === message.id && (
                                    <div
                                      className="message-actions-menu"
                                      role="menu"
                                      aria-label="Message actions"
                                    >
                                      {isOwnMessage &&
                                        !message.deletedAt && (
                                          <>
                                            <button
                                              type="button"
                                              role="menuitem"
                                              onClick={() => {
                                                startEditingMessage(message);
                                              }}
                                            >
                                              Edit
                                            </button>

                                            <button
                                              type="button"
                                              role="menuitem"
                                              onClick={() => {
                                                setOpenMessageActionId(null);
                                                setMessageUpdateError("");
                                                setDeletingMessageId(message.id);
                                              }}
                                            >
                                              Delete
                                            </button>
                                          </>
                                        )}

                                      <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() => {
                                          startReplyingToMessage(message);
                                        }}
                                      >
                                        Reply
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {deletingMessageId === message.id && (
                                  <div
                                    className="message-delete-confirm"
                                    role="dialog"
                                    aria-label="Delete message confirmation"
                                    onPointerDown={(event) => {
                                      event.stopPropagation();
                                    }}
                                  >
                                    <strong>Delete message?</strong>
                                    <span>This cannot be undone.</span>

                                    <div className="message-delete-confirm-actions">
                                      <button
                                        type="button"
                                        className="message-delete-cancel"
                                        onClick={cancelDeleteMessage}
                                        disabled={deletingMessage}
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        className="message-delete-confirm-button"
                                        onClick={handleDeleteMessage}
                                        disabled={deletingMessage}
                                      >
                                        {deletingMessage ? "Deleting..." : "Delete"}
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        },
                      )
                    )}
                  </div>
                )}

                {sendMessageError && (
                  <div className="send-message-error">
                    Unable to send
                    message. Please try
                    again.
                  </div>
                )}

                {messageUpdateError && (
                  <div className="message-update-error" role="alert">
                    {messageUpdateError}
                  </div>
                )}

                {replyingToMessage && !editingMessageId && (
                  <div className="message-replying-bar message-replying-bar-above-composer">
                    <div className="message-replying-copy">
                      <strong>
                        {replyingToMessage.deletedAt
                          ? "Message deleted"
                          : replyingToMessage.sender.id === user?.id
                            ? "Replying to yourself"
                            : `Replying to @${replyingToMessage.sender.username}`}
                      </strong>
                      {!replyingToMessage.deletedAt && (
                        <span>{replyingToMessage.content}</span>
                      )}
                    </div>

                    <button
                      type="button"
                      className="message-reply-cancel-icon"
                      onClick={cancelReplyingToMessage}
                      aria-label="Cancel reply"
                    >
                      ×
                    </button>
                  </div>
                )}

                <div className={`message-composer ${
                  editingMessageId ? "message-composer-editing" : ""
                }`}>
                  {editingMessageId && (
                    <div className="message-editing-bar">
                      <div>
                        <strong>Edit message</strong>
                        <span>Update your message before saving.</span>
                      </div>

                      <button
                        type="button"
                        className="message-edit-cancel-icon"
                        onClick={cancelEditingMessage}
                        aria-label="Cancel editing"
                      >
                        ×
                      </button>
                    </div>
                  )}

                  <textarea
                    value={
                      editingMessageId
                        ? editingMessageContent
                        : messageInput
                    }
                    onChange={(event) => {
                      const value =
                        event.target.value;

                      if (editingMessageId) {
                        setEditingMessageContent(value);
                        setMessageUpdateError("");
                        return;
                      }

                      setMessageInput(value);

                      setSendMessageError(
                        false,
                      );

                    }}
                    onKeyDown={(event) => {
                      if (
                        event.key ===
                          "Enter" &&
                        !event.shiftKey
                      ) {
                        event.preventDefault();

                        if (editingMessageId) {
                          if (editingMessageContent.trim() && !updatingMessage) {
                            handleSaveEditedMessage();
                          }
                          return;
                        }

                        if (
                          messageInput.trim() &&
                          !sendingMessage
                        ) {
                          handleSendMessage();
                        }
                      }
                    }}
                    placeholder={editingMessageId ? "Edit message..." : "Type a message..."}
                    rows={1}
                    inputMode="text"
                    enterKeyHint="send"
                    autoCorrect="on"
                    autoCapitalize="sentences"
                    spellCheck
                    onFocus={(event) => {
                      requestAnimationFrame(() => {
                        const input = event.currentTarget;
                        if (!input) {
                          return;
                        }

                        input.scrollIntoView({
                          block: "nearest",
                          inline: "nearest",
                        });
                      });
                    }}
                  />

                  {editingMessageId ? (
                    <>
                      <button
                        type="button"
                        className="message-edit-cancel-button"
                        onClick={cancelEditingMessage}
                        disabled={updatingMessage}
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        onClick={handleSaveEditedMessage}
                        disabled={
                          updatingMessage ||
                          !editingMessageContent.trim()
                        }
                      >
                        {updatingMessage ? "Saving..." : "Save"}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendMessage}
                      disabled={
                        sendingMessage ||
                        !messageInput.trim()
                      }
                    >
                      {sendingMessage
                        ? "Sending..."
                        : "Send"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {newChatOpen && (
        <div
          className="new-chat-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-chat-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeNewChat();
            }
          }}
        >
          <div className="new-chat-dialog">
            {messageRequestSent ? (
              <div
                className="new-chat-state"
                role="status"
                aria-live="polite"
                style={{
                  minHeight: "180px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "16px",
                  fontWeight: 600,
                }}
              >
                Request sent
              </div>
            ) : (
              <>
            <header className="new-chat-header">
              <div>
                <h2 id="new-chat-title">New Chat</h2>
                <p>Find someone to start a conversation with.</p>
              </div>

              <button
                type="button"
                className="new-chat-close"
                aria-label="Close new chat"
                onClick={closeNewChat}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6l12 12" />
                  <path d="M18 6 6 18" />
                </svg>
              </button>
            </header>

            <div className="new-chat-search-wrap">
              <input
                className="new-chat-search"
                type="search"
                value={userSearch}
                onChange={(event) => {
                  setUserSearch(event.target.value);
                  setSelectedUser(null);
                  setMessageRequestError("");
                }}
                placeholder="Search by name or username"
                aria-label="Search users"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
              />
            </div>

            <div className="new-chat-results">
              {userSearchLoading ? (
                <div className="new-chat-state">
                  Finding users...
                </div>
              ) : userSearchError ? (
                <div className="new-chat-state">
                  Unable to find users. Please try again.
                </div>
              ) : discoverableUsers.length === 0 ? (
                <div className="new-chat-state">
                  No users found.
                </div>
              ) : (
                discoverableUsers.map((discoverableUser) => {
                  const displayName =
                    discoverableUser.displayName ||
                    discoverableUser.username;
                  const isSelected =
                    selectedUser?.id === discoverableUser.id;
                  const isUnavailable =
                    discoverableUser.relationshipState !==
                    "REQUESTABLE";

                  const relationshipLabel =
                    discoverableUser.relationshipState ===
                    "CONNECTED"
                      ? "Already connected"
                      : discoverableUser.relationshipState ===
                          "REQUEST_PENDING"
                        ? "Request pending"
                        : "Available to connect";

                  return (
                    <button
                      key={discoverableUser.id}
                      type="button"
                      className={`new-chat-user ${
                        isSelected ? "new-chat-user-selected" : ""
                      } ${
                        isUnavailable
                          ? "new-chat-user-unavailable"
                          : ""
                      }`}
                      onClick={() => {
                        setSelectedUser(discoverableUser);
                        setMessageRequestError("");
                      }}
                    >
                      <div className="new-chat-user-avatar">
                        {discoverableUser.avatarUrl ? (
                          <img
                            src={discoverableUser.avatarUrl}
                            alt={`${displayName} avatar`}
                          />
                        ) : (
                          displayName.charAt(0).toUpperCase()
                        )}
                      </div>

                      <div className="new-chat-user-info">
                        <strong>{displayName}</strong>
                        <span>@{discoverableUser.username}</span>
                        <small
                          className={`new-chat-user-state ${
                            discoverableUser.relationshipState ===
                            "CONNECTED"
                              ? "new-chat-user-state-connected"
                              : discoverableUser.relationshipState ===
                                  "REQUEST_PENDING"
                                ? "new-chat-user-state-pending"
                                : ""
                          }`}
                        >
                          {relationshipLabel}
                        </small>
                      </div>

                      <span
                        className="new-chat-selection"
                        aria-hidden="true"
                      />
                    </button>
                  );
                })
              )}
            </div>

            {messageRequestError && (
              <div
                className="new-chat-state"
                role="alert"
                style={{
                  paddingTop: "8px",
                  paddingBottom: "8px",
                  color: "var(--cb-danger)",
                }}
              >
                {messageRequestError}
              </div>
            )}

            <footer className="new-chat-footer">
              <button
                type="button"
                className="new-chat-secondary"
                onClick={closeNewChat}
              >
                Cancel
              </button>

              <button
                type="button"
                className="new-chat-primary"
                disabled={
                  !selectedUser ||
                  selectedUser.relationshipState !==
                    "REQUESTABLE" ||
                  sendingMessageRequest
                }
                onClick={handleContinueNewChat}
              >
                {sendingMessageRequest
                  ? "Sending..."
                  : selectedUser?.relationshipState ===
                      "CONNECTED"
                    ? "Already connected"
                    : selectedUser?.relationshipState ===
                        "REQUEST_PENDING"
                      ? "Request pending"
                      : "Continue"}
              </button>
            </footer>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


export default App;