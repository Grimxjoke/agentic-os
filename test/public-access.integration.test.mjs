import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createOrbitApplication } from "../server/app.mjs";

test("public mode serves Orbit pages and APIs without a session", async () => {
  const dataDirectory = await mkdtemp(join(tmpdir(), "orbit-public-access-"));
  const app = await createOrbitApplication({
    authMode: "none",
    host: "127.0.0.1",
    dataDirectory,
    workspace: process.cwd(),
  });
  try {
    app.server.listen(0, "127.0.0.1");
    await once(app.server, "listening");
    const { port } = app.server.address();
    const origin = `http://127.0.0.1:${port}`;

    const page = await fetch(`${origin}/orbit/observatory`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /<div id="root"><\/div>/);

    const api = await fetch(`${origin}/orbit/api/health`);
    assert.equal(api.status, 200);
    assert.equal((await api.json()).ok, true);
  } finally {
    await new Promise((resolve) => app.server.close(resolve));
    await app.close();
    await rm(dataDirectory, { recursive: true, force: true });
  }
});
