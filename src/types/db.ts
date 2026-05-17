import type { OptionalId } from "mongodb";
import type { AppearanceEntry } from "./appearances.js";
import type { MediaDraft, SeriesDraft } from "./draft.js";

export type MediaDocument = OptionalId<MediaDraft>;
export type SeriesDocument = OptionalId<SeriesDraft>;

export type AppearanceCollectionDocument = {
  name: string;
  media: AppearanceEntry[];
};

export type MissingMediaDocument = MediaDocument;

export type MetaDocument = {
  dataUpdateTimestamp: number;
};

export type ListDocument = {
  items?: number[];
};
