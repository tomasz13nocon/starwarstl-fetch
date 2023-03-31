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
export const DB_CONN_STRING =
  process.env.DB_CONNECTION_STRING ?? "mongodb://127.0.0.1:27017/?directConnection=true";
export const BUCKET = "starwarstl";

// Suppress specific warnings for specific titles after manually confirming they're not an issue
// TODO read these from a file
export const suppressLog = {
  lowConfidenceManga: ["The Banchiians"],
  lowConfidenceAdultNovel: ["Star Wars: The Aftermath Trilogy", "The High Republic: Cataclysm"],
  multipleRegexMatches: [
    "Star Wars: The High Republic (Marvel Comics 2021)",
    "Star Wars: The High Republic Adventures",
    "Star Wars: The High Republic: The Edge of Balance",
    "Star Wars: The High Republic: Trail of Shadows",
    "Star Wars: The High Republic: Eye of the Storm",
    "Star Wars: The High Republic Adventures (IDW Publishing 2021)",
    "Star Wars: The High Republic — The Blade",
    "Star Wars: The High Republic Adventures: The Nameless Terror",
  ],
  lowConfidenceAnimated: ["Hunted"],
};

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
  "comic story arc": "comic",
  magazine: "comic",
};

export const types = {
  C: "comic",
  N: "book",
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
  "episode",
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
