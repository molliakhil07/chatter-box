
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Server } from "socket.io";
import { io as createClient, type Socket } from "socket.io-client";
import { configureSocketServer } from "../src/socket-server";

interface FakeMessage {
  id: string;
  senderId: string;
  conversationId: string;
  createdAt: Date;
}

interface FakeDatabaseOptions {
  messages?: FakeMessage[];
  memberUserIds?: string[];
  conversationId?: string;
  lastReadMessageId?: string | null;
}

function createFakeDatabase(options: FakeDatabaseOptions = {}) {
  const conversationId = options.conversationId ?? "conversation-001";
  const memberUserIds = options.memberUserIds ?? ["user-1", "user-2"];
  const messages = [...(options.messages ?? [])];
  let lastReadMessageId = options.lastReadMessageId ?? null;
  const updates: Array<{ lastReadMessageId: string }> = [];

  const database = {
    conversation: {
      findFirst: async (args: any) => {
        const requestedConversationId = args.where.id;
        const requestedUserId = args.where.members.some.userId;

        if (
          requestedConversationId === conversationId &&
          memberUserIds.includes(requestedUserId)
        ) {
          return { id: conversationId };
        }

        return null;
      },
    },

    message: {
      findMany: async (args: any) => {
        return messages
          .filter(
            (message) =>
              message.conversationId === args.where.conversationId &&
              message.senderId !== args.where.senderId.not,
          )
          .sort(
            (first, second) =>
              first.createdAt.getTime() - second.createdAt.getTime(),
          )
          .map((message) => ({
            id: message.id,
            senderId: message.senderId,
            createdAt: message.createdAt,
          }));
      },

      findFirst: async (args: any) => {
        const message = messages.find(
          (item) =>
            item.id === args.where.id &&
            item.conversationId === args.where.conversationId,
        );

        if (!message) return null;

        return {
          id: message.id,
          senderId: message.senderId,
          createdAt: message.createdAt,
        };
      },
    },

    conversationMember: {
      findUnique: async () => ({ lastReadMessageId }),

      update: async (args: any) => {
        const updatedMessageId = args.data.lastReadMessageId;
        lastReadMessageId = updatedMessageId;
        updates.push({ lastReadMessageId: updatedMessageId });

        return { lastReadMessageId };
      },
    },
  };

  return {
    database,
    updates,
    getLastReadMessageId: () => lastReadMessageId,
  };
}

interface TestEnvironmentOptions extends FakeDatabaseOptions {}

async function createTestEnvironment(
  options: TestEnvironmentOptions = {},
) {
  const httpServer = createServer();
  const ioServer = new Server(httpServer, {
    transports: ["websocket"],
  });

  const fake = createFakeDatabase(options);

  configureSocketServer(ioServer, {
    database: fake.database as never,
    validateSession: async (token: string) => {
      if (token === "valid-user-1") return "user-1";
      if (token === "valid-user-2") return "user-2";
      if (token === "valid-user-3") return "user-3";
      return null;
    },
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(0, "127.0.0.1", resolve);
  });

  const address = httpServer.address() as AddressInfo;
  const url = `http://127.0.0.1:${address.port}`;
  const clients = new Set<Socket>();

  function connect(cookie?: string): Socket {
    const client = createClient(url, {
      autoConnect: false,
      reconnection: false,
      transports: ["websocket"],
      ...(cookie ? { extraHeaders: { cookie } } : {}),
    });

    clients.add(client);
    return client;
  }

  async function close(): Promise<void> {
    for (const client of clients) {
      client.disconnect();
    }

    await new Promise<void>((resolve) => {
      ioServer.close(() => resolve());
    });
  }

  return {
    connect,
    close,
    ...fake,
  };
}

async function connectSuccessfully(client: Socket): Promise<void> {
  const connected = new Promise<void>((resolve, reject) => {
    client.once("connect", resolve);
    client.once("connect_error", reject);
  });

  client.connect();
  await connected;
}

