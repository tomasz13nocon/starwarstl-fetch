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
    let x = parse(tmpl, ["value"]);
    list.push({ template: "C", value: x.value });
    return `((${x.value}))`;
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

let wt = await fs.readFile("debug/ahsoka.wiki", "utf8");
let doc = wtf(wt);
let listStr = doc
  .templates()
  .find((t) => t.data.template === "app")
  .wikitext()
  .replaceAll(/\n{{!}}\n/g, "\n");
let parsed = native.parse_appearances(listStr);
console.dir(parsed, { depth: 20 });

// let data = doc.tables()[1].json();
// console.dir([...data.entries()][1770], { depth: 5 });
// console.dir([...data.entries()].find(v => v[1].Title.text.startsWith( "Star Wars: The Force Awakens Graphic Novel Adaptation")), {depth:5});
