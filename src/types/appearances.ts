/** Categories accepted from the Wookieepedia {{App}} template. */
export type AppearanceCategory =
  | "characters"
  | "dramatis personae"
  | "other characters"
  | "organisms"
  | "droids"
  | "events"
  | "locations"
  | "organizations"
  | "species"
  | "technology"
  | "vehicles"
  | "miscellanea";

export type AppearanceNode =
  | AppearanceNodeList
  | AppearanceNodeTemplate
  | AppearanceNodeLink
  | AppearanceNodeText;

/** Native Rust parser shape: discriminated by object key, not by a `type` field. */
export type AppearanceNodeList = {
  List: AppearanceNode[][];
};

export type AppearanceNodeTemplate = {
  Template: AppearanceTemplate;
};

export type AppearanceNodeLink = {
  Link: {
    target: string;
    text: string;
  };
};

export type AppearanceNodeText = {
  Text: string;
};

export type AppearanceTemplate = {
  name: string;
  parameters: AppearanceTemplateParameter[];
};

export type AppearanceTemplateParameter = {
  /** Positional parameters are represented as null by the native module. */
  name: string | null;
  value: AppearanceNode[];
};

export type ParsedAppearanceLink = {
  name: string;
  templates: AppearanceTemplate[] | null;
};

export type ParsedAppearances = {
  nodes: AppearanceNode[];
  links: Record<string, ParsedAppearanceLink[]>;
};

export type DraftAppearance = {
  name: string;
  value: AppearanceNode[];
};

export type AppearanceEntry = {
  id: number;
  t?: Array<{
    name: string;
    parameters?: AppearanceTemplateParameter[];
  }>;
};

export type AppearancesDrafts = Partial<Record<string, Record<string, AppearanceEntry[]>>>;

export function isAppearanceNodeList(node: AppearanceNode): node is AppearanceNodeList {
  return "List" in node;
}

export function isAppearanceNodeTemplate(node: AppearanceNode): node is AppearanceNodeTemplate {
  return "Template" in node;
}

export function isAppearanceNodeLink(node: AppearanceNode): node is AppearanceNodeLink {
  return "Link" in node;
}

export function isAppearanceNodeText(node: AppearanceNode): node is AppearanceNodeText {
  return "Text" in node;
}
