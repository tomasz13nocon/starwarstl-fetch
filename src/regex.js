import { NUMBERS } from "./const.js";

export const seasonReg = new RegExp(
  "^(?:season )?(" +
    Object.keys(NUMBERS).reduce((acc, n) => `${acc}|${n}`) +
    ")$"
);

export const seasonRegWordBound = new RegExp(
  "(?:season )?\\b(" +
    Object.keys(NUMBERS).reduce((acc, n) => `${acc}|${n}`) +
    ")\\b"
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
