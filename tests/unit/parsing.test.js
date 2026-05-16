import { describe, it, expect, vi } from "vitest";
import { reduceAstToText } from "../../src/parsing.js";

// Mock dependencies to isolate the pure function
vi.mock("../../src/util.ts", () => ({
  log: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
  toCamelCase: (str) =>
    str
      .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
        index === 0 ? word.toLowerCase() : word.toUpperCase(),
      )
      .replace(/\s+/g, ""),
}));

vi.mock("../../src/fetchWookiee.ts", () => ({
  fetchWookiee: vi.fn(),
}));

describe("reduceAstToText", () => {
  describe("text nodes", () => {
    it("extracts text from a text node", () => {
      const result = [{ type: "text", text: "Hello World" }].reduce(reduceAstToText, "");
      expect(result).toBe("Hello World");
    });

    it("concatenates multiple text nodes", () => {
      const result = [
        { type: "text", text: "Hello " },
        { type: "text", text: "World" },
      ].reduce(reduceAstToText, "");
      expect(result).toBe("Hello World");
    });
  });

  describe("note nodes", () => {
    it("extracts text from a note node", () => {
      const result = [{ type: "note", text: "A footnote" }].reduce(reduceAstToText, "");
      expect(result).toBe("A footnote");
    });
  });

  describe("internal link nodes", () => {
    it("uses link text if available", () => {
      const result = [{ type: "internal link", text: "Display Text", page: "Target Page" }].reduce(
        reduceAstToText,
        "",
      );
      expect(result).toBe("Display Text");
    });

    it("falls back to page name if no text", () => {
      const result = [{ type: "internal link", page: "Target Page" }].reduce(reduceAstToText, "");
      expect(result).toBe("Target Page");
    });
  });

  describe("interwiki link nodes", () => {
    it("uses link text if available", () => {
      const result = [
        {
          type: "interwiki link",
          text: "Wikipedia Article",
          page: "Some_Page",
        },
      ].reduce(reduceAstToText, "");
      expect(result).toBe("Wikipedia Article");
    });

    it("falls back to page name if no text", () => {
      const result = [{ type: "interwiki link", page: "Some_Page" }].reduce(reduceAstToText, "");
      expect(result).toBe("Some_Page");
    });
  });

  describe("external link nodes", () => {
    it("uses link text if available", () => {
      const result = [
        {
          type: "external link",
          text: "Click Here",
          site: "https://example.com",
        },
      ].reduce(reduceAstToText, "");
      expect(result).toBe("Click Here");
    });

    it("falls back to site URL if no text", () => {
      const result = [{ type: "external link", site: "https://example.com" }].reduce(
        reduceAstToText,
        "",
      );
      expect(result).toBe("https://example.com");
    });
  });

  describe("list nodes", () => {
    it("flattens and extracts text from lists", () => {
      const result = [
        {
          type: "list",
          data: [[{ type: "text", text: "Item 1" }], [{ type: "text", text: "Item 2" }]],
        },
      ].reduce(reduceAstToText, "");
      expect(result).toBe("Item 1Item 2");
    });

    it("handles nested structures in lists", () => {
      const result = [
        {
          type: "list",
          data: [
            [
              { type: "text", text: "Text with " },
              { type: "internal link", text: "a link", page: "Link Page" },
            ],
          ],
        },
      ].reduce(reduceAstToText, "");
      expect(result).toBe("Text with a link");
    });
  });

  describe("mixed content", () => {
    it("handles a mix of node types", () => {
      const result = [
        { type: "text", text: "Check out " },
        { type: "internal link", text: "this page", page: "Page" },
        { type: "text", text: " for more info" },
      ].reduce(reduceAstToText, "");
      expect(result).toBe("Check out this page for more info");
    });
  });

  describe("unknown node types", () => {
    it("ignores unknown node types", () => {
      const result = [
        { type: "text", text: "Hello" },
        { type: "unknown", data: "ignored" },
        { type: "text", text: " World" },
      ].reduce(reduceAstToText, "");
      expect(result).toBe("Hello World");
    });
  });

  describe("edge cases", () => {
    it("handles empty array", () => {
      const result = [].reduce(reduceAstToText, "");
      expect(result).toBe("");
    });

    it("handles undefined text gracefully", () => {
      const result = [{ type: "text", text: undefined }].reduce(reduceAstToText, "");
      expect(result).toBe("undefined");
    });
  });
});
