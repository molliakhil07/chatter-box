export const CURRENT_TERMS_VERSION = "1.0";
export const CURRENT_PRIVACY_POLICY_VERSION = "1.0";

export type PolicyConsentInput = {
  termsAccepted: unknown;
  privacyPolicyAcknowledged: unknown;
};

export type PolicyConsentData = {
  termsAcceptedAt: Date;
  termsVersion: string;
  privacyPolicyAcknowledgedAt: Date;
  privacyPolicyVersion: string;
};

/**
 * Validates required registration consent and returns the fields persisted
 * with the new user. An optional timestamp keeps the function deterministic
 * in tests; production callers use the current time.
 */
export function createPolicyConsentData(
  input: PolicyConsentInput,
  acceptedAt: Date = new Date(),
): PolicyConsentData {
  if (input.termsAccepted !== true) {
    throw new Error("Terms and Conditions acceptance is required");
  }

  if (input.privacyPolicyAcknowledged !== true) {
    throw new Error("Privacy Policy acknowledgement is required");
  }

  return {
    termsAcceptedAt: acceptedAt,
    termsVersion: CURRENT_TERMS_VERSION,
    privacyPolicyAcknowledgedAt: acceptedAt,
    privacyPolicyVersion: CURRENT_PRIVACY_POLICY_VERSION,
  };
}
