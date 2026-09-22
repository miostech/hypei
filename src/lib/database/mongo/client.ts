import { MongoClient, type Db } from "mongodb";

const globalForMongo = globalThis as unknown as { __hypeiMongo?: Promise<MongoClient> };

export function getMongoClient(): Promise<MongoClient> {
  if (!globalForMongo.__hypeiMongo) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is not configured");
    const client = new MongoClient(uri, { appName: "hypei-web", serverSelectionTimeoutMS: 5_000 });
    globalForMongo.__hypeiMongo = client.connect().catch((error) => {
      globalForMongo.__hypeiMongo = undefined;
      throw error;
    });
  }
  return globalForMongo.__hypeiMongo;
}

export async function getMongoDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(process.env.MONGODB_DB ?? "hypei");
}