function emitWithAck(
  client: Socket,
  eventName: string,
  ...args: any[]
): Promise<any> {
  return new Promise((resolve) => {
    client.emit(eventName, ...args, resolve);
  });
}

function collectEvents(
  client: Socket,
  eventName: string,
  expectedCount: number,
): Promise<any[]> {
  return new Promise((resolve) => {
    const received: any[] = [];

    const handler = (payload: any) => {
      received.push(payload);

      if (received.length >= expectedCount) {
        client.off(eventName, handler);
        resolve(received);
      }
    };

    client.on(eventName, handler);
  });
}

function createMessage(
  id: string,
  senderId: string,
  seconds: number,
): FakeMessage {
  return {
    id,
    senderId,
    conversationId: "conversation-001",
    createdAt: new Date(`2026-10-09T10:00:${String(seconds).padStart(2, "0")}.000Z`),
  };
}

test(
  "Socket.IO rejects connections without a session cookie",
  { timeout: 5000 },
  async (t) => {
    const environment = await createTestEnvironment();
    t.after(() => environment.close());

    const client = environment.connect();

    const connectionError = new Promise<Error>((resolve) => {
      client.once("connect_error", resolve);
    });

    client.connect();

    const error = await connectionError;

    assert.equal(error.message, "Authentication required");
    assert.equal(client.connected, false);
  },
);

test(
  "Socket.IO rejects invalid or expired sessions",
  { timeout: 5000 },
  async (t) => {
    const environment = await createTestEnvironment();
    t.after(() => environment.close());

    const client = environment.connect("session_token=expired-token");

    const connectionError = new Promise<Error>((resolve) => {
      client.once("connect_error", resolve);
    });

    client.connect();

    const error = await connectionError;

    assert.equal(error.message, "Invalid or expired session");
    assert.equal(client.connected, false);
  },
);

test(
  "Socket.IO accepts a valid session and allows a conversation member to join",
  { timeout: 5000 },
  async (t) => {
    const environment = await createTestEnvironment();
    t.after(() => environment.close());

    const client = environment.connect("session_token=valid-user-1");
    await connectSuccessfully(client);

    const acknowledgement = await emitWithAck(
      client,
      "conversation:join",
      "conversation-001",
    );

    assert.deepEqual(acknowledgement, {
      ok: true,
      conversationId: "conversation-001",
    });
  },
);

test(
  "Socket.IO rejects a non-member attempting to join a conversation",
  { timeout: 5000 },
  async (t) => {
    const environment = await createTestEnvironment();
    t.after(() => environment.close());

    const client = environment.connect("session_token=valid-user-3");
    await connectSuccessfully(client);

    const acknowledgement = await emitWithAck(
      client,
      "conversation:join",
      "conversation-001",
    );

    assert.deepEqual(acknowledgement, {
      ok: false,
      error: "Conversation not found",
    });
  },
);

test(
  "Joining a conversation emits delivered and read receipts and advances the read pointer",
  { timeout: 5000 },
  async (t) => {
    const environment = await createTestEnvironment({
      messages: [
        createMessage("message-1", "user-2", 1),
        createMessage("message-2", "user-2", 2),
      ],
    });
    t.after(() => environment.close());

    const receiver = environment.connect("session_token=valid-user-1");
    const sender = environment.connect("session_token=valid-user-2");

    await Promise.all([
      connectSuccessfully(receiver),
      connectSuccessfully(sender),
    ]);

    const receiptEvents = collectEvents(sender, "message_status", 4);

    const acknowledgement = await emitWithAck(
      receiver,
      "conversation:join",
      "conversation-001",
    );

    const receipts = await receiptEvents;

    assert.deepEqual(acknowledgement, {
      ok: true,
      conversationId: "conversation-001",
    });

    assert.deepEqual(
      receipts.map((receipt) => ({
        messageId: receipt.messageId,
        status: receipt.status,
      })),
      [
        { messageId: "message-1", status: "delivered" },
        { messageId: "message-2", status: "delivered" },
        { messageId: "message-1", status: "read" },
        { messageId: "message-2", status: "read" },
      ],
    );

    assert.equal(environment.getLastReadMessageId(), "message-2");
    assert.deepEqual(environment.updates, [
      { lastReadMessageId: "message-2" },
    ]);
  },
);

