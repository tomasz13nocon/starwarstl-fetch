import type { WtfDocument } from "../types/wtf.ts";

export function categories(doc: WtfDocument | null | undefined): string[] {
  return doc?.categories() ?? [];
}
