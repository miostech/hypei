import { MongoClient, type Db } from "mongodb";

const globalForMongo = globalThis as unknown as { __kabrunMongo?: Promise<MongoClient> };

export function getMongoClient(): Promise<MongoClient> {
  if (!globalForMongo.__kabrunMongo) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is not configured");
    const client = new MongoClient(uri, { appName: "kabrun-web", serverSelectionTimeoutMS: 5_000 });
    globalForMongo.__kabrunMongo = client.connect().catch((error) => {
      globalForMongo.__kabrunMongo = undefined;
      throw error;
    });
  }
  return globalForMongo.__kabrunMongo;
}

export async function getMongoDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(process.env.MONGODB_DB ?? "kabrun");
}
