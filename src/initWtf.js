import wtf from "wtf_wikipedia";
import { log } from "./util.js";

export default function () {
  wtf.extend((models, templates) => {
    let parse = models.parse;

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

    // Appearances templates. Rust parses these, so leave them be
    const appTemplates = ["1st", "1stm", "co", "mo", "imo", "flash", "1stid", "hologram"];
    for (let template of appTemplates) {
      templates[template] = (tmpl) => {
        return tmpl;
      };
    }
  });
}
