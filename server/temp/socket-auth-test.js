const fs = require("fs");
const { io } = require("socket.io-client");

const CONVERSATION_ID = "cd087124-4d94-48e4-8c8c-c07308cc64ed";

function getSessionToken(cookieFile) {
  const content = fs.readFileSync(cookieFile, "utf8");

  const line = content
    .split("\n")
    .find((entry) => entry.includes("\tsession_token\t"));

  if (!line) {
    throw new Error(`Session cookie not found in ${cookieFile}`);
  }

  const token = line.split("\t")[6].trim();

  if (!/^[a-f0-9]+$/i.test(token)) {
    throw new Error(`Invalid session token in ${cookieFile}`);
  }

  return token;
}

const nikhilToken = getSessionToken("cookies.txt");
const chatTestToken = getSessionToken("chatcookies.txt");

let nikhil;
let chatTest;
let messageId;

function fail(message) {
  console.error(message);

  if (nikhil) {
    nikhil.disconnect();
  }

  if (chatTest) {
    chatTest.disconnect();
  }

  process.exit(1);
}

function pass() {
  console.log("MESSAGE_READ_TEST_PASSED");

  nikhil.disconnect();
  chatTest.disconnect();

  process.exit(0);
}

/* ---------------- NIKHIL SOCKET ---------------- */

nikhil = io("http://localhost:5000", {
  transports: ["polling"],
  extraHeaders: {
    Cookie: `session_token=${nikhilToken}`,
  },
});

nikhil.on("connect", () => {
  console.log("NIKHIL_CONNECTED");

  nikhil.emit(
    "conversation:join",
    CONVERSATION_ID,
    (response) => {
      console.log("NIKHIL_JOIN:", response);

      if (!response?.ok) {
        fail("NIKHIL_JOIN_FAILED");
      }

      startChatTestSocket();
    },
  );
});

nikhil.on("message_status", (payload) => {
  console.log("MESSAGE_STATUS_RECEIVED:", payload);

  if (payload?.messageId !== messageId) {
    fail("MESSAGE_READ_TEST_FAILED: messageId mismatch");
  }

  console.log("MESSAGE_STATUS_MESSAGE_ID_CONFIRMED");

  pass();
});

nikhil.on("connect_error", (error) => {
  console.error("NIKHIL_SOCKET_ERROR:", error.message);
  process.exit(1);
});

/* ---------------- CHAT TEST SOCKET ---------------- */

function startChatTestSocket() {
  chatTest = io("http://localhost:5000", {
    transports: ["polling"],
    extraHeaders: {
      Cookie: `session_token=${chatTestToken}`,
    },
  });

  chatTest.on("connect", () => {
    console.log("CHAT_TEST_CONNECTED");

    chatTest.emit(
      "conversation:join",
      CONVERSATION_ID,
      (response) => {
        console.log("CHAT_TEST_JOIN:", response);

        if (!response?.ok) {
          fail("CHAT_TEST_JOIN_FAILED");
        }

        createTestMessage();
      },
    );
  });

  chatTest.on("connect_error", (error) => {
    console.error("CHAT_TEST_SOCKET_ERROR:", error.message);
    fail("CHAT_TEST_SOCKET_CONNECTION_FAILED");
  });
}

/* ---------------- CREATE TEST MESSAGE ---------------- */

async function createTestMessage() {
  try {
    console.log("CREATING_TEST_MESSAGE");

    const response = await fetch(
      `http://localhost:5000/api/conversations/${CONVERSATION_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_token=${nikhilToken}`,
        },
        body: JSON.stringify({
          content: "3C-15C read receipt test",
        }),
      },
    );

    const data = await response.json();

    console.log("MESSAGE_CREATE_STATUS:", response.status);

    if (!response.ok || !data?.message?.id) {
      console.error("MESSAGE_CREATE_RESPONSE:", data);
      fail("MESSAGE_CREATE_FAILED");
    }

    messageId = data.message.id;

    console.log("TEST_MESSAGE_CREATED:", messageId);

    setTimeout(() => {
      sendMessageRead();
    }, 500);
  } catch (error) {
    console.error("MESSAGE_CREATE_ERROR:", error);
    fail("MESSAGE_CREATE_REQUEST_FAILED");
  }
}

/* ---------------- MESSAGE READ ---------------- */

function sendMessageRead() {
  console.log("CHAT_TEST_SENDING_MESSAGE_READ");

  chatTest.emit(
    "message_read",
    CONVERSATION_ID,
    messageId,
    (response) => {
      console.log("MESSAGE_READ_RESPONSE:", response);

      if (!response?.ok) {
        fail("MESSAGE_READ_FAILED");
      }

      if (response?.messageId !== messageId) {
        fail("MESSAGE_READ_TEST_FAILED: acknowledgement messageId mismatch");
      }

      console.log("MESSAGE_READ_ACK_CONFIRMED");
    },
  );
}

/* ---------------- TIMEOUT ---------------- */

setTimeout(() => {
  fail("TIMEOUT_WAITING_FOR_MESSAGE_STATUS");
}, 15000);