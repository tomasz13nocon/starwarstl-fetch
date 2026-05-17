import type { AstNode } from "./ast.js";

export type WtfTemplate = {
  data: { template: string };
  json(): { template: string; [key: string]: unknown };
  wikitext(): string;
};

export type WtfLink = {
  page(): string;
  anchor(): string | undefined;
  json(): { page: string; text?: string; anchor?: string };
};

export type WtfInfoboxValue = {
  text(): string;
  wikitext(): string;
  links(): WtfLink[];
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
  page: string;
};

export type WtfTable = {
  json(): Array<Record<string, unknown>>;
};

/** Minimal document surface currently used by the fetch pipeline. */
export type WtfDocument = {
  title(): string;
  pageID(id: number): void;
  pageID(): number;
  wikitext(): string;
  isRedirect(): boolean;
  redirectTo(): WtfRedirectTarget;
  isDisambig(): boolean;
  sentence(index: number): WtfParagraph;
  paragraph(index: number): WtfParagraph;
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
