export type ImageSize = "thumb/" | "medium/" | "small/" | "full/";

export type ImageStorage = {
  filename: string;
  anyMissing(): Promise<boolean>;
  exists(size?: ImageSize): Promise<boolean>;
  read(size?: ImageSize): Promise<Buffer>;
  write(buffer: Buffer, size?: ImageSize): Promise<void>;
  writeVariantsIfMissing(buffer: Buffer): Promise<void>;
  delete(size?: ImageSize): Promise<void>;
};

export type ImageStorageConstructor = new (filename: string) => ImageStorage;

export type Config = {
  CACHE_PAGES: boolean;
  LIMIT: number;
  LEGENDS: boolean;
  LOCAL: boolean;
  Image: ImageStorageConstructor;
};

export type DebugConfig = {
  distinctInfoboxes: boolean;
  redlinks: boolean;
  normTitles: boolean;
  normImages: boolean;
  article?: string;
};

export const ImageSizes = {
  THUMB: "thumb/",
  MEDIUM: "medium/",
  SMALL: "small/",
  FULL: "full/",
} as const satisfies Record<string, ImageSize>;
