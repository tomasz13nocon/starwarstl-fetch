import { suppressLog } from "../const.ts";
import { reg } from "../regex.ts";
import { log } from "../util.ts";

import { docFromTitle } from "./document.ts";

import type { MediaDraft, SeriesDraft } from "../types/draft.ts";
import type { FullType } from "../types/media.ts";
import type { WtfDocument } from "../types/wtf.ts";

const tvTypes: Record<string, FullType | undefined> = {};

type MutableDraft = (MediaDraft | SeriesDraft) & {
  adaptation?: boolean;
  audiobook?: boolean;
};

type BookAudience = "a" | "ya" | "jr";

function sentenceText(doc: WtfDocument, index: number): string {
  const sentence = doc.sentence(index);
  if (sentence === null)
    throw new Error(`Expected sentence ${index} in ${doc.title() ?? "untitled document"}`);
  return sentence.text();
}

function optionalDocumentSentenceText(
  doc: WtfDocument | null | undefined,
  index: number,
): string | undefined {
  if (!doc) return undefined;
  return sentenceText(doc, index);
}

function nullableSentenceText(doc: WtfDocument, index: number): string | undefined {
  return doc.sentence(index)?.text();
}

function paragraphText(doc: WtfDocument, index: number): string {
  const paragraph = doc.paragraph(index);
  if (paragraph === null)
    throw new Error(`Expected paragraph ${index} in ${doc.title() ?? "untitled document"}`);
  return paragraph.text();
}

function documentTitle(doc: WtfDocument): string {
  const title = doc.title();
  if (title === null) throw new Error("Expected wtf_wikipedia document title.");
  return title;
}

function optionalDocumentParagraphText(
  doc: WtfDocument | null | undefined,
  index: number,
): string | undefined {
  if (!doc) return undefined;
  return paragraphText(doc, index);
}

// series - whether the draft is for a series
export async function figureOutFullTypes(
  draft: MutableDraft,
  doc: WtfDocument | null | undefined,
  series: boolean,
  seriesDrafts: SeriesDraft[] = [],
): Promise<void> {
  void series;
  if (draft.type === "book" || draft.type === "yr") {
    const sentence = optionalDocumentSentenceText(doc, 0);
    const paragraph = optionalDocumentParagraphText(doc, 0);
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
    } else if (!draft.fullType) {
      const audience = await getAudience(doc);
      if (audience) draft.fullType = `book-${audience}`;
    }
  } else if (draft.type === "tv") {
    const seriesTitle = !draft.series
      ? draft.title
      : draft.series.find(
          (seriesTitle) => seriesDrafts.find((sd) => sd.title === seriesTitle)?.type === "tv",
        );
    if (seriesTitle && tvTypes[seriesTitle]) draft.fullType = tvTypes[seriesTitle];
    else {
      const seriesDoc = doc;
      if (!seriesDoc) draft.fullType = "tv-live-action";
      else if (
        /micro[- ]series/i.test(sentenceText(seriesDoc, 0)) ||
        seriesDoc.categories().includes("Canon animated micro series")
      )
        draft.fullType = "tv-micro-series";
      else if (seriesDoc.categories().includes("Canon animated television series"))
        draft.fullType = "tv-animated";
      else if (seriesDoc.categories().includes("Canon live-action television series"))
        draft.fullType = "tv-live-action";
      else if (
        /animated/i.test(sentenceText(seriesDoc, 0)) ||
        /\bCG\b|\bCGI\b/.test(sentenceText(seriesDoc, 0))
      ) {
        draft.fullType = "tv-animated";
        if (!suppressLog.lowConfidenceAnimated.includes(seriesTitle ?? "")) {
          log.warn(
            `Inferring animated type for "${seriesTitle}" from sentence: ${sentenceText(seriesDoc, 0)}`,
          );
        }
      } else if (/game[- ]?show/.test(sentenceText(seriesDoc, 0))) {
        draft.fullType = "tv-other";
        if (!suppressLog.lowConfidenceTvOther.includes(seriesTitle ?? "")) {
          log.warn(
            `Inferring TV-other type for "${seriesTitle}" from sentence: ${sentenceText(seriesDoc, 0)}`,
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

      if (seriesTitle) tvTypes[seriesTitle] = draft.fullType;
    }
  } else if (draft.type === "game") {
    if (!doc) draft.fullType = "game";
    else if (doc.categories().includes("Canon mobile games")) draft.fullType = "game-mobile";
    else if (doc.categories().includes("Web-based games")) draft.fullType = "game-browser";
    else if (
      doc.categories().includes("Virtual reality") ||
      doc.categories().includes("Virtual reality attractions") ||
      doc.categories().includes("Virtual reality games") ||
      /virtual[ -]reality/i.test(sentenceText(doc, 0))
    )
      draft.fullType = "game-vr";
    else draft.fullType = "game";
  } else if (draft.type === "comic") {
    if (!doc) draft.fullType = "comic";
    else if (
      /manga|japanese webcomic/i.test(sentenceText(doc, 0)) ||
      doc.categories().includes("Canon manga")
    )
      draft.fullType = "comic-manga";
    else if (/manga|japanese webcomic/i.test(nullableSentenceText(doc, 1) ?? "")) {
      draft.fullType = "comic-manga";
      if (!suppressLog.lowConfidenceManga.includes(draft.title))
        log.warn(
          `Low confidence guess of manga type for ${draft.title} from sentences: ${
            sentenceText(doc, 0) + sentenceText(doc, 1)
          }`,
        );
    } else if (doc.infobox()?._type === "comic strip" || doc.infobox()?._type === "comicstrip")
      draft.fullType = "comic-strip";
    else if (doc.infobox()?._type === "comic story" || doc.infobox()?._type === "comicstory")
      draft.fullType = "comic-story";
    else draft.fullType = "comic";
  }
}

async function getAudience(doc: WtfDocument): Promise<BookAudience | null> {
  const categories = doc.categories();
  if (categories.includes("Canon adult novels")) return "a";
  if (categories.includes("Canon young-adult novels")) return "ya";
  if (categories.includes("Canon Young Readers")) return "jr";
  const sentence = sentenceText(doc, 0);
  const regSentence = reg(sentence, documentTitle(doc));
  if (regSentence) return regSentence;
  let seriesTitle: string | undefined;
  try {
    seriesTitle = doc.infobox()?.get("series").links()[0]?.json().page;
  } catch (e) {
    const error = e as Error;
    if (!suppressLog.noSeriesForAudience.includes(doc.title() ?? "")) {
      log.warn(
        `Couldn't get a 'series' from infobox when figuring out book's target audience. Defaulting to adult novel.
title: ${doc.title()}
series: ${seriesTitle}
sentence: ${sentence}
error: ${error.name}: ${error.message}`,
      );
    }
    return "a";
  }
  if (!seriesTitle) return "a";
  log.info(`Getting series: ${seriesTitle} for ${doc.title()}`);
  const seriesDoc = await docFromTitle(seriesTitle);
  if (seriesDoc === null) throw new Error(`${seriesTitle} is not a valid wookieepedia article.`);
  log.info(`title: ${seriesDoc.title()} (fetched: ${seriesTitle})`);
  const seriesSentence = sentenceText(seriesDoc, 0);
  log.info(`sentence: ${seriesSentence}`);
  const regSeries = reg(seriesSentence, documentTitle(doc));
  if (!regSeries)
    log.warn(
      `Can't figure out target audience for ${doc.title()} from sentence: ${sentence}\n nor its series' sentence: ${seriesSentence}`,
    );
  return regSeries;
}
