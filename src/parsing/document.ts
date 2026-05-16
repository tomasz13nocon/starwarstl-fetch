import wtf from "wtf_wikipedia";

import { fetchWookiee } from "../fetchWookiee.ts";
import netLog from "../netLog.ts";
import { log } from "../util.ts";

import type { WookieepediaPageResult } from "../types/wookieepedia.ts";
import type { WtfDocument } from "../types/wtf.ts";

type DraftWithArticleTitle = {
  title: string;
  href?: string;
  redirect?: boolean;
  pageid?: number;
};

// Fetches an article with a given title and returns a wtf doc.
// If article doesn't exist returns null.
export async function docFromTitle(title: string, cache?: boolean): Promise<WtfDocument | null> {
  const page = (await fetchWookiee(title, cache).next()).value;
  if (page.missing) return null;
  const doc = wtf(page.wikitext) as WtfDocument;
  doc.pageID(page.pageid);
  return doc;
}

// Returns wtf doc from a fetchWookiee page, handling normalizations.
export async function docFromPage(
  page: WookieepediaPageResult,
  draft: DraftWithArticleTitle | undefined,
): Promise<WtfDocument | null> {
  if ("normalizedFrom" in page && page.normalizedFrom?.includes("#")) {
    page.title += page.normalizedFrom.slice(page.normalizedFrom.indexOf("#")).replace("_", " ");
  }

  if ("missing" in page) {
    return null;
  }

  // This will happen if the normalization is not exact.
  if (draft === undefined) {
    throw new Error(
      `Mismatch between timeline title and the title received from the server for: "${page.title}"`,
    );
  }

  // Use the normalized title.
  if (draft.href) draft.href = page.title;
  else draft.title = page.title;

  let doc = wtf(page.wikitext) as WtfDocument;

  while (doc.isRedirect()) {
    log.info(`Article ${draft.title} is a redirect to ${doc.redirectTo().page}. Fetching...`);
    netLog.redirectNum++;
    draft.redirect = true;
    const redirectDoc = await docFromTitle(doc.redirectTo().page);
    if (redirectDoc === null) {
      throw new Error(`Redirected from "${draft.title}" to an invalid wookieepedia article!`);
    }
    doc = redirectDoc;

    // Make sure pageid always points to the final article in redirect chain.
    draft.pageid = doc.pageID();
  }

  if (doc.isDisambig()) {
    log.error("Disambiguation page! title: " + draft.title);
  }

  return doc;
}
