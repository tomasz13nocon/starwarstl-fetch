import process from "node:process";

export const Size = Object.freeze({
  THUMB: "thumb/",
  MEDIUM: "medium/",
  SMALL: "small/",
  FULL: "full/",
});

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

// Suppress specific warnings for specific titles after manually confirming they're not an issue
// TODO read these from a file
export const suppressLog = {
  lowConfidenceManga: [
    "The Banchiians",
    "Star Wars Rebels, Vol. 1",
    "Star Wars Rebels, Vol. 2",
    "Star Wars Rebels, Vol. 3",
  ],
  lowConfidenceAdultNovel: [
    "Star Wars: The Aftermath Trilogy",
    "The High Republic: Cataclysm",
    "The High Republic: The Eye of Darkness",
    "Reign of the Empire",
    "Reign of the Empire: The Mask of Fear",
    "''Reign of the Empire'' Book Two",
    "''Reign of the Empire'' Book Three",
    "Star Wars: Reign of the Empire",
  ],
  multipleRegexMatches: [
    "Star Wars: The High Republic (Marvel Comics 2021)",
    "Star Wars: The High Republic Adventures",
    "Star Wars: The High Republic: The Edge of Balance",
    "Star Wars: The High Republic: Trail of Shadows",
    "Star Wars: The High Republic: Eye of the Storm",
    "Star Wars: The High Republic Adventures (IDW Publishing 2021)",
    "Star Wars: The High Republic — The Blade",
    "Star Wars: The High Republic Adventures: The Nameless Terror",
    "Star Wars: The High Republic (Marvel Comics 2023)",
    "Star Wars: The High Republic: Shadows of Starlight",
    "Star Wars: The High Republic Adventures – Echoes of Fear",
    "Star Wars: The High Republic – Fear of the Jedi",
    "Star Wars: The High Republic Adventures – Dispatches from the Occlusion Zone",
    "Star Wars: The High Republic Adventures – The Nameless Terror",
    "Star Wars: The High Republic (2021)",
    "Star Wars: The High Republic Adventures (2021)",
    "Star Wars: The High Republic (2023)",
  ],
  lowConfidenceAnimated: ["Hunted", "Star Wars: Fun with Nubs"],
  lowConfidenceAdaptation: [
    "Star Wars Treasury: The Original Trilogy",
    "The Force Awakens: Rey's Story",
    "The Force Awakens: Finn's Story",
  ],
  noSeriesForAudience: ["Star Wars Treasury: The Original Trilogy"],
  noSeason: ["A Death on Utapau", "In Search of the Crystal", "Crystal Crisis", "The Big Bang"],
  migrateMissingPageid: [],
  ignoreMissingPageid: [],
};

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
  "jtc",
  "rebelsmagcite",
  "rebelsanimationcite",
  "resistanceanimationcite",
  "ffg",
  "reflist",
  "scroll box",
  "mediatimelines",
  "interlang",
  "'s",
]);

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
];

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
};

export const seriesTypes = {
  "book series": "book",
  "comic series": "comic",
  movie: "film",
  "television series": "tv",
  "television season": "tv",
  "comic story arc": "comic",
  magazine: "comic",
  "magazine series": "comic",
};

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
];
