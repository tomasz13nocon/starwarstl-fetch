import wtf from "wtf_wikipedia";

import { fetchWookiee } from "../fetchWookiee.ts";
import netLog from "../netLog.ts";
import { log } from "../util.ts";

import { isPageMissing } from "../types/wookieepedia.ts";
import type { WookieepediaPage, WookieepediaPageResult } from "../types/wookieepedia.ts";
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
  const result = await fetchWookiee(title, cache).next();
  if (result.done) throw new Error(`No page returned for ${title}`);
  const page = result.value;
  if (isPageMissing(page)) return null;
  const doc = wtf(page.wikitext);
  doc.pageID(page.pageid);
  return doc;
}

function redirectPage(doc: WtfDocument, fromTitle: string): string {
  const redirectTo = doc.redirectTo();
  if (redirectTo === null || typeof redirectTo.page !== "string") {
    throw new Error(
      `Article ${fromTitle} is a redirect but wtf_wikipedia did not return a target page.`,
    );
  }
  return redirectTo.page;
}

function pageId(doc: WtfDocument): number {
  const id = doc.pageID();
  if (id === null) throw new Error(`wtf_wikipedia document does not have a page ID.`);
  return id;
}

// Returns wtf doc from a fetchWookiee page, handling normalizations.
export async function docFromPage(
  page: WookieepediaPageResult,
  draft: DraftWithArticleTitle | undefined,
): Promise<WtfDocument | null> {
  if ("normalizedFrom" in page && page.normalizedFrom?.includes("#")) {
    page.title += page.normalizedFrom.slice(page.normalizedFrom.indexOf("#")).replace("_", " ");
  }

  if (isPageMissing(page)) {
    return null;
  }

  const foundPage: WookieepediaPage = page;

  // This will happen if the normalization is not exact.
  if (draft === undefined) {
    throw new Error(
      `Mismatch between timeline title and the title received from the server for: "${page.title}"`,
    );
  }

  // Use the normalized title.
  if (draft.href) draft.href = page.title;
  else draft.title = page.title;

  let doc = wtf(foundPage.wikitext);

  while (doc.isRedirect()) {
    const targetPage = redirectPage(doc, draft.title);
    log.info(`Article ${draft.title} is a redirect to ${targetPage}. Fetching...`);
    netLog.redirectNum++;
    draft.redirect = true;
    const redirectDoc = await docFromTitle(targetPage);
    if (redirectDoc === null) {
      throw new Error(`Redirected from "${draft.title}" to an invalid wookieepedia article!`);
    }
    doc = redirectDoc;

    // Make sure pageid always points to the final article in redirect chain.
    draft.pageid = pageId(doc);
  }

  if (doc.isDisambig()) {
    log.error("Disambiguation page! title: " + draft.title);
  }

  return doc;
}
