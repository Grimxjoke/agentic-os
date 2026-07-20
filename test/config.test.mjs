import assert from "node:assert/strict";
import { test } from "node:test";
import { loadConfig } from "../server/config.mjs";

test("ngrok Google authentication requires a loopback-only Orbit host", () => {
  assert.equal(loadConfig({ authMode: "ngrok_google", host: "127.0.0.1" }).authMode, "ngrok_google");
  assert.throws(() => loadConfig({ authMode: "ngrok_google", host: "0.0.0.0" }), /loopback-only/);
  assert.throws(() => loadConfig({ authMode: "unknown" }), /Invalid ORBIT_AUTH_MODE/);
});
