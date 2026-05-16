import NodeFetchCache, { FileSystemCache } from "node-fetch-cache";
import config, { debug } from "./config.ts";
import { MW_API_USER_AGENT } from "./const.ts";
import { log } from "./util.ts";
import netLog from "./netLog.ts";
import { fetchWookieeLocal, fetchImageInfoLocal } from "./fetchLocal.ts";
import type { WookieepediaImageInfoResult, WookieepediaPageResult } from "./types/wookieepedia.ts";

type TitleInput = string | string[];
type ApiParams = Record<string, string>;
type ApiNormalizedTitle = { from: string; to: string };
type ApiPage = {
  title: string;
  pageid?: number;
  invalid?: true;
  invalidreason?: string;
  missing?: true;
  normalizedFrom?: string;
  revisions?: [{ slots: { main: { "*": string } }; timestamp: string }];
  imageinfo?: [{ sha1: string; timestamp: string; url: string }];
};
type ApiResponse = {
  error?: { code?: string };
  query?: {
    pages: Record<string, ApiPage>;
    normalized?: ApiNormalizedTitle[];
  };
};

const fetchCache = NodeFetchCache.create({
  cache: new FileSystemCache(),
});

// Joins titles with pipe and returns a wookieepedia API URL string
function createUrl(titles: string[], apiParams: ApiParams): string {
  const titlesStr = encodeURIComponent(titles.join("|"));

  const paramsStr = Object.entries(apiParams).reduce(
    (acc, [key, value]) => acc + `&${key}=${value}`,
    "",
  );

  return (
    "https://starwars.fandom.com/api.php" +
    "?action=query" +
    "&format=json" +
    "&origin=*" +
    "&maxlag=1" +
    "&maxage=604800" +
    `&titles=${titlesStr}` +
    `${paramsStr}`
  );
}

const opts = {
  headers: {
    "Accept-Encoding": "gzip",
    "User-Agent": MW_API_USER_AGENT ?? "",
  },
};

function assertFoundPage(page: ApiPage): asserts page is ApiPage & { pageid: number } {
  if (page.pageid === undefined) {
    throw new Error(`Page ${page.title} did not include a pageid`);
  }
}

function assertRevisionPage(
  page: ApiPage,
): asserts page is ApiPage & { pageid: number; revisions: [{ slots: { main: { "*": string } }; timestamp: string }] } {
  assertFoundPage(page);
  if (!page.revisions?.[0]) {
    throw new Error(`Page ${page.title} did not include revision content`);
  }
}

function assertImageInfoPage(
  page: ApiPage,
): asserts page is ApiPage & { pageid: number; imageinfo: [{ sha1: string; timestamp: string; url: string }] } {
  assertFoundPage(page);
  if (!page.imageinfo?.[0]) {
    throw new Error(`Page ${page.title} did not include image info`);
  }
}

