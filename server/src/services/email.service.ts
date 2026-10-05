const RESEND_API_URL = "https://api.resend.com/emails";

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

export async function sendVerificationEmail(input: {
  to: string;
  displayName: string | null;
  verificationUrl: string;
}): Promise<void> {
  const apiKey = getRequiredEnv("RESEND_API_KEY");
  const from = getRequiredEnv("RESEND_FROM_EMAIL");

  const recipientName = input.displayName?.trim() || "there";

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: "Verify your Chatter Box email",
      html: `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f7f8fa;color:#151922;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
      <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:32px;">
        <h1 style="margin:0 0 16px;font-size:28px;">Welcome to Chatter Box</h1>
        <p style="margin:0 0 12px;font-size:16px;line-height:1.6;">Hi ${escapeHtml(recipientName)},</p>
        <p style="margin:0 0 24px;font-size:16px;line-height:1.6;">Please verify your email address to activate your Chatter Box account.</p>
        <a href="${escapeHtml(input.verificationUrl)}" style="display:inline-block;padding:13px 20px;background:#111214;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;">Verify Email</a>
        <p style="margin:24px 0 0;color:#747b87;font-size:13px;line-height:1.6;">This verification link expires in 24 hours. If you did not create this account, you can ignore this email.</p>
      </div>
    </div>
  </body>
</html>`,
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    console.error("Verification email provider rejected the request:", details);
    throw new Error("Unable to send verification email");
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
