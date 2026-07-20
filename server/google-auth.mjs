import { OAuth2Client } from "google-auth-library";

export function createGoogleIdentity({ clientId, allowedEmail, client = new OAuth2Client() }) {
  const normalizedAllowedEmail = String(allowedEmail || "").trim().toLowerCase();

  async function verify(credential) {
    if (typeof credential !== "string" || credential.length < 100 || credential.length > 10_000) {
      throw new Error("Invalid Google credential");
    }
    const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
    const payload = ticket.getPayload() || {};
    const email = String(payload.email || "").trim().toLowerCase();
    if (!payload.email_verified || email !== normalizedAllowedEmail) {
      const error = new Error("This Google account is not authorized for Orbit");
      error.code = "google_account_denied";
      throw error;
    }
    return { subject: String(payload.sub || ""), email, name: String(payload.name || "") };
  }

  return { verify };
}
