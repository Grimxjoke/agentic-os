import assert from "node:assert/strict";
import test from "node:test";
import { createGoogleIdentity } from "../server/google-auth.mjs";

test("Google identity accepts only the configured verified email", async () => {
  const client = { async verifyIdToken({ audience }) {
    assert.equal(audience, "orbit-client.apps.googleusercontent.com");
    return { getPayload: () => ({ sub: "google-user-1", email: "COINCCRYPTO@GMAIL.COM", email_verified: true, name: "Orbit Owner" }) };
  } };
  const identity = createGoogleIdentity({
    clientId: "orbit-client.apps.googleusercontent.com",
    allowedEmail: "coinccrypto@gmail.com",
    client,
  });
  assert.deepEqual(await identity.verify("x".repeat(101)), {
    subject: "google-user-1",
    email: "coinccrypto@gmail.com",
    name: "Orbit Owner",
  });
});

test("Google identity rejects another account", async () => {
  const client = { async verifyIdToken() {
    return { getPayload: () => ({ sub: "other", email: "other@example.com", email_verified: true }) };
  } };
  const identity = createGoogleIdentity({ clientId: "client", allowedEmail: "coinccrypto@gmail.com", client });
  await assert.rejects(() => identity.verify("x".repeat(101)), { code: "google_account_denied" });
});
