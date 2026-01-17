import wtf from "wtf_wikipedia";
import fs from "fs/promises";
import util from "util";
import initWtf from "./src/initWtf.js";
import native from "./native/index.cjs";

initWtf();

async function tryParseApps(filename) {
  let wt = await fs.readFile("fixtures/canon/media/" + filename, "utf8");
  let page = JSON.parse(wt);
  let doc = wtf(page.wikitext);

  console.log(`\n=== Parsing ${page.title} from ${filename} ===\n`);

  let appsTemplate = doc.templates().find((t) => t.data.template === "app");

  if (!appsTemplate) {
    console.log("No appearances template found");
  } else {
    // console.log("arg to parse apps:");
    // console.log(appsTemplate.wikitext().replaceAll(/\n{{!}}\n/g, "\n"));
    try {
      let appsParsed = native.parse_appearances(
        appsTemplate.wikitext().replaceAll(/\n{{!}}\n/g, "\n"),
      );
      // console.log(util.inspect(appsParsed, { depth: null, colors: true }));
      console.log("parsed correctly");
    } catch (e) {
      // console.log(e instanceof Error ? e.message : JSON.stringify(e));
      console.log("error caught");
    }
  }
}

tryParseApps("450166.json");
tryParseApps("450169.json");
