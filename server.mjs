import process from "node:process";
import { createOrbitApplication } from "./server/app.mjs";

const app = await createOrbitApplication();
const { server, config } = app;

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => server.close(async () => {
    await app.close();
    process.exit(0);
  }));
}

server.listen(config.port, config.host, () => {
  console.log(`Orbit OS ${config.isDev ? "dev" : "production"} listening on http://${config.host}:${config.port}`);
  console.log(`Protected application path: ${config.basePath}/`);
  console.log("Persistent control-plane ready");
});
