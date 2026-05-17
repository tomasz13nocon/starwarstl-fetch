import { MongoClient, type Db } from "mongodb";
import { MONGO_URI } from "./const.ts";
import { log } from "./util.ts";
import type {
  AppearanceCollectionDocument,
  ListDocument,
  MediaDocument,
  MetaDocument,
  MissingMediaDocument,
  SeriesDocument,
} from "./types/db.ts";

export const client = new MongoClient(MONGO_URI);
export const db: Db = client.db("starwarstl");

export const collections = {
  media: () => db.collection<MediaDocument>("media"),
  series: () => db.collection<SeriesDocument>("series"),
  missingMedia: () => db.collection<MissingMediaDocument>("missingMedia"),
  meta: () => db.collection<MetaDocument>("meta"),
  lists: () => db.collection<ListDocument>("lists"),
  appearances: (name: string) => db.collection<AppearanceCollectionDocument>(name),
};

export async function closeDb(): Promise<void> {
  log.info("Closing DB connection");
  await client.close();
}
