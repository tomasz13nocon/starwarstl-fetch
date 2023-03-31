import { NUMBERS, suppressLog } from "./const.js";
import { log } from "./util.js";

export function reg(str, title) {
  const jr = /junior|middle[ -]grade|chapter book|young[ -]reader|young children/i;
  const ya = /young[ -]adult/i;
  const a = /adult|canon novel/i;
  const aLow = /novels?/i;
  if (jr.test(str)) return "jr";
  if (ya.test(str)) return "ya";
  if (a.test(str)) return "a";
  if (aLow.test(str)) {
    if (!suppressLog.lowConfidenceAdultNovel.includes(title))
      log.warn(`Low confidence guess of adult novel type for ${title} from sentence: ${str}`);
    return "a";
  }
  return null;
}

export const seasonReg = new RegExp(
  "^(?:season )?(" + Object.keys(NUMBERS).reduce((acc, n) => `${acc}|${n}`) + ")$"
);

export const seasonRegWordBound = new RegExp(
  "(?:season )?\\b(" + Object.keys(NUMBERS).reduce((acc, n) => `${acc}|${n}`) + ")\\b"
);

// Latter ones have higher priority, as they overwrite
export const seriesRegexes = {
  multimedia: /multimedia project/i,
  comic:
    /((comic([ -]book)?|manga|graphic novel) (mini-?)?series|series of( young readers?)? (comic([ -]book)?s|mangas|graphic novels))/i,
  "short-story": /short stor(y|ies)/i,
  game: /video game/i,
  // "yr": /((series of books|book series).*?young children|young[- ]reader.*?(book series|series of books))/i,
};
