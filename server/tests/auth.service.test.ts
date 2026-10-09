import test from "node:test";
import assert from "node:assert/strict";

import {
  hashPassword,
  verifyPassword,
} from "../src/services/auth.service";

test("hashPassword returns a hash instead of the plaintext password", async () => {
  const password = "ChatterBox-Test-Password-123!";
  const passwordHash = await hashPassword(password);

  assert.notEqual(passwordHash, password);
  assert.ok(passwordHash.startsWith("$argon2id$"));
});

test("verifyPassword accepts the correct password", async () => {
  const password = "ChatterBox-Test-Password-123!";
  const passwordHash = await hashPassword(password);

  assert.equal(await verifyPassword(password, passwordHash), true);
});

test("verifyPassword rejects an incorrect password", async () => {
  const passwordHash = await hashPassword(
    "ChatterBox-Test-Password-123!",
  );

  assert.equal(
    await verifyPassword("Incorrect-Password-456!", passwordHash),
    false,
  );
});