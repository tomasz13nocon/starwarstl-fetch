import { describe, expect, it } from "vitest";
import { parseCliArgs } from "../../src/config.ts";

describe("parseCliArgs", () => {
  it("parses supported flags", () => {
    expect(parseCliArgs(["node", "src/index.ts", "--cache", "--limit", "3", "--fs", "--legends", "--local"])).toMatchObject({
      cache: true,
      limit: 3,
      fs: true,
      legends: true,
      local: true,
    });
  });

  it("supports short aliases", () => {
    expect(parseCliArgs(["node", "src/index.ts", "-c", "-l", "2", "--offline"])).toMatchObject({
      cache: true,
      limit: 2,
      offline: true,
    });
  });

  it("rejects invalid limits", () => {
    expect(() => parseCliArgs(["node", "src/index.ts", "--limit", "0"])).toThrow(/positive integer/);
  });
});
