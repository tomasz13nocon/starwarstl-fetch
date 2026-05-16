import type { MediaDraft, SeriesDraft } from "./draft.js";
import type { AppearancesDrafts } from "./appearances.js";

export type PipelineOptions = {
  skipImages?: boolean;
  skipValidatePageIds?: boolean;
  limit?: number;
};

export type ValidatePageIdsResult = {
  missingDrafts: unknown[];
  missingMediaNoLongerMissing: MediaDraft[];
};

export type PipelineResult = ValidatePageIdsResult & {
  drafts: MediaDraft[];
  seriesDrafts: SeriesDraft[];
  appearancesDrafts: AppearancesDrafts;
};

export type MediaStageResult = {
  seriesDrafts: SeriesDraft[];
  appearancesDrafts: AppearancesDrafts;
};

export type TimelineCell = {
  text: string;
  links?: Array<{ page: string }>;
};

export type TimelineRow = {
  Title: TimelineCell;
  col2: TimelineCell;
  Released: TimelineCell;
  Year: TimelineCell;
};
