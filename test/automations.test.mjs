import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createAutomationService, nextScheduledAt } from "../server/automations.mjs";
import { openDatabase } from "../server/database.mjs";
import { parseWorkflowInput } from "../server/schemas.mjs";
import { ControlPlaneStore } from "../server/store.mjs";

async function setup() {
  const directory = await mkdtemp(join(tmpdir(), "orbit-automations-"));
  let now = new Date("2026-07-21T06:00:00.000Z");
  const opened = await openDatabase({ dataDirectory: directory });
  const clock = () => now.toISOString();
  return { directory, ...opened, clock, setNow: (value) => { now = new Date(value); } };
}

const definition = {
  start: "start",
  nodes: [
    { id: "start", kind: "trigger" },
    { id: "approval", kind: "approval", risk: "C", title: "Review research action", detail: "A bounded research action needs approval.", expiresInSeconds: 60 },
    { id: "approved", kind: "notify", message: "Approved branch continued" },
    { id: "rejected", kind: "notify", message: "Rejected branch continued" },
    { id: "parallel", kind: "notify", message: "Independent branch continued" },
  ],
  edges: [
    { from: "start", to: "approval" }, { from: "start", to: "parallel" },
    { from: "approval", to: "approved", when: "success" }, { from: "approval", to: "rejected", when: "rejected" },
  ],
};

test("workflow execution leaves independent branches running while an approval waits", async () => {
  const env = await setup();
  try {
    const service = createAutomationService({ store: new ControlPlaneStore(env.db, env.clock) });
    const workflow = service.create(parseWorkflowInput({ name: "Research review", description: "", enabled: true, definition }));
    const started = service.start(workflow.id, { occurrenceKey: "manual:one" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    let run = service.runDetail(started.id);
    assert.equal(run.status, "waiting");
    assert.equal(run.steps.find((step) => step.nodeId === "parallel").status, "completed");
    const request = service.inbox().find((item) => item.workflowRunId === run.id);
    assert.equal(request.status, "pending");
    assert.equal(service.resolveInbox(request.id, "approved", "Reviewed").changed, true);
    await new Promise((resolve) => setTimeout(resolve, 10));
    run = service.runDetail(started.id);
    assert.equal(run.status, "completed");
    assert.ok(run.steps.some((step) => step.nodeId === "approved" && step.status === "completed"));
    assert.equal(service.resolveInbox(request.id, "approved").changed, false);
  } finally { env.db.close(); await rm(env.directory, { recursive: true, force: true }); }
});

test("expired approvals continue only the rejection branch and schedules use UTC instants", async () => {
  const env = await setup();
  try {
    const service = createAutomationService({ store: new ControlPlaneStore(env.db, env.clock) });
    const workflow = service.create(parseWorkflowInput({ name: "Expiry path", description: "", enabled: true, definition }));
    const started = service.start(workflow.id, { occurrenceKey: "manual:expiry" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    env.setNow("2026-07-21T06:02:00.000Z");
    service.tick();
    await new Promise((resolve) => setTimeout(resolve, 10));
    const run = service.runDetail(started.id);
    assert.equal(run.status, "completed");
    assert.ok(run.steps.some((step) => step.nodeId === "rejected" && step.status === "completed"));
    assert.equal(nextScheduledAt({ kind: "daily", at: "06:00", timezone: "UTC" }, new Date("2026-07-21T05:59:30Z")), "2026-07-21T06:00:00.000Z");
  } finally { env.db.close(); await rm(env.directory, { recursive: true, force: true }); }
});
