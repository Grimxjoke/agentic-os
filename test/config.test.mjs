import assert from "node:assert/strict";
import { test } from "node:test";
import { loadConfig } from "../server/config.mjs";

test("authentication mode rejects removed or unknown providers", () => {
  assert.throws(() => loadConfig({ authMode: "ngrok_google" }), /Invalid ORBIT_AUTH_MODE/);
  assert.throws(() => loadConfig({ authMode: "unknown" }), /Invalid ORBIT_AUTH_MODE/);
});

test("public mode requires a loopback-only Orbit host", () => {
  assert.equal(loadConfig({ authMode: "none", host: "127.0.0.1" }).authMode, "none");
  assert.throws(() => loadConfig({ authMode: "none", host: "0.0.0.0" }), /loopback-only/);
});