// Code common to fetchWookiee and fetchImageInfo
const fetchWookieeHelper = async function* (
  titles: TitleInput,
  apiParams: ApiParams = {},
  cache = true,
): AsyncGenerator<ApiPage> {
  if (typeof titles === "string") titles = [titles];

  let delayed = 0;

  // Fandom allows up to 50 titles per request
  for (let i = 0; i < titles.length; i += 50) {
    const apiUrl = createUrl(titles.slice(i, i + 50), apiParams);
    const resp = cache ? await fetchCache(apiUrl, opts) : await fetch(apiUrl, opts);
    netLog.requestNum++;

    if (!resp.ok) {
      throw "Non 2xx response status! Response:\n" + JSON.stringify(resp);
    }

    // TODO: using blob() with node-fetch-cache causes node to hang forever. Uncomment when fixed
    // let respSize = (await resp.clone().blob()).size;
    // netLog.bytesRecieved += respSize;
    // log.info(`Recieved ${toHumanReadable(respSize)} of ${apiParams.prop}`);

    const json = (await resp.json()) as ApiResponse;

    // If server is busy, wait and retry
    if (json.error?.code === "maxlag") {
      if (++delayed > 15) {
        throw new Error("Too many maxlag errors");
      }
      const delay = 1000 * Number(resp.headers.get("Retry-After"));
      log.info(`Waiting for server to catch up for ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
      i -= 50;
      continue;
    }

    if (json.query === undefined) {
      log.error(apiUrl);
      log.error(json);
      log.error(resp);
      throw new Error("Response Invalid");
    }
    const pages = Object.values(json.query.pages);

    // If there's random symbols or underscores in the title it gets normalized,
    // so we make the normalized version part of the return value
    const norms: Record<string, string> = {};
    if (json.query.normalized) {
      if (apiParams.prop === "imageinfo") {
        if (debug.normImages) {
          log.info("Normalized: ", json.query.normalized);
        }
      } else if (debug.normTitles) {
        log.info("Normalized: ", json.query.normalized);
      }
      for (const norm of json.query.normalized) {
        norms[norm.to] = norm.from;
      }
    }

    for (const page of pages) {
      page.normalizedFrom = norms[page.title];
      yield page;
    }
  }
};

// yields objects containing title, pageid and wikitext
// number of yields will be the same as the amount of titles provided
// titles needs to be a string (single title) or a non empty array of strings
const fetchWookieeRemote = async function* (
  titles: TitleInput,
  cache = true,
): AsyncGenerator<WookieepediaPageResult> {
  for await (const page of fetchWookieeHelper(
    titles,
    { prop: "revisions", rvprop: "content|timestamp", rvslots: "main" },
    cache,
  )) {
    if (page.invalid !== undefined) {
      throw new Error(
        `Page ${page.title} is invalid. invalid=true returned from the API. Invalid reason: ${page.invalidreason}`,
      );
    }
    if (page.missing !== undefined) {
      yield {
        title: page.title,
        missing: true,
      };
    } else {
      assertRevisionPage(page);
      yield {
        title: page.title,
        pageid: page.pageid,
        wikitext: page.revisions?.[0].slots.main["*"],
        timestamp: page.revisions?.[0].timestamp,
        // If there's no normalization this field is undefined
        normalizedFrom: page.normalizedFrom,
      };
    }
  }
};

// Wrapper that delegates to local or remote based on config
export const fetchWookiee = async function* (
  titles: TitleInput,
  cache = true,
): AsyncGenerator<WookieepediaPageResult> {
  const { LOCAL, LEGENDS } = config();
  if (LOCAL) {
    yield* fetchWookieeLocal(titles, cache, LEGENDS);
  } else {
    yield* fetchWookieeRemote(titles, cache);
  }
};

const fetchImageInfoRemote = async function* (
  titles: TitleInput,
): AsyncGenerator<WookieepediaImageInfoResult> {
  for await (const page of fetchWookieeHelper(titles, {
    prop: "imageinfo",
    iiprop: "url|sha1|timestamp",
  })) {
    if (page.invalid !== undefined) {
      log.error(`Page ${page.title} is invalid. invalid=true returned from the API.`);
      yield {
        title: page.title,
        invalid: true,
      };
    }
    if (page.missing !== undefined) {
      yield {
        title: page.title,
        missing: true,
      };
    } else {
      assertImageInfoPage(page);
      yield {
        title: page.title,
        pageid: page.pageid,
        sha1: page.imageinfo?.[0].sha1,
        timestamp: page.imageinfo?.[0].timestamp,
        url: page.imageinfo?.[0].url,
        // If there's no normalization this field is undefined
        normalizedFrom: page.normalizedFrom,
      };
    }
  }
};

// Wrapper that delegates to local or remote based on config
export const fetchImageInfo = async function* (
  titles: TitleInput,
): AsyncGenerator<WookieepediaImageInfoResult> {
  const { LOCAL, LEGENDS } = config();
  if (LOCAL) {
    yield* fetchImageInfoLocal(titles, LEGENDS);
  } else {
    yield* fetchImageInfoRemote(titles);
  }
};
