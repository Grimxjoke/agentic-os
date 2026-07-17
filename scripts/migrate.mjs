import { openDatabase, schemaVersion } from "../server/database.mjs";

const database = await openDatabase();
try {
  console.log(`Orbit schema v${schemaVersion(database.db)} ready`);
} finally {
  database.db.close();
}