test(
  "message_read advances the read pointer and emits a read receipt to the sender",
  { timeout: 5000 },
  async (t) => {
    const environment = await createTestEnvironment({
      messages: [createMessage("message-1", "user-2", 1)],
    });
    t.after(() => environment.close());

    const reader = environment.connect("session_token=valid-user-1");
    const sender = environment.connect("session_token=valid-user-2");

    await Promise.all([
      connectSuccessfully(reader),
      connectSuccessfully(sender),
    ]);

    const receiptEvent = collectEvents(sender, "message_status", 1);

    const acknowledgement = await emitWithAck(
      reader,
      "message_read",
      "conversation-001",
      "message-1",
    );

    const receipts = await receiptEvent;

    assert.deepEqual(acknowledgement, {
      ok: true,
      messageId: "message-1",
    });

    assert.deepEqual(receipts, [
      { messageId: "message-1", status: "read" },
    ]);

    assert.equal(environment.getLastReadMessageId(), "message-1");
    assert.deepEqual(environment.updates, [
      { lastReadMessageId: "message-1" },
    ]);
  },
);

test(
  "Invalid conversation and message IDs return the expected acknowledgements",
  { timeout: 5000 },
  async (t) => {
    const environment = await createTestEnvironment();
    t.after(() => environment.close());

    const client = environment.connect("session_token=valid-user-1");
    await connectSuccessfully(client);

    assert.deepEqual(
      await emitWithAck(client, "conversation:join", ""),
      { ok: false, error: "conversationId is required" },
    );

    assert.deepEqual(
      await emitWithAck(client, "message_read", "", "message-1"),
      { ok: false, error: "conversationId is required" },
    );

    assert.deepEqual(
      await emitWithAck(client, "message_read", "conversation-001", ""),
      { ok: false, error: "messageId is required" },
    );
  },
);

test(
  "Unknown conversations and messages are rejected",
  { timeout: 5000 },
  async (t) => {
    const environment = await createTestEnvironment();
    t.after(() => environment.close());

    const client = environment.connect("session_token=valid-user-1");
    await connectSuccessfully(client);

    assert.deepEqual(
      await emitWithAck(client, "conversation:join", "unknown-conversation"),
      { ok: false, error: "Conversation not found" },
    );

    assert.deepEqual(
      await emitWithAck(
        client,
        "message_read",
        "conversation-001",
        "unknown-message",
      ),
      { ok: false, error: "Message not found" },
    );
  },
);

test(
  "Reading your own message does not advance the read pointer or emit a read receipt",
  { timeout: 5000 },
  async (t) => {
    const environment = await createTestEnvironment({
      messages: [createMessage("own-message", "user-1", 1)],
    });
    t.after(() => environment.close());

    const reader = environment.connect("session_token=valid-user-1");
    const sameUserSecondClient = environment.connect(
      "session_token=valid-user-1",
    );

    await Promise.all([
      connectSuccessfully(reader),
      connectSuccessfully(sameUserSecondClient),
    ]);

    let receivedReceipt = false;

    const receiptHandler = () => {
      receivedReceipt = true;
    };

    sameUserSecondClient.on("message_status", receiptHandler);

    const acknowledgement = await emitWithAck(
      reader,
      "message_read",
      "conversation-001",
      "own-message",
    );

    await new Promise((resolve) => setTimeout(resolve, 100));
    sameUserSecondClient.off("message_status", receiptHandler);

    assert.deepEqual(acknowledgement, {
      ok: true,
      messageId: "own-message",
    });

    assert.equal(environment.getLastReadMessageId(), null);
    assert.deepEqual(environment.updates, []);
    assert.equal(receivedReceipt, false);
  },
);
