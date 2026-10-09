
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import { hashPassword } from "../src/services/auth.service";
import { createSessionService } from "../src/services/session.service";

const testPassword = "ChatterBox-Test-Password-123!";

async function createTestUser() {
  return {
    id: "test-user-001",
    username: "testuser",
    email: "test@example.com",
    passwordHash: await hashPassword(testPassword),
    displayName: "Test User",
    avatarUrl: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function makeDatabase(overrides: {
  findFirst?: (args: any) => Promise<any>;
  createSession?: (args: any) => Promise<any>;
  findUnique?: (args: any) => Promise<any>;
} = {}) {
  return {
    user: {
      findFirst: overrides.findFirst ?? (async () => null),
    },
    session: {
      create: overrides.createSession ?? (async () => ({})),
      findUnique: overrides.findUnique ?? (async () => null),
    },
  };
}

test("authenticateUser returns the public user for valid credentials", async () => {
  const user = await createTestUser();
  const database = makeDatabase({
    findFirst: async () => user,
  });

  const service = createSessionService({
    database: database as never,
  });

  const result = await service.authenticateUser(
    "testuser",
    testPassword,
  );

  assert.ok(result);
  assert.equal(result.id, user.id);
  assert.equal(result.username, user.username);
  assert.equal(result.email, user.email);
  assert.equal(result.displayName, user.displayName);
  assert.equal(result.avatarUrl, user.avatarUrl);
  assert.equal("passwordHash" in result, false);
});

test("authenticateUser returns null for an unknown account", async () => {
  const service = createSessionService({
    database: makeDatabase() as never,
  });

  const result = await service.authenticateUser(
    "unknown@example.com",
    testPassword,
  );

  assert.equal(result, null);
});

test("authenticateUser returns null for an incorrect password", async () => {
  const user = await createTestUser();
  const database = makeDatabase({
    findFirst: async () => user,
  });

  const service = createSessionService({
    database: database as never,
  });

  const result = await service.authenticateUser(
    "testuser",
    "Wrong-Password-456!",
  );

  assert.equal(result, null);
});

test("createSession returns a random token and stores only its SHA-256 hash", async () => {
  let storedData: any;

  const database = makeDatabase({
    createSession: async (args) => {
      storedData = args.data;
      return {};
    },
  });

  const service = createSessionService({
    database: database as never,
  });

  const before = Date.now();
  const result = await service.createSession("test-user-001");
  const after = Date.now();

  assert.match(result.token, /^[a-f0-9]{64}$/);
  assert.ok(storedData);

  const expectedHash = crypto
    .createHash("sha256")
    .update(result.token)
    .digest("hex");

  assert.equal(storedData.tokenHash, expectedHash);
  assert.notEqual(storedData.tokenHash, result.token);
  assert.equal(storedData.userId, "test-user-001");

  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  const expiresAt = result.expiresAt.getTime();

  assert.ok(expiresAt >= before + thirtyDays);
  assert.ok(expiresAt <= after + thirtyDays);
});

test("validateSession returns the user ID for a valid session", async () => {
  const token = "a".repeat(64);
  const tokenHash = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  const database = makeDatabase({
    findUnique: async () => ({
      userId: "test-user-001",
      tokenHash,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    }),
  });

  const service = createSessionService({
    database: database as never,
  });

  assert.equal(
    await service.validateSession(token),
    "test-user-001",
  );
});

test("validateSession returns null when the session does not exist", async () => {
  const service = createSessionService({
    database: makeDatabase() as never,
  });

  assert.equal(
    await service.validateSession("unknown-session-token"),
    null,
  );
});

test("validateSession rejects expired sessions", async () => {
  const database = makeDatabase({
    findUnique: async () => ({
      userId: "test-user-001",
      tokenHash: "unused-hash",
      expiresAt: new Date(Date.now() - 60_000),
      revokedAt: null,
    }),
  });

  const service = createSessionService({
    database: database as never,
  });

  assert.equal(
    await service.validateSession("expired-session-token"),
    null,
  );
});

test("validateSession rejects revoked sessions", async () => {
  const database = makeDatabase({
    findUnique: async () => ({
      userId: "test-user-001",
      tokenHash: "unused-hash",
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
    }),
  });

  const service = createSessionService({
    database: database as never,
  });

  assert.equal(
    await service.validateSession("revoked-session-token"),
    null,
  );
});
