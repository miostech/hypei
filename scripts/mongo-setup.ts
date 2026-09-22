import "dotenv/config";
import { MongoClient } from "mongodb";
import { COLLECTIONS, ensureMongoIndexes } from "../src/lib/database/mongo/collections";

/** Creates the MongoDB collections and their indexes (idempotent). */
async function main() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB ?? "hypei");

  const existing = new Set((await db.listCollections().toArray()).map((c) => c.name));
  for (const name of Object.values(COLLECTIONS)) {
    if (!existing.has(name)) await db.createCollection(name);
  }
  await ensureMongoIndexes(db);

  for (const name of Object.values(COLLECTIONS)) {
    const indexes = await db.collection(name).indexes();
    console.log(`✔ ${name.padEnd(20)} ${indexes.length} indexes`);
  }
  await client.close();
}

void main();
