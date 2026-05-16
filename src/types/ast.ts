/** Structured rich-text nodes produced by our wikitext parsing helpers. */
export type TextNode = {
  type: "text";
  text: string;
};

export type NoteNode = {
  type: "note";
  text: string;
};

export type InternalLinkNode = {
  type: "internal link";
  page: string;
  text?: string;
};

export type InterwikiLinkNode = {
  type: "interwiki link";
  page: string;
  text?: string;
};

export type ExternalLinkNode = {
  type: "external link";
  site: string;
  text?: string;
};

export type ListNode = {
  type: "list";
  data: AstNode[][];
};

export type AstNode =
  | TextNode
  | NoteNode
  | InternalLinkNode
  | InterwikiLinkNode
  | ExternalLinkNode
  | ListNode;

/** Infobox fields are usually parsed AST arrays, but simple values may remain strings. */
export type RichText = string | AstNode[];

/** Numeric BBY/ABY date representation; BBY is negative, ABY is positive. */
export type ParsedDate = {
  date1: number;
  date2?: number;
};
