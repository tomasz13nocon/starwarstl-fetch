import { decode } from "html-entities";
import { log, unscuffDate } from "../util.js";
import { types } from "../const.js";

function cleanupTitle(str) {
  return decode(str)
    .split("*")[0]
    .replace("†", "")
    .trim()
    .replace(/^"(.*)"$/, "$1");
}

export default function (table) {
  log.info("Processing timeline...");

  let drafts = [];
  let draftMap = {}; // Used to find duplicates

  if (
    table[0].Title === undefined ||
    table[0].col2 === undefined ||
    table[0].Released === undefined ||
    table[0].Year === undefined
  ) {
    throw new Error("Timeline parsing error: Unexpected table layout. Some columns are missing.");
  }

  for (let [i, item] of table.entries()) {
    let draft = {
      _id: i,
      title: decode(item.Title.links?.[0].page),
      type: types[item.col2.text],
      releaseDate: item.Released?.text, // TODO remove optional chaining
      // writer: item["Writer(s)"].links?.map((e) => decode(e.page)) || null,
      date: decode(item.Year.text) || null,
      chronology: i,
      titleText: item.Title.text, // For finding duplicates, removed later
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

      // Check if adaptation
      for (let s of draft.timelineNotes[0].data) {
        let note = s[0].text.toLowerCase();
        if (note.includes("adaptation") || note.includes("novelization")) draft.adaptation = true;
      }
    }
    if (item.Title.text.includes("†")) draft.exactPlacementUnknown = true;

    // Check for duplicate titles - these are usually "chapter" entries, that link to their parent media
    if (draftMap[draft.title]) {
      let first = draftMap[draft.title];
      if (!first.href) {
        first.href = first.title;
        first.title = cleanupTitle(first.titleText);
        first.notUnique = true;
      }
      draft.href = draft.title;
      draft.title = cleanupTitle(draft.titleText);
      draft.notUnique = true;
    }

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
          '"',
      );
      draft.title = cleanupTitle(item.Title.text);
      draft.nopage = true;
    }

    drafts.push(draft);
    draftMap[draft.title] = draft;
  }

  for (let draft of Object.values(drafts)) {
    delete draft.titleText;
  }

  return drafts;
}
