import rawWtf from "wtf_wikipedia";

import type { WtfDocument, WtfExtension, WtfParser } from "./types/wtf.ts";

function hasMethod(value: object, key: string): boolean {
  return key in value && typeof value[key as keyof typeof value] === "function";
}

function assertWtfDocument(value: unknown): asserts value is WtfDocument {
  if (typeof value !== "object" || value === null) {
    throw new Error("wtf_wikipedia did not return a document object.");
  }
  for (const method of [
    "title",
    "pageID",
    "wikitext",
    "isRedirect",
    "redirectTo",
    "isDisambig",
    "sentence",
    "paragraph",
    "categories",
    "templates",
    "tables",
    "infobox",
  ]) {
    if (!hasMethod(value, method)) {
      throw new Error(`wtf_wikipedia document is missing method ${method}.`);
    }
  }
}

function parse(wikitext: string, options?: object): WtfDocument {
  const doc: unknown = rawWtf(wikitext, options);
  assertWtfDocument(doc);
  return doc;
}

const wtf: WtfParser = Object.assign(parse, {
  extend(extension: WtfExtension): WtfParser {
    rawWtf.extend(extension);
    return wtf;
  },
  plugin(extension: WtfExtension): WtfParser {
    rawWtf.plugin(extension);
    return wtf;
  },
  version: rawWtf.version,
});

export default wtf;
