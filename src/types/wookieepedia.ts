export type WookieepediaPage = {
  title: string;
  pageid: number;
  wikitext: string;
  timestamp: string;
  normalizedFrom?: string;
};

export type WookieepediaMissingPage = {
  title: string;
  missing: true;
};

export type WookieepediaInvalidPage = {
  title: string;
  invalid: true;
  invalidreason?: string;
};

export type WookieepediaPageResult = WookieepediaPage | WookieepediaMissingPage;

export type WookieepediaImageInfo = {
  title: string;
  pageid: number;
  sha1: string;
  timestamp: string;
  url: string;
  normalizedFrom?: string;
};

export type WookieepediaMissingImageInfo = {
  title: string;
  missing: true;
};

export type WookieepediaInvalidImageInfo = {
  title: string;
  invalid: true;
};

export type WookieepediaImageInfoResult =
  | WookieepediaImageInfo
  | WookieepediaMissingImageInfo
  | WookieepediaInvalidImageInfo;

export type FixtureManifest = {
  capturedAt: string;
  timelineTitle: string;
  pageCount: number;
  imageCount: number;
};

export function isPageMissing(page: WookieepediaPageResult): page is WookieepediaMissingPage {
  return "missing" in page;
}

export function isPageFound(page: WookieepediaPageResult): page is WookieepediaPage {
  return !isPageMissing(page);
}

export function isImageMissing(
  image: WookieepediaImageInfoResult,
): image is WookieepediaMissingImageInfo {
  return "missing" in image;
}

export function isImageInvalid(
  image: WookieepediaImageInfoResult,
): image is WookieepediaInvalidImageInfo {
  return "invalid" in image;
}

export function isImageFound(image: WookieepediaImageInfoResult): image is WookieepediaImageInfo {
  return !isImageMissing(image) && !isImageInvalid(image);
}
