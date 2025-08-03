import wtf from "wtf_wikipedia";
import { fetchWookiee } from "./fetchWookiee.js";
import { log, toCamelCase } from "./util.js";
import netLog from "./netLog.js";
import { NUMBERS, infoboxFields, suppressLog } from "./const.js";
import { decode } from "html-entities";
import { reg, seasonReg, seasonRegWordBound } from "./regex.js";
import _ from "lodash";

const tvTypes = {};

export function reduceAstToText(acc, item) {
  switch (item.type) {
    case "text":
    case "note":
      acc += item.text;
      break;
    case "list":
      acc += _.flatten(item.data).reduce(reduceAstToText, "");
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

// Fetches an article with a given title and returns a wtf doc
// if article doesn't exist returns null
export async function docFromTitle(title, cache) {
  let page = (await fetchWookiee(title, cache).next()).value;
  if (page.missing) return null;
  let doc = wtf(page.wikitext);
  doc.pageID(page.pageid);
  return doc;
}

// Returns wtf doc from a fetchWookiee page, handling normalizations.
export async function docFromPage(page, draft) {
  if (page.normalizedFrom?.includes("#")) {
    page.title += page.normalizedFrom.slice(page.normalizedFrom.indexOf("#")).replace("_", " ");
  }

  if (page.missing) {
    return null;
  }

  // This will happen if the normalization is not exact
  if (draft === undefined) {
    throw new Error(
      `Mismatch between timeline title and the title received from the server for: "${page.title}"`,
    );
  }

  // Use the normalized title
  if (draft.href) draft.href = page.title;
  else draft.title = page.title;

  // We might need these in the future
  // In case of a redirect, the fields below describe the redirect page
  // draft.wookieepediaId = page.pageid;
  // draft.revisionTimestamp = page.timestamp;

  // Log articles which have a link in a note template
  // if (page.wikitext.includes("{{C|[[")) log.error(page.title);

  let doc = wtf(page.wikitext);

  while (doc.isRedirect()) {
    log.info(`Article ${draft.title} is a redirect to ${doc.redirectTo().page}. Fetching...`);
    netLog.redirectNum++;
    draft.redirect = true;
    doc = await docFromTitle(doc.redirectTo().page);
    if (doc === null) {
      throw new Error(`Redirected from "${draft.title}" to an invalid wookieepedia article!`);
    }

    // Make sure pageid always points to the final article in redirect chain.
    // When articles get moved, their pageids remain stable,
    // but the redirect page created under the old title has a new pageid which we don't care about.
    draft.pageid = doc.pageID();
  }

  if (doc.isDisambig()) {
    log.error("Disambiguation page! title: " + draft.title);
  }

  return doc;
}

function getPageWithAnchor(link) {
  return link.page() + (link.anchor() ? "#" + link.anchor() : "");
}

export function fillDraftWithInfoboxData(draft, infobox) {
  for (const [key, value] of Object.entries(getInfoboxData(infobox, infoboxFields))) {
    draft[key] = processAst(value);
  }

  draft.coverWook = infobox
    .get("image")
    .wikitext()
    .replaceAll(/(\[\[|File:|\]\]|\|.*)/g, "");

  if (draft.releaseDate && !draft.releaseDateDetails) {
    let rd = new Date(draft.releaseDate);
    if (isNaN(rd)) {
      draft.releaseDateDetails = [{ type: "text", text: draft.releaseDate }];
    } else {
      draft.releaseDateDetails = rd.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
  }
  if (draft.date && !draft.dateDetails) {
    draft.dateDetails = [{ type: "text", text: draft.date }];
  }

  // no comment...
  if (draft.isbn === "none") delete draft.isbn;

  draft.publisher =
    infobox
      .get("publisher")
      .links()
      ?.map((e) => decode(e.page())) || null;
  draft.series =
    infobox
      .get("series")
      .links()
      ?.map((e) => decode(getPageWithAnchor(e))) || null;

  let seasonText = infobox.get("season").text();
  if (seasonText) {
    let seasonTextClean = seasonText.toLowerCase().trim();
    draft.season =
      NUMBERS[seasonTextClean.match(seasonReg)?.[1]] ??
      seasonTextClean.match(/^(?:season )?(\d+)$/)?.[1];
    if (draft.season === undefined) {
      // We use word boundaries as last resort (and log it) in order to avoid false positives.
      // log.warn(`Using word boundary regex to match season of "${draft.title}". Season text: ${seasonText}`);
      draft.season =
        NUMBERS[seasonTextClean.match(seasonRegWordBound)?.[1]] ??
        seasonTextClean.match(/(?:season )?\b(\d+)\b/)?.[1];
      if (draft.season && /shorts/i.test(seasonTextClean)) draft.seasonNote = "shorts";

      if (draft.season === undefined && !suppressLog.noSeason.includes(draft.title)) {
        log.warn(`Couldn't get season of "${draft.title}". Season text: ${seasonText}`);
      }
    }
    if (!isNaN(parseInt(draft.season, 10)) && !isNaN(+draft.season)) draft.season = +draft.season;
  }

  let episodeText = draft.episodeDetails;
  if (episodeText) {
    if (Array.isArray(episodeText)) {
      episodeText = episodeText.reduce(reduceAstToText, "");
    }
    if (!/^\d+([–-]\d+)?$/.test(episodeText)) {
      log.error(`Episode '${episodeText}' does not have a valid format! Title: ${draft.title}`);
    }
    // Unpractical to parse episodes to int due to double episodes written as 1-2
    // draft.episode = +draft.episode;

    draft.episode = episodeText;
  }

  // season episode text like: "S2 E11"
  draft.se = "";
  if (draft.season) draft.se += "S" + draft.season;
  if (draft.seasonNote) draft.se += "-" + draft.seasonNote;
  if (draft.season && draft.episode) draft.se += " ";
  if (draft.episode) draft.se += "E" + draft.episode;
}

// Takes a text node, returns an array of text and note nodes. Also removes italics/bold... (I really need a new parser...)
// If no notes in text, the array contains just the text node.
// If text node has an empty note and nothing else: "(())" returns empty array
function processNotes(textNode) {
  textNode.text = textNode.text.replace(/'{2,}/g, "");
  let nodes = [];
  let matches = textNode.text.split(/\{\{C\|(.*?)\}\}/);
  for (let [i, match] of matches.entries()) {
    if (match) {
      // note
      if (i % 2) {
        nodes.push({ ...textNode, type: "note", text: match });
      }
      // text
      else if (match) {
        nodes.push({ ...textNode, text: match });
      }
    }
  }
  return nodes;
}

function processAst(sentence) {
  if (!sentence) return sentence;

  // What follows is a rather nasty code that reads lists from the sentence's ast.
  // Ideally we would get this from the parser, but doing this in wtf_wikipedia would be even harder and nastier.
  let newAst = [],
    list = [],
    listItem = [],
    current = newAst; // What we're pushing to (the new AST or a list item inside of it)
  if (sentence.ast().length === 0) return null;
  for (let [i, astNode] of sentence.ast().entries()) {
    astNode = _.mapValues(astNode, (e) => (typeof e === "string" ? decode(e) : e));
    // If it's not a text node, just push
    if (astNode.type !== "text") {
      delete astNode.raw;
      current.push(astNode);
      continue;
    }

    // PSEUDO CODE
    /*
    Special case for first line starting with a star
        open list

    Loop through \n occurences
        If followed by *
            add preceding text to current
            If current is list
                add new list item to list
            Else
                open list
        Else // not followed by *
            If current is list
                add preceding text to current
                close list
            Else // current is not list
                concat preceding text with compunding text
    */

    // When a list is at the beginning the star isn't preceded by \n
    if (i === 0 && astNode.text.startsWith("*")) {
      // Start a list
      listItem = [];
      list = [listItem];
      current = listItem;
      newAst.push({ type: "list", data: list });
      astNode.text = astNode.text.replace(/^\*+/, "");
    }

    let lines = astNode.text.split(/\n/);
    // No newlines, just push and go next
    if (lines.length === 1) {
      current.push(...processNotes(astNode));
      continue;
    }
    let preceding;
    for (let line of lines) {
      // Skip the first iteration, since we need to operate on data from 2 consecutive iterations
      if (preceding) {
        current.push(...processNotes(preceding));

        if (line.startsWith("*")) {
          if (current === listItem) {
            // Append new list item
            listItem = [];
            current = listItem;
            list.push(listItem);
          } else {
            // Start a list
            listItem = [];
            current = listItem;
            list = [listItem];
            newAst.push({ type: "list", data: list });
          }
        } else {
          // line doesn't start with a *
          if (current === listItem) {
            // current = astNode;
            current = newAst;
          } // else: two text nodes next to each other
        }
      }
      // remove the leading stars (and spaces)
      preceding = { ...astNode, text: line.replace(/^\*+ */, "") };
    }
    // Add the last line
    current.push(...processNotes(preceding));
  }

  // If there's just one text node return its text.
  return newAst.length === 1 && newAst[0].type === "text" ? newAst[0].text : newAst;
}

// `keys` is an array of (possibly mixed):
// - strings representing infobox key
// - objects where:
// -- aliases: array of strings, where the elements are possible names for the infobox key
//    the first element is used for DB key, unless `name` is specified
// -- details: boolean wheter to add "Details" to the key name
// -- name: string to use as DB key instead of aliases[0]
// returns object mapping camelCased key for DB to infobox value
function getInfoboxData(infobox, keys) {
  let ret = {};
  for (let key of keys) {
    if (typeof key === "string") key = { aliases: [key] };
    let value;

    for (let alias of key.aliases) {
      value = infobox.get(alias);
      if (value.text() !== "") break;
    }
    let dbKey = toCamelCase(key.name || key.aliases[0]);
    if (key.details) dbKey += "Details";
    ret[dbKey] = value;
  }
  return ret;
}

// series - whether the draft is for a series
export async function figureOutFullTypes(draft, doc, series, seriesDrafts = []) {
  // Adaptaions
  // TODO: also other types can be adapatations (especially comics)
  if (draft.type === "book" || draft.type === "yr") {
    let sentence = doc?.sentence(0).text();
    let paragraph = doc?.paragraph(0).text();
    const adaptationReg = /adaptation|novelization|adapting|adapts|retells|retelling/;

    if (sentence && adaptationReg.test(sentence)) {
      draft.adaptation = true;
    } else if (paragraph && adaptationReg.test(paragraph)) {
      if (!suppressLog.notAdaptation.includes(draft.title)) {
        draft.adaptation = true;
        if (!suppressLog.lowConfidenceAdaptation.includes(draft.title)) {
          log.warn(
            `Low confidence guess of adaptation for ${draft.title} from sentence: ${sentence}\nOr paragraph: ${paragraph}`,
          );
        }
      }
    }
  }

  if (draft.type === "book") {
    if (!doc) {
      draft.fullType = "book-a";
    } else if (doc.categories().includes("Canon audio dramas")) {
      draft.type = "audio-drama";
      draft.audiobook = false;
    } else {
      if (!draft.fullType) {
        let audience = await getAudience(doc);
        if (audience) draft.fullType = `book-${audience}`;
      }
    }
  } else if (draft.type === "tv" /* && (draft.series?.length || series)*/) {
    let seriesTitle = !draft.series
      ? draft.title
      : draft.series.find(
          (seriesTitle) => seriesDrafts.find((sd) => sd.title === seriesTitle)?.type === "tv",
        );
    if (tvTypes[seriesTitle]) draft.fullType = tvTypes[seriesTitle];
    else {
      // if (!series) // This should theoretically never happen
      //   throw `NO SERIES TYPE FOR EPISODE!!! Episode ${draft.title} is part of a series, for which we don't have the full type. Series title: ${seriesTitle} (${draft.series})`;
      let seriesDoc = doc;
      if (!seriesDoc) draft.fullType = "tv-live-action";
      // If problematic, change sentence(0) to paragraph(0)
      else if (
        /micro[- ]series/i.test(seriesDoc.sentence(0).text()) ||
        seriesDoc.categories().includes("Canon animated micro series")
      )
        draft.fullType = "tv-micro-series";
      else if (seriesDoc.categories().includes("Canon animated television series"))
        draft.fullType = "tv-animated";
      else if (seriesDoc.categories().includes("Canon live-action television series"))
        draft.fullType = "tv-live-action";
      else if (
        /animated/i.test(seriesDoc.sentence(0).text()) ||
        /\bCG\b|\bCGI\b/.test(seriesDoc.sentence(0).text())
      ) {
        draft.fullType = "tv-animated";
        if (!suppressLog.lowConfidenceAnimated.includes(seriesTitle)) {
          log.warn(
            `Inferring animated type for "${seriesTitle}" from sentence: ${seriesDoc.sentence(0).text()}`,
          );
        }
      } else if (/game[- ]?show/.test(seriesDoc.sentence(0).text())) {
        draft.fullType = "tv-other";
        if (!suppressLog.lowConfidenceTvOther.includes(seriesTitle)) {
          log.warn(
            `Inferring TV-other type for "${seriesTitle}" from sentence: ${seriesDoc.sentence(0).text()}`,
          );
        }
      } else {
        draft.fullType = "tv-live-action";
        log.warn(
          `Unknown TV full type, setting to live action. Title: ${
            draft.title
          } Series: "${seriesTitle}", categories: ${seriesDoc.categories()}`,
        );
      }

      tvTypes[seriesTitle] = draft.fullType;
    }
  } else if (draft.type === "game") {
    if (!doc) draft.fullType = "game";
    else if (doc.categories().includes("Canon mobile games")) draft.fullType = "game-mobile";
    else if (doc.categories().includes("Web-based games")) draft.fullType = "game-browser";
    else if (
      doc.categories().includes("Virtual reality") ||
      doc.categories().includes("Virtual reality attractions") ||
      doc.categories().includes("Virtual reality games") ||
      /virtual[ -]reality/i.test(doc.sentence(0).text())
    )
      draft.fullType = "game-vr";
    else draft.fullType = "game";
  } else if (draft.type === "comic") {
    if (!doc) draft.fullType = "comic";
    else if (
      /manga|japanese webcomic/i.test(doc.sentence(0).text()) ||
      doc.categories().includes("Canon manga")
    )
      draft.fullType = "comic-manga";
    else if (/manga|japanese webcomic/i.test(doc.sentence(1)?.text())) {
      draft.fullType = "comic-manga";
      if (!suppressLog.lowConfidenceManga.includes(draft.title))
        log.warn(
          `Low confidence guess of manga type for ${draft.title} from sentences: ${
            doc.sentence(0).text() + doc.sentence(1).text()
          }`,
        );
    } else if (doc.infobox()._type === "comic strip" || doc.infobox()._type === "comicstrip")
      draft.fullType = "comic-strip";
    else if (doc.infobox()._type === "comic story" || doc.infobox()._type === "comicstory")
      draft.fullType = "comic-story";
    else draft.fullType = "comic";
  }
}

// Returns a promise resolving to a target audience string from wtf doc or null if it can't figure it out
async function getAudience(doc) {
  // We can't rely on books.disney.com even though it's the most official source,
  // because a lot of books are aribitrarily not there
  let categories = doc.categories();
  if (categories.includes("Canon adult novels")) return "a";
  if (categories.includes("Canon young-adult novels")) return "ya";
  if (categories.includes("Canon Young Readers")) return "jr";
  let sentence = doc.sentence(0).text();
  //let mediaType = doc.infobox().get("media type").text();
  let regSentence = reg(sentence, doc.title());
  if (regSentence) return regSentence;
  let seriesTitle;
  try {
    seriesTitle = doc.infobox().get("series").links()[0].json().page;
  } catch (e) {
    if (!suppressLog.noSeriesForAudience.includes(doc.title())) {
      log.warn(
        `Couldn't get a 'series' from infobox when figuring out book's target audience. Defaulting to adult novel.
title: ${doc.title()}
series: ${seriesTitle}
sentence: ${sentence}
error: ${e.name}: ${e.message}`,
      );
    }
    return "a";
  }
  log.info(`Getting series: ${seriesTitle} for ${doc.title()}`);
  let seriesDoc = await docFromTitle(seriesTitle);
  if (seriesDoc === null) throw `${seriesTitle} is not a valid wookieepedia article.`;
  log.info(`title: ${seriesDoc.title()} (fetched: ${seriesTitle})`);
  log.info(`sentence: ${seriesDoc.sentence(0)}, text: ${seriesDoc.sentence(0).text()}`);
  let seriesSentence = seriesDoc.sentence(0).text();
  let regSeries = reg(seriesSentence, doc.title());
  if (!regSeries)
    log.warn(
      `Can't figure out target audience for ${doc.title()} from sentence: ${sentence}\n nor its series' sentence: ${seriesSentence}`,
    );
  return regSeries;
}
