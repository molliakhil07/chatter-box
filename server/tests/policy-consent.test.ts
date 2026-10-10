import assert from "node:assert/strict";
import test from "node:test";

import {
  createPolicyConsentData,
  CURRENT_PRIVACY_POLICY_VERSION,
  CURRENT_TERMS_VERSION,
} from "../src/utils/policy-consent";

test("registration consent is rejected when Terms are not accepted", () => {
  assert.throws(
    () =>
      createPolicyConsentData({
        termsAccepted: false,
        privacyPolicyAcknowledged: true,
      }),
    {
      message: "Terms and Conditions acceptance is required",
    },
  );
});

test("registration consent is rejected when Privacy Policy is not acknowledged", () => {
  assert.throws(
    () =>
      createPolicyConsentData({
        termsAccepted: true,
        privacyPolicyAcknowledged: false,
      }),
    {
      message: "Privacy Policy acknowledgement is required",
    },
  );
});

test("registration consent requires literal true values, not truthy values", () => {
  assert.throws(() =>
    createPolicyConsentData({
      termsAccepted: "true",
      privacyPolicyAcknowledged: 1,
    }),
  );
});

test("valid consent returns both timestamps and the current policy versions", () => {
  const acceptedAt = new Date("2026-10-10T10:30:00.000Z");

  const result = createPolicyConsentData(
    {
      termsAccepted: true,
      privacyPolicyAcknowledged: true,
    },
    acceptedAt,
  );

  assert.deepEqual(result, {
    termsAcceptedAt: acceptedAt,
    termsVersion: CURRENT_TERMS_VERSION,
    privacyPolicyAcknowledgedAt: acceptedAt,
    privacyPolicyVersion: CURRENT_PRIVACY_POLICY_VERSION,
  });
  assert.equal(result.termsAcceptedAt, result.privacyPolicyAcknowledgedAt);
  assert.equal(result.termsVersion, "1.0");
  assert.equal(result.privacyPolicyVersion, "1.0");
});
