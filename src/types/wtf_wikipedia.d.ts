declare module "wtf_wikipedia" {
  import type { WtfDocument } from "./wtf.js";

  /**
   * Minimal wtf_wikipedia module surface used by this project.
   *
   * We intentionally do not model the full parser API. The fetch pipeline only
   * depends on the default parser function, the dynamic template-extension hook,
   * and the document/template/table/infobox/link methods described in
   * `src/types/wtf.ts`.
   */
  type WtfTemplateParseValue = string | string[] | undefined;

  export type WtfTemplateParseResult = {
    list?: string[];
    [key: string]: WtfTemplateParseValue;
  };

  export type WtfTemplateParser = (
    templateWikitext: string,
    positionalKeys?: string[],
  ) => WtfTemplateParseResult;

  export type WtfExtensionModels = {
    parse: WtfTemplateParser;
  };

  export type WtfTemplateHandler = (templateWikitext: string, list: WtfTemplateParseResult[]) => string;

  export type WtfTemplateHandlers = Record<string, WtfTemplateHandler>;

  export type WtfExtension = (models: WtfExtensionModels, templates: WtfTemplateHandlers) => void;

  export interface WtfParser {
    (wikitext: string, options?: object): WtfDocument;
    extend(extension: WtfExtension): WtfParser;
    plugin(extension: WtfExtension): WtfParser;
    version: string;
  }

  const wtf: WtfParser;
  export default wtf;
}
