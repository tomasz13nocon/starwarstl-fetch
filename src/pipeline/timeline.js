import { decode } from "html-entities";
import { log, unscuffDate } from "../util.js";
import { types } from "../const.js";

export default function (table) {
  log.info("Processing timeline...");

  let drafts = {};
  let nopageDrafts = [];
  for (let [i, item] of table.entries()) {
    // TODO: validation to check wheter we're getting the right table
    let draft = {
      title: decode(item.Title.links?.[0].page),
      type: types[item.col2.text],
      releaseDate: item.Released?.text,
      writer: item["Writer(s)"].links?.map((e) => decode(e.page)) || null,
      date: decode(item.Year.text) || null,
      chronology: i,
    };

    if (item.col2.text === "JR") draft.fullType = "book-jr";
    if (draft.type === undefined) {
      if (item.col2.text !== "P")
        log.warn("Timeline parsing warning: Unknown type, skipping. type: " + item.col2.text);
      continue;
    }
    let notes = item.Title.text.split("*");
    if (notes.length > 1) {
      draft.timelineNotes = [
        {
          type: "list",
          data: notes.slice(1).map((s) => [{ type: "text", text: s.trim() }]),
        },
      ]; // TODO:parser get links and such, not just text
      for (let s of draft.timelineNotes[0].data) {
        let note = s[0].text.toLowerCase();
        if (note.includes("adaptation") || note.includes("novelization")) draft.adaptation = true;
      }
    }
    if (item.Title.text.includes("†")) draft.exactPlacementUnknown = true;

    draft.altTitle = decode(item.Title.text)
      .split("*")[0]
      .replace("†", "")
      .trim()
      .replace(/^"(.*)"$/, "$1");

    let unscuffedDate = unscuffDate(draft.releaseDate);
    if (unscuffedDate === draft.releaseDate) {
      draft.releaseDateEffective = unscuffedDate;
    }
    let d = new Date(draft.releaseDate);
    if (isNaN(d) || d > Date.now()) {
      draft.unreleased = true;
    }
    if (draft.releaseDate && isNaN(new Date(unscuffedDate))) {
      log.error(`Release date format invalid for ${draft.title} Date: ${draft.releaseDate}`);
    }

    // This usually happens for some yet to be release media like tv episodes
    if (!draft.title) {
      log.warn(
        'Timeline parsing warning: Title is empty! setting nopage to true. Title cell:\n"' +
          item.Title.text +
          '"'
      );
      draft.title = item.Title.text
        .replace("†", "")
        .trim()
        .replace(/^"(.*)"$/, "$1");
      draft.nopage = true;
      nopageDrafts.push(draft);
      continue;
    }

    drafts[draft.title] = draft;
  }

  return { drafts, nopageDrafts };
}
