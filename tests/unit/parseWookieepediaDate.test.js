import { describe, it, expect } from "vitest";
import { parseWookieepediaDate, UnsupportedDateFormat } from "../../src/parseWookieepediaDate.js";

describe("parseWookieepediaDate", () => {
  describe("null/undefined/empty handling", () => {
    it("returns undefined for null", () => {
      expect(parseWookieepediaDate(null)).toBeUndefined();
    });

    it("returns undefined for undefined", () => {
      expect(parseWookieepediaDate(undefined)).toBeUndefined();
    });

    it("returns undefined for empty string", () => {
      expect(parseWookieepediaDate("")).toBeUndefined();
    });
  });

  describe("simple BBY dates", () => {
    it("parses '41 BBY'", () => {
      expect(parseWookieepediaDate("41 BBY")).toEqual([{ date1: -41 }]);
    });

    it("parses '32 BBY'", () => {
      expect(parseWookieepediaDate("32 BBY")).toEqual([{ date1: -32 }]);
    });

    it("parses '1000 BBY'", () => {
      expect(parseWookieepediaDate("1000 BBY")).toEqual([{ date1: -1000 }]);
    });
  });

  describe("simple ABY dates", () => {
    it("parses '4 ABY'", () => {
      expect(parseWookieepediaDate("4 ABY")).toEqual([{ date1: 4 }]);
    });

    it("parses '34 ABY'", () => {
      expect(parseWookieepediaDate("34 ABY")).toEqual([{ date1: 34 }]);
    });
  });

  describe("date ranges", () => {
    it("parses '32 BBY-4 ABY' (cross-era range)", () => {
      expect(parseWookieepediaDate("32 BBY-4 ABY")).toEqual([{ date1: -32, date2: 4 }]);
    });

    it("parses '4-5 ABY' (same-era range without first era)", () => {
      expect(parseWookieepediaDate("4-5 ABY")).toEqual([{ date1: 4, date2: 5 }]);
    });

    it("parses '15-2 BBY' (same-era range without first era, BBY)", () => {
      expect(parseWookieepediaDate("15-2 BBY")).toEqual([{ date1: -15, date2: -2 }]);
    });

    it("parses ranges with en-dash '32 BBY\u20134 ABY'", () => {
      expect(parseWookieepediaDate("32 BBY\u20134 ABY")).toEqual([{ date1: -32, date2: 4 }]);
    });
  });

  describe("circa dates (c.)", () => {
    it("parses 'c. 40 BBY'", () => {
      expect(parseWookieepediaDate("c. 40 BBY")).toEqual([{ date1: -40 }]);
    });

    it("parses 'c. 21 BBY-34 ABY'", () => {
      expect(parseWookieepediaDate("c. 21 BBY-34 ABY")).toEqual([{ date1: -21, date2: 34 }]);
    });

    it("parses 'c. 15-2 BBY'", () => {
      expect(parseWookieepediaDate("c. 15-2 BBY")).toEqual([{ date1: -15, date2: -2 }]);
    });

    it("parses 'c. 231 BBY-c. 230 BBY' (circa on both ends)", () => {
      expect(parseWookieepediaDate("c. 231 BBY-c. 230 BBY")).toEqual([
        { date1: -231, date2: -230 },
      ]);
    });
  });

  describe("special formats", () => {
    it("parses 'During or prior to 146 BBY'", () => {
      expect(parseWookieepediaDate("During or prior to 146 BBY")).toEqual([{ date1: -146 }]);
    });

    it("parses 'During or after 5 ABY'", () => {
      expect(parseWookieepediaDate("During or after 5 ABY")).toEqual([{ date1: 5 }]);
    });

    it("parses 'Between 44-32 BBY'", () => {
      expect(parseWookieepediaDate("Between 44-32 BBY")).toEqual([{ date1: -44, date2: -32 }]);
    });

    it("parses 'Between 20 BBY and 19 BBY'", () => {
      expect(parseWookieepediaDate("Between 20 BBY and 19 BBY")).toEqual([
        { date1: -20, date2: -19 },
      ]);
    });

    it("parses '9 BBY or 8 BBY'", () => {
      expect(parseWookieepediaDate("9 BBY or 8 BBY")).toEqual([{ date1: -9, date2: -8 }]);
    });

    it("parses '3 BBY & 4 ABY'", () => {
      expect(parseWookieepediaDate("3 BBY & 4 ABY")).toEqual([{ date1: -3, date2: 4 }]);
    });
  });

  describe("comma-separated numbers", () => {
    it("parses '5,000 BBY'", () => {
      expect(parseWookieepediaDate("5,000 BBY")).toEqual([{ date1: -5000 }]);
    });

    it("parses '25,053 BBY'", () => {
      expect(parseWookieepediaDate("25,053 BBY")).toEqual([{ date1: -25053 }]);
    });
  });

  describe("case insensitivity", () => {
    it("parses lowercase 'bby'", () => {
      expect(parseWookieepediaDate("32 bby")).toEqual([{ date1: -32 }]);
    });

    it("parses lowercase 'aby'", () => {
      expect(parseWookieepediaDate("5 aby")).toEqual([{ date1: 5 }]);
    });

    it("parses mixed case 'C. 20 Bby'", () => {
      expect(parseWookieepediaDate("C. 20 Bby")).toEqual([{ date1: -20 }]);
    });
  });

  describe("error handling", () => {
    it("throws UnsupportedDateFormat for unparseable strings", () => {
      expect(() => parseWookieepediaDate("Invalid date")).toThrow(UnsupportedDateFormat);
    });

    it("throws UnsupportedDateFormat for 'N/A'", () => {
      expect(() => parseWookieepediaDate("N/A")).toThrow(UnsupportedDateFormat);
    });

    it("throws UnsupportedDateFormat for just text", () => {
      expect(() => parseWookieepediaDate("Unknown")).toThrow(UnsupportedDateFormat);
    });
  });

  describe("edge cases from real wookieepedia data", () => {
    it("handles extra whitespace", () => {
      expect(parseWookieepediaDate("  32  BBY  ")).toEqual([{ date1: -32 }]);
    });

    it("parses '0 BBY' (year zero)", () => {
      // Note: Returns -0 due to JavaScript's signed zero (0 * -1 = -0)
      // This is acceptable behavior since -0 === 0 in JavaScript
      const result = parseWookieepediaDate("0 BBY");
      expect(result[0].date1 === 0).toBe(true); // -0 === 0 is true
      expect(result).toEqual([{ date1: -0 }]); // But Object.is(-0, 0) is false
    });

    it("parses '0 ABY' (year zero)", () => {
      expect(parseWookieepediaDate("0 ABY")).toEqual([{ date1: 0 }]);
    });
  });
});
