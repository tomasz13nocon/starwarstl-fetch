/** Broad timeline media categories. */
export type MediaType =
  | "comic"
  | "book"
  | "audio-drama"
  | "short-story"
  | "yr"
  | "tv"
  | "film"
  | "game";

/** Series can be inferred as multimedia or unknown while drafts are being assembled. */
export type SeriesType = MediaType | "multimedia" | "unknown";

/** Frontend filter subtype assigned by the mediaTypes pipeline stage. */
export type FullType =
  | "book-a"
  | "book-ya"
  | "book-jr"
  | "tv-live-action"
  | "tv-animated"
  | "tv-micro-series"
  | "tv-other"
  | "game"
  | "game-mobile"
  | "game-browser"
  | "game-vr"
  | "comic"
  | "comic-manga"
  | "comic-strip"
  | "comic-story";

export const TYPES_REQUIRING_FULL_TYPE = [
  "tv",
  "book",
  "comic",
  "game",
] as const satisfies readonly MediaType[];

export type TypeRequiringFullType = (typeof TYPES_REQUIRING_FULL_TYPE)[number];
