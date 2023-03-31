import { MongoClient } from "mongodb";
import { DB_CONN_STRING } from "./const.js";
import { log } from "./util.js";

const client = new MongoClient(DB_CONN_STRING);
await client.connect();
export const db = client.db("starwarstl");

export async function closeDb() {
  log.info("Closing DB connection");
  await client.close();
}
