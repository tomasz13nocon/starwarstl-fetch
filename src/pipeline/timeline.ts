import { decode } from "html-entities";
import { log, unscuffDate } from "../util.ts";
import { types } from "../const.ts";
import { PipelineError } from "../errors.ts";
import type { ListNode, MediaDraft, MediaType, TimelineRow } from "../types/index.ts";

function cleanupTitle(str: string): string {
  return (decode(str).split("*")[0] ?? "")
    .replace("†", "")
    .trim()
    .replace(/^"(.*)"$/, "$1");
}

type TimelineDraft = MediaDraft & { titleText?: string };

export default function timeline(table: TimelineRow[]): MediaDraft[] {
  log.info("Processing timeline...");

  let drafts: TimelineDraft[] = [];
  let draftMap: Record<string, TimelineDraft> = {}; // Used to find duplicates

  const firstRow = table[0] as Partial<TimelineRow> | undefined;

  if (
    firstRow?.Title === undefined ||
    firstRow.col2 === undefined ||
    firstRow.Released === undefined ||
    firstRow.Year === undefined
  ) {
    throw new PipelineError("Timeline parsing error: Unexpected table layout. Some columns are missing.");
  }

  for (let [i, item] of table.entries()) {
    const titleLink = item.Title.links?.[0]?.page ?? "";
    const type = (types as Partial<Record<string, MediaType>>)[item.col2.text];
    if (type === undefined) {
      if (item.col2.text !== "P")
        log.warn("Timeline parsing warning: Unknown type, skipping. type: " + item.col2.text);
      continue;
    }

    let draft: TimelineDraft = {
      _id: i,
      title: decode(titleLink),
      type,
      releaseDate: item.Released.text,
      // writer: item["Writer(s)"].links?.map((e) => decode(e.page)) || null,
      date: decode(item.Year.text) || null,
      chronology: i,
      titleText: item.Title.text, // For finding duplicates, removed later
    };

    if (item.col2.text === "JR") draft.fullType = "book-jr";
    let notes = item.Title.text.split("*");
    if (notes.length > 1) {
      const timelineNote: ListNode = {
        type: "list",
        data: notes.slice(1).map((s) => [{ type: "text", text: s.trim() }]),
      };
      draft.timelineNotes = [timelineNote]; // TODO:parser get links and such, not just text

      // Check if adaptation
      for (let s of timelineNote.data) {
        const first = s[0];
        if (first?.type !== "text") continue;
        let note = first.text.toLowerCase();
        if (note.includes("adaptation") || note.includes("novelization")) draft.adaptation = true;
      }
    }
    if (item.Title.text.includes("†")) draft.exactPlacementUnknown = true;

    // Check for duplicate titles - these are usually "chapter" entries, that link to their parent media
    if (draftMap[draft.title]) {
      const first = draftMap[draft.title];
      if (first === undefined) throw new PipelineError(`Duplicate draft missing for ${draft.title}`);
      if (!first.href) {
        first.href = first.title;
        first.title = cleanupTitle(first.titleText ?? first.title);
        first.notUnique = true;
      }
      draft.href = draft.title;
      draft.title = cleanupTitle(draft.titleText ?? draft.title);
      draft.notUnique = true;
    }

    let unscuffedDate = unscuffDate(draft.releaseDate) ?? draft.releaseDate;
    if (unscuffedDate === draft.releaseDate) {
      draft.releaseDateEffective = unscuffedDate;
    }
    let d = new Date(draft.releaseDate);
    if (isNaN(d.getTime()) || d.getTime() > Date.now()) {
      draft.unreleased = true;
    }
    if (draft.releaseDate && isNaN(new Date(unscuffedDate).getTime())) {
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

export function parseTimelineRows(table: TimelineRow[]): MediaDraft[] {
  return timeline(table);
}
