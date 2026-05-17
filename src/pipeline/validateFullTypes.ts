import { log } from "../util.ts";
import type { MediaDraft } from "../types/index.ts";

export default function validateFullTypes(drafts: MediaDraft[]): void {
  let noFullTypes = drafts
    .filter((e) => ["tv", "book", "comic", "game"].includes(e.type) && e.fullType === undefined)
    .map((e) => e.title);

  if (noFullTypes.length)
    log.error(
      `No fullType despite being required (for frontend filters) on the following media:
      ${noFullTypes.join("\n")}`,
    );
}
