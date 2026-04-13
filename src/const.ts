import process from "node:process";
import suppressLogConfig from "../config/suppressLog.json" with { type: "json" };
import type { ImageSize } from "./types/config.ts";
import type { MediaType, SeriesType } from "./types/media.ts";

export const Size = Object.freeze({
  THUMB: "thumb/",
  MEDIUM: "medium/",
  SMALL: "small/",
  FULL: "full/",
} as const satisfies Record<string, ImageSize>);

export const IMAGE_PATH = process.env.IMAGE_PATH ?? "../client/public/img/covers/";
export const S3_IMAGE_PATH = "img/covers/";
export const TV_IMAGE_PATH = `../client/public/img/tv-images/thumb/`;
export const MW_API_USER_AGENT = process.env.MW_API_USER_AGENT;
export const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY;
export const AWS_SECRET_KEY = process.env.AWS_SECRET_KEY;
export const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/?directConnection=true";
export const REDIS_URI = process.env.REDIS_URI || "redis://localhost:6379";
export const BUCKET = "starwarstl";

// Suppress specific warnings for specific titles after manually confirming they're not an issue.
export const suppressLog = suppressLogConfig satisfies Record<string, readonly string[]>;

export const knownTemplates = new Set([
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
  "grogucutest",
  "msl",
  "jtc",
  "rebelsmagcite",
  "rebelsanimationcite",
  "resistanceanimationcite",
  "ffg",
  "reflist",
  "scroll box",
  "scrollbox",
  "mediatimelines",
  "interlang",
  "'s",
  "totu",
  "holonetnewstumblr",
  "droiddiaries",
] as const);

export const allowedAppCategories = [
  "characters",
  "dramatis personae",
  "other characters", // When dramatis personeae exists, this does as well, see Thrawn Ascendancy
  "organisms",
  "droids",
  "events",
  "locations",
  "organizations",
  "species",
  "technology",
  "vehicles",
  "miscellanea",
] as const;

export const NUMBERS = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
} as const;

export const seriesTypes = {
  "book series": "book",
  bookseries: "book",
  "comic series": "comic",
  comicseries: "comic",
  movie: "film",
  "television series": "tv",
  televisionseries: "tv",
  "television season": "tv",
  televisionseason: "tv",
  "comic story arc": "comic",
  comicstoryarc: "comic",
  comicarc: "comic",
  magazine: "comic",
  "magazine series": "comic",
  magazineseries: "comic",
} as const satisfies Record<string, Exclude<SeriesType, "multimedia" | "unknown">>;

export const types = {
  C: "comic",
  N: "book",
  A: "audio-drama",
  SS: "short-story",
  YR: "yr",
  JR: "book",
  TV: "tv",
  F: "film",
  VG: "game",
} as const satisfies Record<string, MediaType>;

export type InfoboxField =
  | string
  | {
      name?: string;
      aliases: readonly string[];
      details?: true;
    };

export const infoboxFields = [
  {
    aliases: [
      "release date",
      "airdate",
      "publication date",
      "publish date",
      "released",
      "first aired",
    ],
    details: true,
  },
  "closed",
  "author",
  { aliases: ["writer", "writers"], details: true },
  "narrator",
  "developer",
  { aliases: ["season"], details: true },
  { aliases: ["episode"], details: true },
  "production",
  "guests",
  { aliases: ["director", "directors"] },
  "producer",
  "starring",
  "music",
  { aliases: ["runtime", "run time"] },
  "budget",
  "penciller",
  "inker",
  "letterer",
  "colorist",
  "editor",
  "language",
  { aliases: ["publisher"], details: true },
  "pages",
  "cover artist",
  { name: "dateDetails", aliases: ["timeline"] },
  "illustrator",
  "editor",
  "media type",
  "published in",
  "engine",
  "genre",
  "modes",
  "ratings",
  "platforms",
  { aliases: ["series"], details: true },
  "basegame",
  "expansions",
  "designer",
  "programmer",
  "artist",
  "composer",
  "issue",
  "num episodes",
  "num seasons",
  "network",
  "last aired",
  "creators",
  "executive producers",
  "prev",
  "next",
  "preceded by",
  "followed by",
  "upc",
  "isbn",
  // { name: "coverWook", aliases: ["image"] },
] as const satisfies readonly InfoboxField[];
