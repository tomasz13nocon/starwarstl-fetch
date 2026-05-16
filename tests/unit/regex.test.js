import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { reg, seasonReg, seasonRegWordBound, seriesRegexes } from "../../src/regex.ts";

// Mock the log to avoid console output during tests
vi.mock("../../src/util.js", () => ({
  log: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("reg (audience detection)", () => {
  describe("junior/young reader detection", () => {
    it("detects 'junior' as 'jr'", () => {
      expect(reg("A junior novel", "Test Title")).toBe("jr");
    });

    it("detects 'middle grade' as 'jr'", () => {
      expect(reg("A middle grade novel", "Test Title")).toBe("jr");
    });

    it("detects 'middle-grade' as 'jr'", () => {
      expect(reg("A middle-grade book", "Test Title")).toBe("jr");
    });

    it("detects 'chapter book' as 'jr'", () => {
      expect(reg("A chapter book for kids", "Test Title")).toBe("jr");
    });

    it("detects 'young reader' as 'jr'", () => {
      expect(reg("A young reader novel", "Test Title")).toBe("jr");
    });

    it("detects 'young-reader' as 'jr'", () => {
      expect(reg("A young-reader book", "Test Title")).toBe("jr");
    });

    it("detects 'young children' as 'jr'", () => {
      expect(reg("A book for young children", "Test Title")).toBe("jr");
    });
  });

  describe("young adult detection", () => {
    it("detects 'young adult' as 'ya'", () => {
      expect(reg("A young adult novel", "Test Title")).toBe("ya");
    });

    it("detects 'young-adult' as 'ya'", () => {
      expect(reg("A young-adult book", "Test Title")).toBe("ya");
    });
  });

  describe("adult novel detection", () => {
    it("detects 'adult' as 'a'", () => {
      expect(reg("An adult novel", "Test Title")).toBe("a");
    });

    it("detects 'canon novel' as 'a'", () => {
      expect(reg("A canon novel", "Test Title")).toBe("a");
    });
  });

  describe("low confidence adult detection", () => {
    it("detects 'novel' alone as 'a' (low confidence)", () => {
      expect(reg("A novel about space", "Test Title")).toBe("a");
    });

    it("detects 'novels' alone as 'a' (low confidence)", () => {
      expect(reg("A series of novels", "Test Title")).toBe("a");
    });
  });

  describe("no match", () => {
    it("returns null for unmatched text", () => {
      expect(reg("A comic book series", "Test Title")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(reg("", "Test Title")).toBeNull();
    });

    it("returns null for random text", () => {
      expect(reg("Some random description", "Test Title")).toBeNull();
    });
  });

  describe("priority (junior beats young adult beats adult)", () => {
    it("prefers junior over young adult", () => {
      // "junior" should match first
      expect(reg("A junior novel for young adult readers", "Test Title")).toBe("jr");
    });

    it("prefers young adult over adult", () => {
      expect(reg("A young adult novel", "Test Title")).toBe("ya");
    });
  });

  describe("case insensitivity", () => {
    it("handles uppercase 'JUNIOR'", () => {
      expect(reg("A JUNIOR NOVEL", "Test Title")).toBe("jr");
    });

    it("handles uppercase 'YOUNG ADULT'", () => {
      expect(reg("A YOUNG ADULT BOOK", "Test Title")).toBe("ya");
    });

    it("handles mixed case", () => {
      expect(reg("A Young-Adult Novel", "Test Title")).toBe("ya");
    });
  });
});

describe("seasonReg", () => {
  describe("matches season numbers (words)", () => {
    it("matches 'one'", () => {
      expect("one".match(seasonReg)?.[1]).toBe("one");
    });

    it("matches 'season one'", () => {
      expect("season one".match(seasonReg)?.[1]).toBe("one");
    });

    it("matches 'two'", () => {
      expect("two".match(seasonReg)?.[1]).toBe("two");
    });

    it("matches 'season three'", () => {
      expect("season three".match(seasonReg)?.[1]).toBe("three");
    });

    it("matches 'twenty'", () => {
      expect("twenty".match(seasonReg)?.[1]).toBe("twenty");
    });
  });

  describe("does not match partial strings", () => {
    it("does not match 'season one extra'", () => {
      expect("season one extra".match(seasonReg)).toBeNull();
    });

    it("does not match 'prefix one'", () => {
      expect("prefix one".match(seasonReg)).toBeNull();
    });
  });
});

describe("seasonRegWordBound", () => {
  describe("matches season numbers in text", () => {
    it("matches 'season one' in longer text", () => {
      expect("this is season one of the show".match(seasonRegWordBound)?.[1]).toBe("one");
    });

    it("matches 'two' with word boundary", () => {
      expect("episodes for two".match(seasonRegWordBound)?.[1]).toBe("two");
    });
  });
});

describe("seriesRegexes", () => {
  describe("multimedia", () => {
    it("matches 'multimedia project'", () => {
      expect(seriesRegexes.multimedia.test("A multimedia project")).toBe(true);
    });
  });

  describe("comic", () => {
    it("matches 'comic series'", () => {
      expect(seriesRegexes.comic.test("A comic series")).toBe(true);
    });

    it("matches 'comic-book series'", () => {
      expect(seriesRegexes.comic.test("A comic-book series")).toBe(true);
    });

    it("matches 'comic book series'", () => {
      expect(seriesRegexes.comic.test("A comic book series")).toBe(true);
    });

    it("matches 'manga series'", () => {
      expect(seriesRegexes.comic.test("A manga series")).toBe(true);
    });

    it("matches 'graphic novel series'", () => {
      expect(seriesRegexes.comic.test("A graphic novel series")).toBe(true);
    });

    it("matches 'series of comics'", () => {
      expect(seriesRegexes.comic.test("A series of comics")).toBe(true);
    });

    it("matches 'series of graphic novels'", () => {
      expect(seriesRegexes.comic.test("A series of graphic novels")).toBe(true);
    });

    it("matches 'comic miniseries'", () => {
      expect(seriesRegexes.comic.test("A comic miniseries")).toBe(true);
    });

    it("matches 'comic mini-series'", () => {
      expect(seriesRegexes.comic.test("A comic mini-series")).toBe(true);
    });
  });

  describe("short-story", () => {
    it("matches 'short story'", () => {
      expect(seriesRegexes["short-story"].test("A short story")).toBe(true);
    });

    it("matches 'short stories'", () => {
      expect(seriesRegexes["short-story"].test("A collection of short stories")).toBe(true);
    });
  });

  describe("game", () => {
    it("matches 'video game'", () => {
      expect(seriesRegexes.game.test("A video game")).toBe(true);
    });
  });
});
