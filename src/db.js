import { MongoClient } from "mongodb";
import { MONGO_URI } from "./const.js";
import { log } from "./util.js";

const client = new MongoClient(MONGO_URI);
await client.connect();

export const db = client.db("starwarstl");

export { client };

export async function closeDb() {
  log.info("Closing DB connection");
  await client.close();
}
