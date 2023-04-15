import { fetchBuilder, FileSystemCache } from "node-fetch-cache";
import { debug } from "./config.js";
import { MW_API_USER_AGENT } from "./const.js";
import { log, toHumanReadable } from "./util.js";
import netLog from "./netLog.js";

const fetchCache = fetchBuilder.withCache(new FileSystemCache());

// Joins titles with pipe and returns a wookieepedia API URL string
function createUrl(titles, apiParams) {
  const titlesStr = encodeURIComponent(titles.join("|"));

  const paramsStr = Object.entries(apiParams).reduce(
    (acc, [key, value]) => acc + `&${key}=${value}`,
    ""
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

// Code common to fetchWookiee and fetchImageInfo
const fetchWookieeHelper = async function* (titles, apiParams = {}, cache = true) {
  if (typeof titles === "string") titles = [titles];

  let delayed = 0;

  // Fandom allows up to 50 titles per request
  for (let i = 0; i < titles.length; i += 50) {
    const apiUrl = createUrl(titles.slice(i, i + 50), apiParams);
    const resp = cache
      ? await fetchCache(apiUrl)
      : await fetch(apiUrl, {
          headers: {
            "Accept-Encoding": "gzip",
            "User-Agent": MW_API_USER_AGENT,
          },
        });
    netLog.requestNum++;

    if (!resp.ok) {
      throw "Non 2xx response status! Response:\n" + JSON.stringify(resp);
    }

    let respSize = (await resp.clone().blob()).size;
    netLog.bytesRecieved += respSize;
    log.info(`Recieved ${toHumanReadable(respSize)} of ${apiParams.prop}`);

    const json = await resp.json();

    // If server is busy, wait and retry
    if (json.error?.code === "maxlag") {
      if (++delayed > 5) {
        throw new Error("Too many maxlag errors");
      }
      let delay = 1000 * +resp.headers.get("Retry-After");
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
    let pages = Object.values(json.query.pages);

    // If there's random symbols or underscores in the title it gets normalized,
    // so we make the normalized version part of the return value
    let norms = {};
    if (json.query.normalized) {
      if (apiParams.prop === "imageinfo") {
        if (debug.normImages) {
          log.info("Normalized: ", json.query.normalized);
        }
      } else if (debug.normTitles) {
        log.info("Normalized: ", json.query.normalized);
      }
      for (let norm of json.query.normalized) {
        norms[norm.to] = norm.from;
      }
    }

    for (let page of pages) {
      page.normalizedFrom = norms[page.title];
      yield page;
    }
  }
};

// yields objects containing title, pageid and wikitext
// number of yields will be the same as the amount of titles provided
// titles needs to be a string (single title) or a non empty array of strings
export const fetchWookiee = async function* (titles, cache = true) {
  for await (let page of fetchWookieeHelper(
    titles,
    { prop: "revisions", rvprop: "content|timestamp", rvslots: "main" },
    cache
  )) {
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

export const fetchImageInfo = async function* (titles) {
  for await (let page of fetchWookieeHelper(titles, {
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
