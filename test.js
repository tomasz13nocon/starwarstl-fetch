import wtf from "wtf_wikipedia";
import fs from "fs/promises";
import util from "util";

const knownTemplates = [
  "top",
  "youmay",
  "prettytable",
  "storycite",
  "insidercite",
  "yja",
  "funwithnubs",
  "idwadventurescite-2020",
  "acolyte",
  "totj",
  "film",
  "goa",
  "idwadventurescite-2017",
  "fod",
  "tcw",
  "tote",
  "tbb",
  "kenobi",
  "holonetnews",
  "andor",
  "rebels",
  "swrmcite",
  "swracite",
  "easwyoutube",
  "ea",
  "themandalorian",
  "bobf",
  "ahsoka",
  "skeletoncrew",
  "resistance",
  "swresacite",
  "goc",
  "galacticpals",
  "reflist",
  "scroll box",
  "mediatimelines",
  "interlang",
];

wtf.extend((models, templates) => {
  let parse = models.parse;

  // Below are templates used in the timeline to produce links to episodes of different series.
  // They contain additional info like episode number, or magazine issue, that we could use later

  function formatLink(page, name) {
    return `[[${page}${name ? "|" + name : ""}]]`;
  }

  // This is based on a scuffed template used by some Cite templates.
  // It recreates that template's behavior exactly.
  function hideParanthetical(page, text, italics = false) {
    // https://starwars.fandom.com/wiki/Template:HideParanthetical
    if (text) return `[[${page}|${text}]]`;

    let rv = "";
    if (page.includes("(")) {
      if (italics) rv += "''";
      rv += `[[${page}|`;
      rv += page.slice(0, page.indexOf("("));
      rv += "]]";
      if (italics) rv += "''";
    } else {
      if (italics) rv += "''";
      rv += `[[${page}]]`;
      if (italics) rv += "''";
    }

    return rv;
  }

  function seriesCite(tmpl, list) {
    let parsed = parse(tmpl);
    list.push(parsed);

    return formatLink(parsed.list[0], parsed.list[1]);
  }

  function magazineCite(tmpl, list) {
    let parsed = parse(tmpl);
    list.push(parsed);

    return formatLink(parsed.list[parsed.issue1 ? 0 : 1], parsed.list[parsed.issue1 ? 1 : 2]);
  }

  function idwCite(tmpl, list) {
    let parsed = parse(tmpl);
    list.push(parsed);

    // https://starwars.fandom.com/wiki/Template:IDWAdventuresCite-2017
    // https://starwars.fandom.com/wiki/Template:IDWAdventuresCite-2020
    // TODO: these are issues containing two stories. We should include the name of the issue in the title, like Wookieepedia does, instead of just the story titles.
    return hideParanthetical(parsed.list?.[1] || parsed.story, parsed.list?.[2] || parsed.stext);
  }

  templates.insidercite = magazineCite;
  templates.swrmcite = magazineCite;
  templates.swracite = magazineCite;
  templates.swresacite = magazineCite;

  templates.yja = seriesCite;
  templates.funwithnubs = seriesCite;
  templates.acolyte = seriesCite;
  templates.totj = seriesCite;
  templates.goa = seriesCite;
  templates.fod = seriesCite;
  templates.tote = seriesCite;
  templates.tbb = seriesCite;
  templates.kenobi = seriesCite;
  templates.andor = seriesCite;
  templates.rebels = seriesCite;
  templates.themandalorian = seriesCite;
  templates.bobf = seriesCite;
  templates.ahsoka = seriesCite;
  templates.skeletoncrew = seriesCite;
  templates.resistance = seriesCite;
  templates.goc = seriesCite;
  templates.galacticpals = seriesCite;

  templates["idwadventurescite-2020"] = idwCite;
  templates["idwadventurescite-2017"] = idwCite;

  templates.storycite = (tmpl, list) => {
    let parsed = parse(tmpl);
    list.push(parsed);

    // https://starwars.fandom.com/wiki/Template:StoryCite
    if (parsed.stext || parsed.sformatted) {
      return formatLink(parsed.story, parsed.stext || parsed.sformatted);
    } else {
      return hideParanthetical(parsed.story);
    }
  };

  templates.tcw = (tmpl, list) => {
    let parsed = parse(tmpl);
    list.push(parsed);

    // https://starwars.fandom.com/wiki/Template:TCW
    let title =
      parsed.list[0] === "Destiny" ? "Destiny (Star Wars: The Clone Wars)" : parsed.list[0];
    return formatLink(title, parsed.list[1]);
  };

  templates.easwyoutube = (tmpl, list) => {
    let parsed = parse(tmpl);
    list.push(parsed);

    // https://starwars.fandom.com/wiki/Template:EASWYouTube
    if (parsed.int) {
      return formatLink(parsed.int, parsed.list?.[1] || parsed.text);
    } else {
      return `[https://www.youtube.com/${parsed.parameter || "watch?v"}=${parsed.list?.[0] || parsed.video} ${parsed.list?.[1] || parsed.text}]`;
    }
  };

  templates.ea = (tmpl, list) => {
    let parsed = parse(tmpl);
    list.push(parsed);

    // https://starwars.fandom.com/wiki/Template:EA
    // TODO {{PAGENAME}} magic word is used as default if template args not present. Not sure what it expands to in the timeline, but surely it's "Timeline of canon media" which would mean no one would use it there
    return parsed.int
      ? formatLink(parsed.int, parsed.text || parsed.list?.[1])
      : `[https://${parsed.subdomain || "www"}.ea.com/${parsed.url || parsed.list?.[0]} ${parsed.text || parsed.list?.[1]}]`;
  };
});

// TODO: Should we use ?? instead of ||
// inspect mw behavior: what if we have {{templ|param=}}

let wt = await fs.readFile("debug/timeline", "utf8");
// let wt = `{|width="100%" class="sortable" {{Prettytable}}
// ! width="115px" | Year ||width="25px"| || Title ||width="100px"| Released
// |- class="short"
// |||- class="short" | SS || {{StoryCite|book=Myths & Fables|story=The Silent Circle (short story)}} †
// || 2020-10-07
// |- class="short"
// |||- class="short" | SS || {{YJA|qwe}} †
// || 2020-10-07
// |}`;
let doc = wtf(wt);

console.log(new Set(doc.templates().map((t) => t.json().template)));

console.log(
  util.inspect(
    doc
      .tables()[1]
      .json()
      .map((row) => row.Title)
      .filter((title) => title.text.includes("QWE")),
    false,
    null,
    true,
  ),
);
// console.log(doc.templates()[1].json());
