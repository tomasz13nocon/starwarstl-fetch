import wtf from "./wtf.ts";
import { log } from "./util.ts";

import type { WtfTemplateParseResult, WtfTemplateParser } from "./types/wtf.ts";

function value(value: WtfTemplateParseResult[string]): string | undefined {
  if (typeof value === "string" || value === undefined) return value;
  throw new Error(`Expected a scalar template value, got ${JSON.stringify(value)}`);
}

function requiredList(parsed: WtfTemplateParseResult): string[] {
  if (parsed.list === undefined) throw new Error(`Expected positional template arguments.`);
  return parsed.list;
}

function optionalList(parsed: WtfTemplateParseResult): string[] {
  return parsed.list ?? [];
}

export default function initWtf(): void {
  wtf.extend((models, templates) => {
    let parse: WtfTemplateParser = models.parse;

    templates.c = (tmpl, list) => {
      let x = parse(tmpl, ["value"]);
      list.push({ template: "C", value: x.value });
      return `{{C|${x.value}}}`;
    };

    templates.circa = (tmpl, list) => {
      let x = parse(tmpl, ["value"]);
      list.push({ template: "C", value: x.value });
      return `((Approximate date))`;
    };

    // Ignore quotes found at the begining of articles so that the first paragraph is the actual article
    templates.quote = (tmpl, list) => {
      list.push(parse(tmpl, ["text", "author"]));
      return "";
    };

    templates["scroll box"] = (tmpl) => {
      // implement if causing issues
      return tmpl;
    };

    // For appearances section (App template), which uses {{!}} as a column break
    templates["!"] = (tmpl) => {
      return tmpl;
    };

    templates["'s"] = (tmpl, list) => {
      list.push(parse(tmpl));
      return "'s";
    };

    // Below are templates used in the timeline to produce links to episodes of different series.
    // They contain additional info like episode number, or magazine issue, that we could use later

    function formatLink(page: string | undefined, name?: string) {
      return `[[${page}${name ? "|" + name : ""}]]`;
    }

    function requiredValue(parsed: WtfTemplateParseResult, key: string): string {
      const ret = value(parsed[key]);
      if (ret === undefined) throw new Error(`Expected template argument "${key}".`);
      return ret;
    }

    function requiredListValue(parsed: WtfTemplateParseResult, index: number): string {
      const ret = requiredList(parsed)[index];
      if (ret === undefined) throw new Error(`Expected positional template argument ${index}.`);
      return ret;
    }

    // This is based on a scuffed template used by some Cite templates.
    // It recreates that template's behavior exactly.
    // Update: They changed this to #invoke a lua function via the Scribunto extension https://www.mediawiki.org/wiki/Extension:Scribunto
    // Therefore this reimplementation is out of date
    function hideParanthetical(page: string, text?: string, italics = false) {
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

    function seriesCite(tmpl: string, templateList: WtfTemplateParseResult[]) {
      let parsed = parse(tmpl);
      templateList.push(parsed);

      return formatLink(requiredList(parsed)[0], requiredList(parsed)[1]);
    }

    function magazineCite(tmpl: string, templateList: WtfTemplateParseResult[]) {
      let parsed = parse(tmpl);
      templateList.push(parsed);

      return formatLink(
        requiredList(parsed)[value(parsed.issue1) ? 0 : 1],
        requiredList(parsed)[value(parsed.issue1) ? 1 : 2],
      );
    }

    function idwCite(tmpl: string, templateList: WtfTemplateParseResult[]) {
      let parsed = parse(tmpl);
      templateList.push(parsed);

      // https://starwars.fandom.com/wiki/Template:IDWAdventuresCite-2017
      // https://starwars.fandom.com/wiki/Template:IDWAdventuresCite-2020
      // TODO: these are issues containing two stories. We should include the name of the issue in the title, like Wookieepedia does, instead of just the story titles.
      return hideParanthetical(
        optionalList(parsed)[1] || requiredValue(parsed, "story"),
        optionalList(parsed)[2] || value(parsed.stext),
      );
    }

    templates.insidercite = magazineCite;
    templates.swrmcite = magazineCite;
    templates.swracite = magazineCite;
    templates.swresacite = magazineCite;
    templates.rebelsmagcite = magazineCite;
    templates.rebelsanimationcite = magazineCite;
    templates.resistanceanimationcite = magazineCite;

    templates.yja = seriesCite;
    templates.funwithnubs = seriesCite;
    templates.acolyte = seriesCite;
    templates.totj = seriesCite;
    templates.goa = seriesCite;
    templates.fod = seriesCite;
    templates.tote = seriesCite;
    templates.totu = seriesCite;
    templates.tbb = seriesCite;
    templates.kenobi = seriesCite;
    templates.andor = seriesCite;
    templates.rebels = seriesCite;
    templates.themandalorian = seriesCite;
    templates.bobf = seriesCite;
    templates.ahsoka = seriesCite;
    templates.skeletoncrew = seriesCite;
    templates.resistance = seriesCite;
    templates.droiddiaries = seriesCite;

    templates["idwadventurescite-2020"] = idwCite;
    templates["idwadventurescite-2017"] = idwCite;

    templates.storycite = (tmpl, list) => {
      let parsed = parse(tmpl);
      list.push(parsed);

      // https://starwars.fandom.com/wiki/Template:StoryCite
      if (parsed.stext || parsed.sformatted) {
        return formatLink(value(parsed.story), value(parsed.stext) || value(parsed.sformatted));
      } else {
        return hideParanthetical(requiredValue(parsed, "story"));
      }
    };

    templates.tcw = (tmpl, list) => {
      let parsed = parse(tmpl);
      list.push(parsed);

      // https://starwars.fandom.com/wiki/Template:TCW
      let title =
        requiredList(parsed)[0] === "Destiny"
          ? "Destiny (Star Wars: The Clone Wars)"
          : requiredList(parsed)[0];
      return formatLink(title, requiredList(parsed)[1]);
    };

    templates.easwyoutube = (tmpl, list) => {
      let parsed = parse(tmpl);
      list.push(parsed);

      // https://starwars.fandom.com/wiki/Template:EASWYouTube
      if (parsed.int) {
        return formatLink(value(parsed.int), optionalList(parsed)[1] || value(parsed.text));
      } else {
        return `[https://www.youtube.com/${value(parsed.parameter) || "watch?v"}=${optionalList(parsed)[0] || value(parsed.video)} ${optionalList(parsed)[1] || value(parsed.text)}]`;
      }
    };

    templates.ea = (tmpl, list) => {
      let parsed = parse(tmpl);
      list.push(parsed);

      // https://starwars.fandom.com/wiki/Template:EA
      // TODO {{PAGENAME}} magic word is used as default if template args not present. Not sure what it expands to in the timeline, but surely it's "Timeline of canon media" which would mean no one would use it there
      return parsed.int
        ? formatLink(value(parsed.int), value(parsed.text) || optionalList(parsed)[1])
        : `[https://${value(parsed.subdomain) || "www"}.ea.com/${value(parsed.url) || optionalList(parsed)[0]} ${value(parsed.text) || optionalList(parsed)[1]}]`;
    };

    templates.ffs = (tmpl, list) => {
      let parsed = parse(tmpl);
      list.push(parsed);

      // https://starwars.fandom.com/wiki/Template:FFG
      return hideParanthetical(requiredValue(parsed, "story"), value(parsed.stext));
    };

    templates.film = (tmpl) => {
      let x = parse(tmpl, ["value"]);
      switch (x.value) {
        case "1":
        case "I":
          return "[[Star Wars: Episode I The Phantom Menace|''Star Wars'': Episode I ''The Phantom Menace'']]";
        case "2":
        case "II":
          return "[[Star Wars: Episode II Attack of the Clones|''Star Wars'': Episode II ''Attack of the Clones'']]";
        case "3":
        case "III":
          return "[[Star Wars: Episode III Revenge of the Sith|''Star Wars'': Episode III ''Revenge of the Sith'']]";
        case "4":
        case "IV":
          return "[[Star Wars: Episode IV A New Hope|''Star Wars'': Episode IV ''A New Hope'']]";
        case "5":
        case "V":
          return "[[Star Wars: Episode V The Empire Strikes Back|''Star Wars'': Episode V ''The Empire Strikes Back'']]";
        case "6":
        case "VI":
          return "[[Star Wars: Episode VI Return of the Jedi|''Star Wars'': Episode VI ''Return of the Jedi'']]";
        case "7":
        case "VII":
          return "[[Star Wars: Episode VII The Force Awakens|''Star Wars'': Episode VII ''The Force Awakens'']]";
        case "8":
        case "VIII":
          return "[[Star Wars: Episode VIII The Last Jedi|''Star Wars'': Episode VIII ''The Last Jedi'']]";
        case "9":
        case "IX":
          return "[[Star Wars: Episode IX The Rise of Skywalker|''Star Wars'': Episode IX ''The Rise of Skywalker'']]";
        default:
          log.warn("Unknown Film template argument:", x.value);
          return tmpl;
      }
    };

    templates.jtc = (tmpl, list) => {
      let parsed = parse(tmpl);
      list.push(parsed);

      let episode = `Episode ${requiredListValue(parsed, 0)} (Star Wars: Jedi Temple Challenge)`;
      return formatLink(episode);
    };

    templates.grogucutest = (tmpl, list) => {
      let parsed = parse(tmpl);
      list.push(parsed);

      let episode = `Episode ${requiredListValue(parsed, 0)} (Grogu Cutest In The Galaxy)`;
      return formatLink(episode, requiredList(parsed)[1]);
    };

    templates.galacticpals = (tmpl, list) => {
      // https://starwars.fandom.com/wiki/Template:GalacticPals?action=edit

      let parsed = parse(tmpl);
      list.push(parsed);

      let episode;
      const parsedList = requiredList(parsed);
      const subject = requiredListValue(parsed, 0);
      if (subject === "Porgs") {
        episode = "Porgs (Galactic Pals)";
      } else if (subject === "Rancor") {
        episode = "Rancor (Galactic Pals)";
      } else if (subject === "Tauntaun") {
        episode = "Tauntaun (Galactic Pals)";
      } else if (subject.includes("(")) {
        episode = subject;
      } else {
        episode = subject + " (episode)";
      }

      return formatLink(episode, parsedList[1]);
    };

    templates.goc = (tmpl, list) => {
      // https://starwars.fandom.com/wiki/Template:GoC?action=edit

      let parsed = parse(tmpl);
      list.push(parsed);

      let episode;
      const parsedList = requiredList(parsed);
      const subject = requiredListValue(parsed, 0);
      if (subject === "Porgs") {
        episode = "Porgs (Galaxy of Creatures)";
      } else if (subject === "Rancor") {
        episode = "Rancor (Galaxy of Creatures)";
      } else if (subject === "Tauntaun") {
        episode = "Tauntaun (Galaxy of Creatures)";
      } else if (subject.includes("(")) {
        episode = subject;
      } else {
        episode = subject + " (episode)";
      }

      return formatLink(episode, parsedList[1]);
    };

    templates.holonetnewstumblr = (tmpl, list) => {
      let parsed = parse(tmpl);
      list.push(parsed);

      return `[[${parsed.int}]]`;
    };

    // Appearances templates. Rust parses these, so leave them be
    const appTemplates = ["1st", "1stm", "co", "mo", "imo", "flash", "1stid", "hologram"];
    for (let template of appTemplates) {
      templates[template] = (tmpl) => {
        return tmpl;
      };
    }
  });
}
