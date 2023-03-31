import config from "../config.js";
import { Size } from "../const.js";
import { db } from "../db.js";
import { fetchImageInfo } from "../fetchWookiee.js";
import netLog from "../netLog.js";
import { log, toHumanReadable } from "../util.js";
import sharp from "sharp";
import sizeOf from "buffer-image-size";
import { encode, isBlurhashValid } from "blurhash";

const { Image } = config();

export default async function (drafts) {
  let docs = await db
    .collection("media")
    .find(
      {},
      {
        projection: {
          title: 1,
          cover: 1,
          coverTimestamp: 1,
          coverWidth: 1,
          coverHeight: 1,
          coverSha1: 1,
          coverHash: 1,
        },
      }
    )
    .toArray();

  let currentCovers = {};
  for (let doc of docs) {
    currentCovers[doc.title] = doc;
  }

  // We need a map of cover filenames to article titles in order to check for existing covers
  let titlesDict = {};
  for (let v of Object.values(drafts)) {
    titlesDict[v.coverWook] = v.title;
  }

  let covers = Object.values(drafts)
    .filter((o) => o.coverWook)
    .map((draft) => "File:" + draft.coverWook);

  log.info("Fetching imageinfo...");
  let progress = 0;
  let outOf = covers.length;
  log.setStatusBarText([`Image: ${progress}/${outOf}`]);

  let imageinfos = fetchImageInfo(covers);

  for await (let imageinfo of imageinfos) {
    // Keep in mind imageinfo.title is a filename of the image, not the article title
    let articleTitle = titlesDict[(imageinfo.normalizedFrom ?? imageinfo.title).slice(5)];
    let current = currentCovers[articleTitle];
    // Remove leading "File:"
    let myFilename = imageinfo.title.slice(5);
    // Change extension to webp
    let pos = myFilename.lastIndexOf(".");
    myFilename = myFilename.substr(0, pos < 0 ? myFilename.length : pos) + ".webp";
    let image = new Image(myFilename);

    // Check if we need to get any covers
    if (
      !current || // new media (not in DB yet)
      !current.cover || // cover got added
      current.coverTimestamp < imageinfo.timestamp || // cover got updated
      (await image.anyMissing()) // any cover variant missing
    ) {
      let buffer;

      // TODO: Handle cover updates (timestamp).
      // Read cover if we have it, else fetch it
      if (await image.exists(Size.FULL)) {
        buffer = await image.read();
      } else {
        let resp = await fetch(imageinfo.url, { headers: { Accept: "image/webp,*/*;0.9" } });
        netLog.requestNum++;
        if (!resp.ok) {
          throw "Non 2xx response status! Response:\n" + JSON.stringify(resp);
        }
        if (resp.headers.get("Content-Type") !== "image/webp") {
          log.error(`Image in non webp. article: ${articleTitle}, filename: ${image.filename}`);
          // image.filename = imageinfo.title.slice(5);
          process.exit(1);
        }
        let respSize = (await resp.clone().blob()).size;
        netLog.imageBytesRecieved += respSize;
        log.info(`Recieved ${toHumanReadable(respSize)} of image "${imageinfo.title}"`);
        buffer = Buffer.from(await resp.arrayBuffer());
        log.info(`Writing cover for "${articleTitle}" named "${image.filename}"`);
        await image.write(buffer);
      }

      await image.writeVariantsIfMissing(buffer);

      const dimensions = sizeOf(buffer);
      drafts[articleTitle].cover = image.filename;
      drafts[articleTitle].coverWidth = dimensions.width;
      drafts[articleTitle].coverHeight = dimensions.height;
      drafts[articleTitle].coverTimestamp = imageinfo.timestamp;
      drafts[articleTitle].coverSha1 = imageinfo.sha1;
      try {
        let {
          data: bufferData,
          info: { width, height },
        } = await sharp(await image.read(Size.THUMB))
          .raw()
          .ensureAlpha()
          .toBuffer({ resolveWithObject: true });

        let ar = width / height;
        let w = Math.floor(Math.min(9, Math.max(3, 3 * ar)));
        let h = Math.floor(Math.min(9, Math.max(3, 3 / ar)));
        drafts[articleTitle].coverHash = encode(
          new Uint8ClampedArray(bufferData),
          width,
          height,
          w,
          h
        );
      } catch (err) {
        log.error(`Error calculating hash for image: "${image.filename}" `, err);
        process.exit(1);
      }

      // If we had a cover already and it didn't get overwritten, delete it
      if (current?.cover && current.cover !== image.filename) {
        log.info(`Deleteing old cover: ${current.cover} in favor of ${image.filename}`);
        let oldImage = new Image(current.cover);
        await oldImage.delete();
      }
    } else {
      drafts[articleTitle].cover = current.cover;
      drafts[articleTitle].coverWidth = current.coverWidth;
      drafts[articleTitle].coverHeight = current.coverHeight;
      drafts[articleTitle].coverTimestamp = current.coverTimestamp;
      drafts[articleTitle].coverSha1 = current.coverSha1;
      drafts[articleTitle].coverHash = current.coverHash;
    }

    let blurhashValid = isBlurhashValid(drafts[articleTitle].coverHash);
    if (!blurhashValid.result) {
      log.error(
        `Blurhash invalid for ${imageinfo.title} of ${articleTitle}! Hash: "${drafts[articleTitle].coverHash}" Reason: ` +
          blurhashValid.errorReason
      );
    }

    log.setStatusBarText([`Image: ${++progress}/${outOf}`]);
  }
}
