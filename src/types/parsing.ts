import type { AppearanceTemplateParameter, ParsedAppearances } from "./appearances.js";
import type { InfoboxDraftFields, MediaDraft, SeriesDraft } from "./draft.js";
import type { WookieepediaPageResult } from "./wookieepedia.js";
import type { WtfDocument, WtfInfobox, WtfInfoboxValue } from "./wtf.js";

export type ArticleDraft = MediaDraft | SeriesDraft;

export type InfoboxData = Partial<Record<keyof InfoboxDraftFields, WtfInfoboxValue>>;

export type ArticleAppearances = {
  nodes: AppearanceTemplateParameter[];
  links: ParsedAppearances["links"];
};

export type ParsedArticle = {
  page: WookieepediaPageResult;
  draft: ArticleDraft;
  doc: WtfDocument | null;
  infobox?: WtfInfobox | null;
  infoboxData?: InfoboxData;
  appearances?: ArticleAppearances;
};
