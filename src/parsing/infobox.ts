import { decode } from "html-entities";

import { NUMBERS, infoboxFields, suppressLog } from "../const.ts";
import { seasonReg, seasonRegWordBound } from "../regex.ts";
import { log, toCamelCase } from "../util.ts";

import type { AstNode, TextNode } from "../types/ast.ts";
import type { InfoboxField } from "../const.ts";
import type { MediaDraft, SeriesDraft } from "../types/draft.ts";
import type { InfoboxData } from "../types/parsing.ts";
import type { WtfInfobox, WtfInfoboxValue, WtfLink } from "../types/wtf.ts";

type MutableDraft = (MediaDraft | SeriesDraft) & Record<string, unknown>;
type RawAstNode = Record<string, unknown> & { type?: unknown; text?: unknown; raw?: unknown };

export type InfoboxFieldMapping = InfoboxField;

function flattenAst(nodes: AstNode[]): AstNode[] {
  return nodes.flatMap((node) => (node.type === "list" ? flattenAst(node.data.flat()) : [node]));
}

export function reduceAstToText(acc: string, item: AstNode): string {
  switch (item.type) {
    case "text":
    case "note":
      acc += item.text;
      break;
    case "list":
      acc += flattenAst(item.data.flat()).reduce(reduceAstToText, "");
      break;
    case "internal link":
    case "interwiki link":
      acc += item.text ?? item.page;
      break;
    case "external link":
      acc += item.text ?? item.site;
      break;
  }
  return acc;
}

function getPageWithAnchor(link: WtfLink): string {
  const anchor = link.anchor();
  return link.page() + (anchor ? "#" + anchor : "");
}

function isRawAstNode(value: unknown): value is RawAstNode {
  return typeof value === "object" && value !== null;
}

function decodeRawAstNode(originalAstNode: RawAstNode): RawAstNode {
  return Object.fromEntries(
    Object.entries(originalAstNode).map(([key, value]) => [
      key,
      typeof value === "string" ? decode(value) : value,
    ]),
  );
}

function requireTextNode(astNode: RawAstNode): TextNode & Record<string, unknown> {
  if (astNode.type !== "text" || typeof astNode.text !== "string") {
    throw new Error(`Expected wtf_wikipedia text AST node, got ${JSON.stringify(astNode)}`);
  }
  return { ...astNode, type: "text", text: astNode.text };
}

function requireAstNode(astNode: RawAstNode): AstNode {
  const rawText = astNode.text;
  switch (astNode.type) {
    case "text":
    case "note":
      if (typeof astNode.text !== "string") break;
      return { ...astNode, type: astNode.type, text: astNode.text };
    case "internal link":
    case "interwiki link":
      if (typeof astNode.page !== "string") break;
      if (astNode.type === "internal link")
        return {
          page: astNode.page,
          ...(typeof astNode.anchor === "string" ? { anchor: astNode.anchor } : {}),
          ...(typeof rawText === "string" ? { text: rawText } : {}),
          type: "internal link",
        };
      if (typeof rawText === "string")
        return {
          page: astNode.page,
          ...(typeof astNode.anchor === "string" ? { anchor: astNode.anchor } : {}),
          ...(typeof astNode.wiki === "string" ? { wiki: astNode.wiki } : {}),
          ...(typeof astNode.href === "string" ? { href: astNode.href } : {}),
          type: "interwiki link",
          text: rawText,
        };
      return {
        page: astNode.page,
        ...(typeof astNode.anchor === "string" ? { anchor: astNode.anchor } : {}),
        ...(typeof astNode.wiki === "string" ? { wiki: astNode.wiki } : {}),
        ...(typeof astNode.href === "string" ? { href: astNode.href } : {}),
        type: "interwiki link",
      };
    case "external link":
      if (typeof astNode.site !== "string") break;
      if (typeof rawText === "string")
        return {
          site: astNode.site,
          text: rawText,
          type: "external link",
        };
      return {
        site: astNode.site,
        type: "external link",
      };
  }
  throw new Error(`Unexpected wtf_wikipedia AST node shape: ${JSON.stringify(astNode)}`);
}

