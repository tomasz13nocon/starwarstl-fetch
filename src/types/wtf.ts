import type { AstNode } from "./ast.js";

export type WtfTemplate = {
  data: { template: string };
  json(): { template: string; [key: string]: unknown };
  wikitext(): string;
};

export type WtfLink = {
  page(): string;
  anchor(): string;
  json(): { page: string; text?: string; anchor?: string };
};

export type WtfInfoboxValue = {
  text(): string;
  wikitext(): string;
  links(): WtfLink[];
  ast(): unknown[];
  json?(): unknown;
};

export type WtfInfobox = {
  _type: string;
  get(key: string): WtfInfoboxValue;
};

export type WtfParagraph = {
  text(): string;
};

export type WtfRedirectTarget = {
  page?: string;
};

export type WtfTable = {
  json(): Array<Record<string, unknown>>;
};

/** Minimal document surface currently used by the fetch pipeline. */
export type WtfDocument = {
  title(): string | null;
  pageID(id?: number): number | null;
  wikitext(): string;
  isRedirect(): boolean;
  redirectTo(): WtfRedirectTarget | null;
  isDisambig(): boolean;
  sentence(index: number): WtfParagraph | null;
  paragraph(index: number): WtfParagraph | null;
  categories(): string[];
  templates(): WtfTemplate[];
  tables(): WtfTable[];
  infobox(): WtfInfobox | null;
  json?(): unknown;
};

export type TimelineTableRow = {
  col1?: { text?: string; links?: unknown[] };
  col2?: { text?: string };
  col3?: { text?: string; links?: Array<{ page: string; text?: string }> };
  col4?: { text?: string };
  [key: string]: unknown;
};

export type InfoboxFieldMapper<TDraft> = (
  draft: TDraft,
  infobox: WtfInfobox,
) => void | Promise<void>;

export type ParsedInfoboxField = string | AstNode[];

export type WtfTemplateParseValue = string | string[] | undefined;

export type WtfTemplateParseResult = {
  list?: string[];
  [key: string]: WtfTemplateParseValue;
};

export type WtfTemplateParser = (
  templateWikitext: string,
  positionalKeys?: string[],
) => WtfTemplateParseResult;

export type WtfExtensionModels = {
  parse: WtfTemplateParser;
};

export type WtfTemplateHandler = (
  templateWikitext: string,
  list: WtfTemplateParseResult[],
) => string;

export type WtfTemplateHandlers = Record<string, WtfTemplateHandler>;

export type WtfExtension = (models: WtfExtensionModels, templates: WtfTemplateHandlers) => void;

export type WtfParser = {
  (wikitext: string, options?: object): WtfDocument;
  extend(extension: WtfExtension): WtfParser;
  plugin(extension: WtfExtension): WtfParser;
  version: string;
};
