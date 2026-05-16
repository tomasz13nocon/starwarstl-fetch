import { MongoClient, type Db } from "mongodb";
import { MONGO_URI } from "./const.ts";
import { log } from "./util.ts";

export const client = new MongoClient(MONGO_URI);
export const db: Db = client.db("starwarstl");

export async function closeDb(): Promise<void> {
  log.info("Closing DB connection");
  await client.close();
}
