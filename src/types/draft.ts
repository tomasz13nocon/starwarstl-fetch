import type { DraftAppearance } from "./appearances.js";
import type { AstNode, ParsedDate, RichText } from "./ast.js";
import type { FullType, MediaType, SeriesType } from "./media.js";
import type { WtfDocument } from "./wtf.js";

type ArticleMetadata = {
  pageid?: number;
  redlink?: boolean;
  redirect?: boolean;
};

type CoverFields = {
  coverWook?: string;
  cover?: string;
  coverWidth?: number;
  coverHeight?: number;
  coverTimestamp?: string;
  coverSha1?: string;
  coverHash?: string;
};

/** Fields copied from Wookieepedia infoboxes onto media and series drafts. */
export type InfoboxDraftFields = {
  releaseDateDetails?: RichText;
  dateDetails?: AstNode[];
  closed?: AstNode[];
  author?: AstNode[];
  writerDetails?: RichText;
  narrator?: RichText;
  director?: RichText;
  producer?: AstNode[];
  starring?: AstNode[];
  music?: AstNode[];
  developer?: AstNode[];
  illustrator?: RichText;
  editor?: RichText;
  penciller?: RichText;
  inker?: RichText;
  letterer?: RichText;
  colorist?: RichText;
  coverArtist?: RichText;
  designer?: AstNode[];
  programmer?: AstNode[];
  artist?: AstNode[];
  composer?: AstNode[];
  creators?: AstNode[];
  executiveProducers?: AstNode[];
  guests?: AstNode[];
  publisher?: string[] | null;
  publisherDetails?: RichText;
  series?: string[] | null;
  seriesDetails?: RichText;
  publishedIn?: RichText;
  pages?: RichText;
  isbn?: string;
  upc?: string;
  language?: RichText;
  mediaType?: RichText;
  season?: number | string;
  seasonDetails?: RichText;
  seasonNote?: string;
  episode?: string;
  episodeDetails?: RichText;
  se?: string;
  production?: RichText;
  runtime?: RichText;
  network?: AstNode[];
  numEpisodes?: string;
  numSeasons?: string;
  lastAired?: AstNode[];
  engine?: RichText;
  genre?: RichText;
  modes?: RichText;
  ratings?: RichText;
  platforms?: AstNode[];
  basegame?: RichText;
  expansions?: AstNode[];
  budget?: RichText;
  prev?: RichText;
  next?: RichText;
  precededBy?: AstNode[];
  followedBy?: AstNode[];
  issue?: RichText;
};

/** Mutable media object passed through pipeline stages. */
export type MediaDraft = ArticleMetadata &
  CoverFields &
  InfoboxDraftFields & {
    _id: number;
    title: string;
    type: MediaType;
    releaseDate: string;
    date: string | null;
    chronology: number;
    releaseDateEffective?: string;
    timelineNotes?: AstNode[];
    adaptation?: boolean;
    exactPlacementUnknown?: boolean;
    href?: string;
    notUnique?: boolean;
    unreleased?: boolean;
    nopage?: boolean;
    fullType?: FullType;
    audiobook?: boolean;
    dateParsed?: ParsedDate[];
    appearances?: DraftAppearance[];

    /** Temporary pipeline fields removed before DB insertion. */
    doc?: WtfDocument;
    titleText?: string;
  };

/** Mutable series object assembled from media and series articles. */
export type SeriesDraft = ArticleMetadata &
  CoverFields &
  InfoboxDraftFields & {
    title: string;
    type?: SeriesType;
    fullType?: FullType;
    displayTitle?: string;

    /** Temporary pipeline field removed before DB insertion. */
    doc?: WtfDocument;
  };
