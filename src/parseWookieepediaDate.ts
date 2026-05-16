export class UnsupportedDateFormat extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "UnsupportedDateFormat";
  }
}

export type ParsedWookieepediaDate = {
  date1: number;
  date2?: number;
};

/**
 * Parse all dates or ranges of dates from a Wookieepedia string.
 */
export const parseWookieepediaDate = (
  date: string | null | undefined,
): ParsedWookieepediaDate[] | undefined => {
  if (date === null || date === undefined || date === "") {
    return undefined;
  }
  const founds = date
    .toLowerCase()
    .matchAll(
      /(?:c\.)?\s*(?<date1>[\d,]+)\s*(?:(?<era1>[ab])by)?\s*(?:[–\-&]|and|or)?(?:c\.)?\s*(?<date2>[\d,]+)?\s*(?:(?<era2>[ab])by)?/g,
    );
  const ret: ParsedWookieepediaDate[] = [];
  for (const found of founds) {
    const date1 = found.groups?.date1;
    if (date1 === undefined) continue;

    const toPush: ParsedWookieepediaDate = {
      date1: Number(date1.replace(",", "")),
    };

    const date2 = Number(found.groups?.date2?.replace(",", ""));
    if (!Number.isNaN(date2)) {
      toPush.date2 = date2;
    }

    if (
      found.groups?.era1 === "b" ||
      (found.groups?.era1 === undefined && found.groups?.era2 === "b")
    ) {
      toPush.date1 = -toPush.date1;
    }
    if (found.groups?.era2 === "b" && toPush.date2 !== undefined) {
      toPush.date2 = -toPush.date2;
    }
    ret.push(toPush);
  }
  if (ret.length === 0) {
    throw new UnsupportedDateFormat(`Cannot parse Wookieepedia date string: ${date}`);
  }
  return ret;
};
