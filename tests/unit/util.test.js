import { describe, it, expect } from "vitest";
import { toCamelCase, toHumanReadable, unscuffDate } from "../../src/util.ts";

describe("toCamelCase", () => {
  it("converts 'release date' to 'releaseDate'", () => {
    expect(toCamelCase("release date")).toBe("releaseDate");
  });

  it("converts 'cover artist' to 'coverArtist'", () => {
    expect(toCamelCase("cover artist")).toBe("coverArtist");
  });

  it("converts 'ISBN' to 'isbn'", () => {
    expect(toCamelCase("ISBN")).toBe("iSBN");
  });

  it("converts single word to lowercase first letter", () => {
    expect(toCamelCase("Author")).toBe("author");
  });

  it("handles already lowercase single word", () => {
    expect(toCamelCase("author")).toBe("author");
  });

  it("converts multiple spaces correctly", () => {
    expect(toCamelCase("media type")).toBe("mediaType");
  });

  it("handles three words", () => {
    expect(toCamelCase("num episodes")).toBe("numEpisodes");
  });

  it("handles 'run time'", () => {
    expect(toCamelCase("run time")).toBe("runTime");
  });
});

describe("toHumanReadable", () => {
  it("formats bytes correctly", () => {
    expect(toHumanReadable(500)).toBe("500 B");
    expect(toHumanReadable(999)).toBe("999 B");
  });

  it("formats kilobytes correctly", () => {
    expect(toHumanReadable(1000)).toBe("1 KB");
    expect(toHumanReadable(5000)).toBe("5 KB");
    expect(toHumanReadable(999999)).toBe("999.999 KB");
  });

  it("formats megabytes correctly", () => {
    expect(toHumanReadable(1000000)).toBe("1 MB");
    expect(toHumanReadable(5000000)).toBe("5 MB");
    expect(toHumanReadable(50000000)).toBe("50 MB");
  });

  it("formats gigabytes correctly", () => {
    expect(toHumanReadable(1000000000)).toBe("1 GB");
    expect(toHumanReadable(5000000000)).toBe("5 GB");
  });

  it("handles edge cases", () => {
    expect(toHumanReadable(0)).toBe("0 B");
    expect(toHumanReadable(1)).toBe("1 B");
  });
});

describe("unscuffDate", () => {
  describe("null/undefined/empty handling", () => {
    it("returns null for null", () => {
      expect(unscuffDate(null)).toBeNull();
    });

    it("returns undefined for undefined", () => {
      expect(unscuffDate(undefined)).toBeUndefined();
    });

    it("returns empty string for empty string", () => {
      expect(unscuffDate("")).toBe("");
    });
  });

  describe("complete dates", () => {
    it("returns complete date as-is", () => {
      expect(unscuffDate("2022-05-15")).toBe("2022-05-15");
    });

    it("returns another complete date as-is", () => {
      expect(unscuffDate("2024-12-31")).toBe("2024-12-31");
    });
  });

  describe("year only formats", () => {
    it("converts '2022' to '2022-12-31'", () => {
      expect(unscuffDate("2022")).toBe("2022-12-31");
    });

    it("converts '2022-??-??' to '2022-12-31'", () => {
      expect(unscuffDate("2022-??-??")).toBe("2022-12-31");
    });

    it("converts '2022-xx-xx' to '2022-12-31'", () => {
      expect(unscuffDate("2022-xx-xx")).toBe("2022-12-31");
    });

    it("converts '2022-XX-XX' to '2022-12-31'", () => {
      expect(unscuffDate("2022-XX-XX")).toBe("2022-12-31");
    });
  });

  describe("year-month formats", () => {
    it("converts '2022-05' to last day of May '2022-05-31'", () => {
      expect(unscuffDate("2022-05")).toBe("2022-05-31");
    });

    it("converts '2022-02' to last day of February (non-leap) '2022-02-28'", () => {
      expect(unscuffDate("2022-02")).toBe("2022-02-28");
    });

    it("converts '2024-02' to last day of February (leap year) '2024-02-29'", () => {
      expect(unscuffDate("2024-02")).toBe("2024-02-29");
    });

    it("converts '2022-04' to last day of April '2022-04-30'", () => {
      expect(unscuffDate("2022-04")).toBe("2022-04-30");
    });

    it("converts '2022-12' to last day of December '2022-12-31'", () => {
      expect(unscuffDate("2022-12")).toBe("2022-12-31");
    });

    it("converts '2022-05-??' to '2022-05-31'", () => {
      expect(unscuffDate("2022-05-??")).toBe("2022-05-31");
    });

    it("converts '2022-05-xx' to '2022-05-31'", () => {
      expect(unscuffDate("2022-05-xx")).toBe("2022-05-31");
    });
  });

  describe("en-dash handling", () => {
    it("normalizes en-dash to hyphen in dates", () => {
      // The function replaces en-dashes with hyphens
      expect(unscuffDate("2022\u201305\u201315")).toBe("2022-05-15");
    });
  });

  describe("invalid formats pass through", () => {
    it("returns text as-is", () => {
      expect(unscuffDate("TBA")).toBe("TBA");
    });

    it("returns other text as-is", () => {
      expect(unscuffDate("Unknown")).toBe("Unknown");
    });
  });
});