export function fillDraftWithInfoboxData(draft: MutableDraft, infobox: WtfInfobox): void {
  for (const [key, value] of Object.entries(getInfoboxData(infobox, infoboxFields))) {
    draft[key] = processAst(value);
  }

  draft.coverWook = infobox
    .get("image")
    .wikitext()
    .replaceAll(/(\[\[|File:|\]\]|\|.*)/g, "");

  if (draft.releaseDate && !draft.releaseDateDetails) {
    const rd = new Date(String(draft.releaseDate));
    if (isNaN(Number(rd))) {
      draft.releaseDateDetails = [{ type: "text", text: String(draft.releaseDate) }];
    } else {
      draft.releaseDateDetails = rd.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
  }
  if (draft.date && !draft.dateDetails) {
    draft.dateDetails = [{ type: "text", text: String(draft.date) }];
  }

  if (draft.isbn === "none") delete draft.isbn;

  draft.publisher =
    infobox
      .get("publisher")
      .links()
      .map((e) => decode(e.page())) || null;
  draft.series =
    infobox
      .get("series")
      .links()
      .map((e) => decode(getPageWithAnchor(e))) || null;

  const seasonText = infobox.get("season").text();
  if (seasonText) {
    const seasonTextClean = seasonText.toLowerCase().trim();
    draft.season =
      (NUMBERS as Record<string, number>)[seasonTextClean.match(seasonReg)?.[1] ?? ""] ??
      seasonTextClean.match(/^(?:season )?(\d+)$/)?.[1];
    if (draft.season === undefined) {
      draft.season =
        (NUMBERS as Record<string, number>)[seasonTextClean.match(seasonRegWordBound)?.[1] ?? ""] ??
        seasonTextClean.match(/(?:season )?\b(\d+)\b/)?.[1];
      if (draft.season && /shorts/i.test(seasonTextClean)) draft.seasonNote = "shorts";

      if (draft.season === undefined && !suppressLog.noSeason.includes(draft.title)) {
        log.warn(`Couldn't get season of "${draft.title}". Season text: ${seasonText}`);
      }
    }
    if (!isNaN(parseInt(String(draft.season), 10)) && !isNaN(+String(draft.season))) {
      draft.season = +String(draft.season);
    }
  }

  let episodeText = draft.episodeDetails;
  if (episodeText) {
    if (Array.isArray(episodeText)) {
      episodeText = episodeText.reduce(reduceAstToText, "");
    }
    if (!/^\d+([–-]\d+)?$/.test(String(episodeText))) {
      log.error(
        `Episode '${String(episodeText)}' does not have a valid format! Title: ${draft.title}`,
      );
    }

    draft.episode = episodeText;
  }

  draft.se = "";
  if (draft.season) draft.se += "S" + String(draft.season);
  if (draft.seasonNote) draft.se += "-" + draft.seasonNote;
  if (draft.season && draft.episode) draft.se += " ";
  if (draft.episode) draft.se += "E" + String(draft.episode);
}

// Takes a text node, returns an array of text and note nodes. Also removes italics/bold.
function processNotes(textNode: TextNode): AstNode[] {
  textNode.text = textNode.text.replace(/'{2,}/g, "");
  const nodes: AstNode[] = [];
  const matches = textNode.text.split(/\{\{C\|(.*?)\}\}/);
  for (const [i, match] of matches.entries()) {
    if (match) {
      if (i % 2) nodes.push({ ...textNode, type: "note", text: match });
      else nodes.push({ ...textNode, text: match });
    }
  }
  return nodes;
}

function processAst(sentence: WtfInfoboxValue): string | AstNode[] | null | WtfInfoboxValue {
  if (!sentence) return sentence;

  const newAst: AstNode[] = [];
  let list: AstNode[][] = [];
  let listItem: AstNode[] = [];
  let current = newAst;
  const ast = sentence.ast();
  if (ast.length === 0) return null;
  for (const [i, originalAstNode] of ast.entries()) {
    if (!isRawAstNode(originalAstNode)) {
      throw new Error(
        `Expected wtf_wikipedia AST node object, got ${JSON.stringify(originalAstNode)}`,
      );
    }
    const astNode = decodeRawAstNode(originalAstNode);
    if (astNode.type !== "text") {
      delete astNode.raw;
      current.push(requireAstNode(astNode));
      continue;
    }
    const textNode = requireTextNode(astNode);

    if (i === 0 && textNode.text.startsWith("*")) {
      listItem = [];
      list = [listItem];
      current = listItem;
      newAst.push({ type: "list", data: list });
      textNode.text = textNode.text.replace(/^\*+/, "");
    }

    const lines = textNode.text.split(/\n/);
    if (lines.length === 1) {
      current.push(...processNotes(textNode));
      continue;
    }
    let preceding: TextNode | undefined;
    for (const line of lines) {
      if (preceding) {
        current.push(...processNotes(preceding));

        if (line.startsWith("*")) {
          if (current === listItem) {
            listItem = [];
            current = listItem;
            list.push(listItem);
          } else {
            listItem = [];
            current = listItem;
            list = [listItem];
            newAst.push({ type: "list", data: list });
          }
        } else if (current === listItem) {
          current = newAst;
        }
      }
      preceding = { ...textNode, text: line.replace(/^\*+ */, "") };
    }
    if (preceding) current.push(...processNotes(preceding));
  }

  return newAst.length === 1 && newAst[0]?.type === "text" ? newAst[0].text : newAst;
}

function getInfoboxData(infobox: WtfInfobox, keys: readonly InfoboxField[]): InfoboxData {
  const ret: InfoboxData = {};
  for (let key of keys) {
    if (typeof key === "string") key = { aliases: [key] };
    let value: WtfInfoboxValue | undefined;

    for (const alias of key.aliases) {
      value = infobox.get(alias);
      if (value.text() !== "") break;
    }
    let dbKey = toCamelCase(key.name || key.aliases[0] || "");
    if (key.details) dbKey += "Details";
    if (value) ret[dbKey] = value;
  }
  return ret;
}
