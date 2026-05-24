import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchWookiee = vi.fn();
const mediaFindToArray = vi.fn();
const missingMediaFindToArray = vi.fn();

vi.mock("../../src/fetchWookiee.ts", () => ({
  fetchWookiee,
}));

vi.mock("../../src/config.ts", () => ({
  default: () => ({
    CACHE_PAGES: false,
    LIMIT: 0,
    LEGENDS: false,
    LOCAL: false,
  }),
  debug: {
    distinctInfoboxes: false,
    redlinks: false,
    normTitles: false,
    normImages: false,
  },
}));

vi.mock("../../src/db.ts", () => ({
  collections: {
    media: () => ({
      find: () => ({ toArray: mediaFindToArray }),
    }),
    missingMedia: () => ({
      find: () => ({ toArray: missingMediaFindToArray }),
    }),
    lists: () => ({
      distinct: vi.fn().mockResolvedValue([]),
    }),
  },
}));

vi.mock("../../src/util.ts", async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    log: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      setStatusBarText: vi.fn(),
    },
  };
});

const pages = {
  "Existing Comic": {
    title: "Existing Comic",
    pageid: 1,
    timestamp: "2026-01-01T00:00:00Z",
    wikitext: `{{ComicBook
|title=''Existing Comic''
|release date=[[January 1]], [[2020]]
|publisher=[[Marvel Comics]]
}}
'''''Existing Comic''''' is a [[canon]] comic book.

[[Category:Canon comics]]`,
  },
  "Missing Comic": {
    title: "Missing Comic",
    missing: true,
  },
};

async function* pageGenerator(titles) {
  for (const title of Array.isArray(titles) ? titles : [titles]) {
    const page = pages[title];
    if (!page) throw new Error(`Unexpected fetch for ${title}`);
    yield page;
  }
}

function mockTimelineRows() {
  return [
    {
      Title: { text: "Title" },
      col2: { text: "" },
      Released: { text: "Released" },
      Year: { text: "Year" },
    },
    {
      Title: { text: "Existing Comic", links: [{ page: "Existing Comic" }] },
      col2: { text: "C" },
      Released: { text: "January 1, 2020" },
      Year: { text: "1 ABY" },
    },
    {
      Title: { text: "Missing Comic", links: [{ page: "Missing Comic" }] },
      col2: { text: "C" },
      Released: { text: "January 2, 2020" },
      Year: { text: "2 ABY" },
    },
  ];
}

describe("redlink media pipeline handling", () => {
  beforeEach(() => {
    fetchWookiee.mockImplementation(pageGenerator);
    mediaFindToArray.mockResolvedValue([]);
    missingMediaFindToArray.mockResolvedValue([{ title: "Missing Comic", pageid: undefined }]);
  });

  it("keeps missing timeline articles as redlink drafts through pipeline cleanup", async () => {
    const { parseTimelineRows } = await import("../../src/pipeline/timeline.ts");
    const { enrichMediaArticles } = await import("../../src/pipeline/media.ts");
    const { default: series } = await import("../../src/pipeline/series.ts");
    const { addMediaFullTypes } = await import("../../src/pipeline/mediaTypes.ts");
    const { default: adjustBookTypes } = await import("../../src/pipeline/adjustBookTypes.ts");
    const { default: validateFullTypes } = await import("../../src/pipeline/validateFullTypes.ts");
    const { default: cleanupDrafts } = await import("../../src/pipeline/cleanupDrafts.ts");
    const { default: validatePageIds } = await import("../../src/pipeline/validatePageIds.ts");

    const drafts = parseTimelineRows(mockTimelineRows());
    const mediaResult = await enrichMediaArticles(drafts);
    const seriesDrafts = await series(drafts, mediaResult.seriesDrafts);
    await addMediaFullTypes(drafts, seriesDrafts);
    adjustBookTypes(drafts, seriesDrafts);
    validateFullTypes(drafts);
    cleanupDrafts(drafts, seriesDrafts);

    const pageIdValidation = await validatePageIds(drafts);

    const existing = drafts.find((draft) => draft.title === "Existing Comic");
    const missing = drafts.find((draft) => draft.title === "Missing Comic");

    expect(existing).toMatchObject({
      title: "Existing Comic",
      type: "comic",
      fullType: "comic",
      pageid: 1,
    });
    expect(existing.redlink).toBeUndefined();
    expect(existing.doc).toBeUndefined();

    expect(missing).toMatchObject({
      title: "Missing Comic",
      type: "comic",
      redlink: true,
      releaseDate: "January 2, 2020",
      date: "2 ABY",
    });
    expect(missing.pageid).toBeUndefined();
    expect(missing.fullType).toBeUndefined();
    expect(missing.doc).toBeUndefined();

    expect(pageIdValidation.missingMediaNoLongerMissing).toEqual([]);
  });
});
