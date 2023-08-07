import wtf from "wtf_wikipedia";
import fs from "fs/promises";
import native from "./native/index.cjs";

// LISTS
// let doc = wtf(`*[[Bantha]] {{Mo}}
// *[[Insect]]
// **[[Flea]]
// ***[[Lava flea]]
// *[[Kowakian monkey-lizard]] {{Flash}}
// *[[Spark-roach]] {{1stm}}
// *[[Xandank]] {{1st}}`);
// console.log(doc.lists());

wtf.extend((models, templates) => {
  let parse = models.parse;

  templates.c = (tmpl, list) => {
    // let x = parse(tmpl, ["value"]);
    // list.push({ template: "C", value: x.value });
    // return `((${x.value}))`;
    return tmpl;
  };

  // For appearances, which use {{!}} as a column break
  templates["!"] = (tmpl) => {
    return "{{!}}";
  };

  const appTemplates = ["1st", "1stm", "co", "mo", "imo", "flash", "1stid", "hologram"];
  for (let template of appTemplates) {
    templates[template] = (tmpl) => {
      return tmpl;
    };
  }
});

let wt = await fs.readFile("debug/test.wiki", "utf8");
let doc = wtf(wt);
console.log(doc.infobox());
console.log(doc.sentence(0).text());

// let listStr = doc
//   .templates()
//   .find((t) => t.data.template === "app")
//   .wikitext()
//   .replaceAll(/\n{{!}}\n/g, "\n");
// let parsed = native.parse_appearances(listStr);
// console.dir(parsed.links, { depth: 20 });
