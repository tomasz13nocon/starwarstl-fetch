import { createRequire } from "node:module";

import { allowedAppCategories } from "../const.ts";
import netLog from "../netLog.ts";
import { log } from "../util.ts";

import type {
  AppearanceTemplateParameter,
  ArticleAppearances,
  ParsedAppearances,
  ParsedAppearanceLink,
} from "../types/index.ts";
import type { WtfDocument } from "../types/wtf.ts";

type NativeAppearanceParser = {
  parse_appearances(wikitext: string): {
    nodes: [{ Template: { parameters: AppearanceTemplateParameter[] } }];
    links: Record<string, ParsedAppearanceLink[]>;
  };
};

const require = createRequire(import.meta.url);
const appearancesParser = require("../../native/index.cjs") as NativeAppearanceParser;

export function getAppearances(doc: WtfDocument): ArticleAppearances | undefined {
  const appsTemplate = doc.templates().find((t) => t.data.template === "app");

  // No appearances template.
  if (!appsTemplate) {
    if (doc.wikitext().includes("{{App")) {
      // The template is there but there's a syntax error inside it, which makes wtf fail to parse it.
      log.error(`Malformed appearances template in ${doc.title()}`);
    }
    return undefined;
  }

  try {
    const appsParsed = appearancesParser.parse_appearances(
      appsTemplate.wikitext().replaceAll(/\n{{!}}\n/g, "\n"),
    );

    // Wookieepedia changed the name of the "creatures" category to "organisms", but some articles still use "creatures".
    // This changes the new "organisms" category of appearences into the old "creatures" as we wait for Wookieepedia to finish transitioning all articles to "organisms".
    let creaturesFound = false;
    let organismsFound = false;
    for (const category of appsParsed.nodes[0].Template.parameters) {
      if (["organisms", "c-organisms", "l-organisms"].includes(category.name ?? "")) {
        const countKey = `${category.name}Count`;
        (netLog as Record<string, number>)[countKey] =
          ((netLog as Record<string, number>)[countKey] ?? 0) + 1;
        organismsFound = true;
      }
      if (["creatures", "c-creatures", "l-creatures"].includes(category.name ?? "")) {
        const countKey = `${category.name}Count`;
        (netLog as Record<string, number>)[countKey] =
          ((netLog as Record<string, number>)[countKey] ?? 0) + 1;
        creaturesFound = true;
        log.warn(`${doc.title()} contains ${category.name}`);
        category.name = category.name?.replace("creatures", "organisms") ?? null;
      }
      if (
        !(allowedAppCategories as readonly string[]).includes(
          (category.name ?? "").replace(/(c-)|(l-)/, ""),
        )
      ) {
        log.error(`${doc.title()} contains unknown appearences category: ${category.name}`);
      }
    }
    if (creaturesFound && organismsFound) {
      log.error(
        `'organisms' and 'creatures' coexist in ${doc.title()}. One will get overwritten by the other!`,
      );
    }
    if ("creatures" in appsParsed.links) {
      appsParsed.links.organisms = appsParsed.links.creatures;
      delete appsParsed.links.creatures;
    }
    if ("c-creatures" in appsParsed.links) {
      appsParsed.links["c-organisms"] = appsParsed.links["c-creatures"];
      delete appsParsed.links["c-creatures"];
    }
    if ("l-creatures" in appsParsed.links) {
      appsParsed.links["l-organisms"] = appsParsed.links["l-creatures"];
      delete appsParsed.links["l-creatures"];
    }

    return {
      nodes: appsParsed.nodes[0].Template.parameters,
      links: appsParsed.links,
    };
  } catch (e) {
    const error = e as Error;
    log.error(
      `Error parsing appearances for ${doc.title()}\n${error.message}\nFirst paragraph of the page: ${doc.paragraph(0).text()}`,
    );
    return undefined;
  }
}
