import { MongoClient, type Db } from "mongodb";

const globalForMongo = globalThis as unknown as { __ripayMongo?: Promise<MongoClient> };

export function getMongoClient(): Promise<MongoClient> {
  if (!globalForMongo.__ripayMongo) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is not configured");
    const client = new MongoClient(uri, { appName: "ripay-web", serverSelectionTimeoutMS: 5_000 });
    globalForMongo.__ripayMongo = client.connect().catch((error) => {
      globalForMongo.__ripayMongo = undefined;
      throw error;
    });
  }
  return globalForMongo.__ripayMongo;
}

export async function getMongoDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(process.env.MONGODB_DB ?? "ripay");
}
