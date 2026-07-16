import { backupDatabase, openDatabase } from "../server/database.mjs";

const database = await openDatabase();
try {
  const result = await backupDatabase(database.db, database.directory);
  console.log(`${result.filename} (${result.bytes} bytes)`);
} finally {
  database.db.close();
}
