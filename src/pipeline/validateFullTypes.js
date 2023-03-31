import { log } from "../util.js";

export default function (drafts) {
  let noFullTypes = Object.values(drafts)
    .filter((e) => ["tv", "book", "comic", "game"].includes(e.type) && e.fullType === undefined)
    .map((e) => e.title);

  if (noFullTypes.length)
    log.error(
      `No fullType despite being required (for frontend filters) on the following media:
      ${noFullTypes.join("\n")}`
    );
}
