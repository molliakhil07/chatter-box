
import test from "node:test";
import assert from "node:assert/strict";
import type { Server } from "socket.io";

import {
  setSocketIO,
  getSocketIO,
  emitToConversation,
  emitToUser,
  emitMessageStatus,
  emitMessageRead,
} from "../src/socket";

type EmittedEvent = {
  room: string;
  event: string;
  payload: unknown;
};

function createFakeSocketServer() {
  const emitted: EmittedEvent[] = [];

  const fakeServer = {
    to(room: string) {
      return {
        emit(event: string, payload: unknown) {
          emitted.push({ room, event, payload });
          return true;
        },
      };
    },
  };

  return {
    server: fakeServer as unknown as Server,
    emitted,
  };
}

test("setSocketIO and getSocketIO retain the configured server", () => {
  const { server } = createFakeSocketServer();

  setSocketIO(server);

  assert.equal(getSocketIO(), server);
});

test("emitToConversation emits to the correct conversation room", () => {
  const { server, emitted } = createFakeSocketServer();
  const payload = { messageId: "message-001", content: "Hello" };

  setSocketIO(server);
  emitToConversation("conversation-001", "new_message", payload);

  assert.deepEqual(emitted, [
    {
      room: "conversation:conversation-001",
      event: "new_message",
      payload,
    },
  ]);
});

test("emitToUser emits to the correct private user room", () => {
  const { server, emitted } = createFakeSocketServer();
  const payload = { messageId: "message-002", status: "delivered" };

  setSocketIO(server);
  emitToUser("user-002", "message_status", payload);

  assert.deepEqual(emitted, [
    {
      room: "user:user-002",
      event: "message_status",
      payload,
    },
  ]);
});

test("emitMessageStatus emits message_status to the conversation", () => {
  const { server, emitted } = createFakeSocketServer();
  const payload = { messageId: "message-003", status: "read" };

  setSocketIO(server);
  emitMessageStatus("conversation-003", payload);

  assert.deepEqual(emitted, [
    {
      room: "conversation:conversation-003",
      event: "message_status",
      payload,
    },
  ]);
});

test("emitMessageRead uses the existing message_status event", () => {
  const { server, emitted } = createFakeSocketServer();
  const payload = { messageId: "message-004", status: "read" };

  setSocketIO(server);
  emitMessageRead("conversation-004", payload);

  assert.deepEqual(emitted, [
    {
      room: "conversation:conversation-004",
      event: "message_status",
      payload,
    },
  ]);
});
