import assert from "node:assert/strict";
import { test } from "node:test";
import { assertAllowed, PolicyError, policyFor } from "../server/policies.mjs";

test("policies allow bounded autonomy and deny sensitive controls", () => {
  assert.deepEqual(assertAllowed("chat.plan"), { risk: "A", allowed: true, confirmation: false });
  assert.deepEqual(assertAllowed("chat.build"), { risk: "B", allowed: true, confirmation: false });
  assert.equal(policyFor("database.backup").allowed, true);
  assert.equal(policyFor("agents.write").risk, "B");
  assert.equal(policyFor("teams.write").allowed, true);
  assert.equal(policyFor("runs.start").risk, "B");
  assert.equal(policyFor("runs.cancel").allowed, true);
  assert.equal(policyFor("service.control").risk, "C");
  assert.throws(() => assertAllowed("service.control"), PolicyError);
  assert.throws(() => assertAllowed("trading.live"), /non autorisée/);
  assert.throws(() => assertAllowed("unknown.action"), PolicyError);
});
