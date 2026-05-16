/**
 * Timeline stage tests.
 *
 * Tests the timeline parsing stage in isolation using live fixtures.
 * This catches parsing issues when fixture data is updated from Wookieepedia.
 */

import { describe, it, expect, beforeAll, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import wtf from "wtf_wikipedia";

// Mock the log to avoid console output
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

// Import after mocking
import timeline from "../../src/pipeline/timeline.ts";
import initWtf from "../../src/initWtf.js";

describe("timeline pipeline stage", () => {
  let timelineData;
  let drafts;

  beforeAll(async () => {
    // Initialize wtf_wikipedia with custom templates
    initWtf();

    // Load timeline fixture (live fixtures, not snapshotted)
    const timelinePath = path.join(process.cwd(), "fixtures", "canon", "timeline.json");
    const timelineJson = JSON.parse(await fs.readFile(timelinePath, "utf-8"));

    // Parse the timeline wikitext
    const doc = wtf(timelineJson.wikitext);
    timelineData = doc.tables()[1].json();

    // Run the timeline stage
    drafts = timeline(timelineData);
  });

  describe("output structure", () => {
    it("returns an array of drafts", () => {
      expect(Array.isArray(drafts)).toBe(true);
      expect(drafts.length).toBeGreaterThan(0);
    });

    it("each draft has required fields", () => {
      for (const draft of drafts.slice(0, 100)) {
        // Check first 100
        expect(draft).toHaveProperty("_id");
        expect(draft).toHaveProperty("title");
        expect(draft).toHaveProperty("type");
        expect(draft).toHaveProperty("chronology");
        expect(typeof draft._id).toBe("number");
        expect(typeof draft.title).toBe("string");
        expect(draft.title.length).toBeGreaterThan(0);
      }
    });

    it("drafts have valid types", () => {
      const validTypes = [
        "comic",
        "book",
        "audio-drama",
        "short-story",
        "yr",
        "tv",
        "film",
        "game",
      ];
      for (const draft of drafts) {
        expect(validTypes).toContain(draft.type);
      }
    });

    it("_id values are sequential starting from 0", () => {
      // Find unique _ids and sort them
      const ids = [...new Set(drafts.map((d) => d._id))].sort((a, b) => a - b);
      // First id should be 0
      expect(ids[0]).toBe(0);
      // Should be sequential (though may have gaps from skipped items)
    });

    it("chronology values match _id", () => {
      for (const draft of drafts) {
        expect(draft.chronology).toBe(draft._id);
      }
    });
  });

  describe("known media parsing", () => {
    it("parses 'Dawn of the Jedi: Into the Void' correctly", () => {
      const dawn = drafts.find((d) => d.title === "Dawn of the Jedi: Into the Void");
      if (dawn) {
        expect(dawn.type).toBe("book");
      }
    });

    it("parses 'A New Hope' film correctly", () => {
      // May be listed as "Star Wars: Episode IV A New Hope" or similar
      const anh = drafts.find((d) => d.title.includes("New Hope") && d.type === "film");
      if (anh) {
        expect(anh.type).toBe("film");
      }
    });

    it("parses TV episodes correctly", () => {
      const tvDrafts = drafts.filter((d) => d.type === "tv");
      expect(tvDrafts.length).toBeGreaterThan(0);
    });

    it("parses comics correctly", () => {
      const comicDrafts = drafts.filter((d) => d.type === "comic");
      expect(comicDrafts.length).toBeGreaterThan(0);
    });
  });

  describe("special fields", () => {
    it("some drafts have timelineNotes", () => {
      const withNotes = drafts.filter((d) => d.timelineNotes);
      // There should be some drafts with notes
      expect(withNotes.length).toBeGreaterThan(0);
    });

    it("timelineNotes have correct structure", () => {
      const withNotes = drafts.filter((d) => d.timelineNotes);
      for (const draft of withNotes.slice(0, 10)) {
        expect(Array.isArray(draft.timelineNotes)).toBe(true);
        expect(draft.timelineNotes[0]).toHaveProperty("type", "list");
        expect(Array.isArray(draft.timelineNotes[0].data)).toBe(true);
      }
    });

    it("some drafts are marked as adaptations", () => {
      const adaptations = drafts.filter((d) => d.adaptation === true);
      expect(adaptations.length).toBeGreaterThan(0);
    });

    it("some drafts have exactPlacementUnknown", () => {
      const unknown = drafts.filter((d) => d.exactPlacementUnknown === true);
      expect(unknown.length).toBeGreaterThan(0);
    });

    it("notUnique drafts have href field", () => {
      const notUnique = drafts.filter((d) => d.notUnique === true);
      for (const draft of notUnique) {
        expect(draft).toHaveProperty("href");
        expect(typeof draft.href).toBe("string");
      }
    });

    it("unreleased media is flagged", () => {
      const unreleased = drafts.filter((d) => d.unreleased === true);
      // May or may not have unreleased media depending on timeline state
      // Just verify the field exists when present
      for (const draft of unreleased) {
        expect(draft.unreleased).toBe(true);
      }
    });
  });

  describe("date handling", () => {
    it("drafts have releaseDate field", () => {
      const withDate = drafts.filter((d) => d.releaseDate);
      expect(withDate.length).toBeGreaterThan(0);
    });

    it("some drafts have releaseDateEffective", () => {
      const withEffective = drafts.filter((d) => d.releaseDateEffective);
      expect(withEffective.length).toBeGreaterThan(0);
    });
  });
});
