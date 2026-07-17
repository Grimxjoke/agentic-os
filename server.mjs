import process from "node:process";
import { createOrbitApplication } from "./server/app.mjs";

const app = await createOrbitApplication();
const { server, config } = app;

let shuttingDown = false;

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  const closed = new Promise((resolve) => server.close(resolve));
  server.closeAllConnections?.();
  try {
    await app.close();
    await closed;
    process.exit(0);
  } catch (error) {
    console.error("Orbit shutdown failed", error);
    process.exit(1);
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, shutdown);

server.listen(config.port, config.host, () => {
  console.log(`Orbit OS ${config.isDev ? "dev" : "production"} listening on http://${config.host}:${config.port}`);
  console.log(`Protected application path: ${config.basePath}/`);
  console.log("Persistent control-plane ready");
});
