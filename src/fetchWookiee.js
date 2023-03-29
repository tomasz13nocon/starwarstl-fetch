import { fetchBuilder, FileSystemCache } from "node-fetch-cache";
import { debug } from "./config.js";
import { MW_API_USER_AGENT } from "./const.js";
import { log, toHumanReadable } from "./util.js";
import netLog from "./netLog.js";

const fetchCache = fetchBuilder.withCache(new FileSystemCache());

// Code extracted to use in fetchWookiee and fetchImageInfo
const fetchWookieeHelper = async function* (
  titles,
  apiParams = {},
  cache = true
) {
  if (typeof titles === "string") titles = [titles];
  // Fandom allows up to 50 titles per request
  for (let i = 0; i < titles.length; i += 50) {
    let titlesStr = titles
      .slice(i, i + 50)
      .reduce((acc, t) => (acc += t + "|"), "")
      .slice(0, -1);
    const apiUrl = `https://starwars.fandom.com/api.php?\
action=query&\
format=json&\
origin=*&\
maxlag=1&\
maxage=604800&\
titles=${encodeURIComponent(titlesStr)}\
${Object.entries(apiParams).reduce(
  (acc, [key, value]) => (acc += `&${key}=${value}`),
  ""
)}`;
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
    log.info(`Recieved ${toHumanReadable(respSize)} of ${apiParams.prop}`); //  for titles: ${titles.slice(i, i+50)}
    const json = await resp.json();
    if (json.query === undefined) {
      log.error(apiUrl);
      log.error(json);
      log.error(resp);
      throw "Response Invalid";
    }
    let pages = Object.values(json.query.pages);
    // If there's random symbols or underscores in the title it gets normalized,
    // so we make the normalized version part of the return value
    let normalizations = {};
    if (json.query.normalized) {
      if (apiParams.prop === "imageinfo") {
        if (debug.normalizationsImages) {
          log.info("Normalized: ", json.query.normalized);
        }
      } else if (debug.normalizations) {
        log.info("Normalized: ", json.query.normalized);
      }
      // log.info("Normalized ", json.query.normalized.length, " items");
      for (let normalization of json.query.normalized) {
        normalizations[normalization.to] = normalization.from;
      }
    }
    for (let page of pages) {
      page.normalizedFrom = normalizations[page.title];
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
        // If there's no normalization for this title this field is just undefined
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
        // If there's no normalization for this title this field is just undefined
        normalizedFrom: page.normalizedFrom,
      };
    }
  }
};
