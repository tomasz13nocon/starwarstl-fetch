import type { MediaDraft, SeriesDraft } from "./draft.js";
import type { AppearancesDrafts } from "./appearances.js";
import type { MissingMediaDocument } from "./db.js";

export type PipelineOptions = {
  skipImages?: boolean;
  skipValidatePageIds?: boolean;
  limit?: number;
};

export type ValidatePageIdsResult = {
  missingDrafts: MissingMediaDocument[];
  missingMediaNoLongerMissing: MediaDraft[];
};

export type PipelineResult = ValidatePageIdsResult & {
  drafts: MediaDraft[];
  seriesDrafts: SeriesDraft[];
  appearancesDrafts: AppearancesDrafts;
};

export type PipelineState = {
  drafts: MediaDraft[];
  seriesDrafts: SeriesDraft[];
  appearancesDrafts: AppearancesDrafts;
};

export type MediaStageResult = {
  seriesDrafts: SeriesDraft[];
  appearancesDrafts: AppearancesDrafts;
};

export type PipelineStage<Input, Output> = (input: Input) => Output | Promise<Output>;

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
