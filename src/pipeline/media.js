import _ from "lodash";
import config, { debug } from "../config.js";
import { fetchWookiee } from "../fetchWookiee.js";
import { UnsupportedDateFormat, parseWookieepediaDate } from "../parseWookieepediaDate.js";
import { docFromPage, fillDraftWithInfoboxData, reduceAstToText } from "../parsing.js";
import { log } from "../util.js";
import { writeFile } from "fs/promises";
import { cleanupDraft } from "./cleanupDrafts.js";
import native from "../../native/index.cjs";

let { CACHE_PAGES } = config();

function getAppearances(doc) {
  let appsTemplate = doc.templates().find((t) => t.data.template === "app");

  // No appearances template
  if (!appsTemplate) {
    if (doc.wikitext().includes("{{App")) {
      // The template is there but there's a syntax error inside it, which makes wtf fail to parse it
      log.error(`Malformed appearances template in ${doc.title()}`);
    }
    return;
  }

  try {
    let appsParsed = native.parse_appearances(
      appsTemplate.wikitext().replaceAll(/\n{{!}}\n/g, "\n")
    );
    return {
      nodes: appsParsed.nodes[0].Template.parameters,
      links: appsParsed.links,
    };
  } catch (e) {
    log.error(`Error parsing appearances for ${doc.title()}\n${e.message}`);
    return;
  }
}

export default async function (drafts) {
  log.info("Fetching articles...");

  let progress = 0;
  let outOf = drafts.length;
  log.setStatusBarText([`Article: ${progress}/${outOf}`]);

  let pages = fetchWookiee([...new Set(drafts.map((d) => d.href ?? d.title))], CACHE_PAGES);
  let infoboxes = [];
  let seriesDraftsMap = {};
  let appearancesDrafts = {};

  for await (let page of pages) {
    if (debug.article && debug.article !== page.title) continue;
    // This will be a single iteration most of the time
    // It won't be only for "chapter" entries which all link to their parent media
    for (let draft of drafts.filter((d) => (d.href ?? d.title) === page.title)) {
      let doc = await docFromPage(page, draft);
      if (doc === null) {
        let logRedlink = debug.redlinks ? log.warn : log.info;
        logRedlink(`${page.title} is a redlink.`);
        draft.redlink = true;
        // TODO: ensure these have all availible info
        continue;
      }
      draft.doc = doc; // We need this for the second iteration

      let infobox = doc.infobox();
      if (!infobox) {
        throw new Error(
          `No infobox! title: ${draft.title}\nwikitext:\n${page.wikitext.slice(0, 1500)}`
        );
      }

      if (debug.distinctInfoboxes && !infoboxes.includes(infobox._type))
        infoboxes.push(infobox._type, "\n");

      if (infobox._type === "audiobook") draft.audiobook === true;

      fillDraftWithInfoboxData(draft, infobox);

      let appearances = getAppearances(doc);
      draft.appearances = appearances?.nodes;
      if (appearances?.links) {
        for (let [type, links] of Object.entries(appearances.links)) {
          if (type.startsWith("l-")) continue;
          if (type.startsWith("c-")) type = type.slice(2);
          for (let link of links) {
            if (!(type in appearancesDrafts)) appearancesDrafts[type] = {};
            let linkName = link.name;
            if (linkName.endsWith("/Legends")) linkName = linkName.slice(0, -8);
            if (!(linkName in appearancesDrafts[type])) appearancesDrafts[type][linkName] = [];
            // Log repeat appearances
            // if (appearancesDrafts[type][linkName].find((o) => o.id === draft._id)) {
            //   console.error(`Repeat appearance of ${type}: ${linkName} in ${draft.title}`);
            // }
            // for (let [oldType, appDraftsType] of Object.entries(appearancesDrafts)) {
            //   if (appDraftsType[linkName]?.find((o) => o.id === draft._id)) {
            //     console.error(
            //       `Repeat appearance across categories of ${oldType}: ${linkName} in ${draft.title}`
            //     );
            //   }
            // }
            appearancesDrafts[type][linkName].push(
              Object.assign(
                {
                  id: draft._id,
                },
                link.templates && {
                  t: link.templates.map((t) => ({
                    name: t.name,
                    ...(t.parameters.length ? { parameters: t.parameters } : {}),
                  })),
                }
              )
            );
          }
        }
      }

      cleanupDraft(draft);

      try {
        if (draft.dateDetails) {
          try {
            draft.dateParsed = parseWookieepediaDate(draft.dateDetails.reduce(reduceAstToText, ""));
          } catch (e) {
            if (e instanceof UnsupportedDateFormat) {
              draft.dateParsed = parseWookieepediaDate(draft.date);
            } else {
              throw e;
            }
          }
        } else {
          draft.dateParsed = parseWookieepediaDate(draft.date);
        }
      } catch (e) {
        if (e instanceof UnsupportedDateFormat) {
          log.error(draft.title, e);
        } else {
          throw e;
        }
      }

      if (draft.dateParsed === undefined) delete draft.dateParsed;

      if (draft.series) {
        if (draft.type === "tv" && draft.series.length > 1) {
          log.warn(
            `${draft.title} has type "tv" and belongs to multiple series.` +
              " This can cause bugs in frontend!" +
              " Use of buildTvImagePath based on series array and collapsing adjacent tv episodes are some examples."
          );
        }
        for (let seriesTitle of draft.series) {
          if (!(seriesTitle in seriesDraftsMap)) {
            seriesDraftsMap[seriesTitle] = { title: seriesTitle };
          }
        }
      }

      log.setStatusBarText([`Article: ${++progress}/${outOf}`]);
    }
  }

  if (debug.distinctInfoboxes) {
    await writeFile("../../debug/infoboxes.txt", infoboxes);
  }

  return { seriesDrafts: Object.values(seriesDraftsMap), appearancesDrafts };
}
