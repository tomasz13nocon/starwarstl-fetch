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
  for (let v of drafts) {
    titlesDict[v.coverWook] = v.title;
  }

  let covers = drafts.filter((o) => o.coverWook).map((draft) => "File:" + draft.coverWook);

  log.info("Fetching imageinfo...");
  let progress = 0;
  let outOf = covers.length;
  log.setStatusBarText([`Image: ${progress}/${outOf}`]);

  let imageinfos = fetchImageInfo(covers);

  for await (let imageinfo of imageinfos) {
    // Keep in mind imageinfo.title is a filename of the image, not the article title
    let articleTitle = titlesDict[(imageinfo.normalizedFrom ?? imageinfo.title).slice(5)];
    let draftsWithThisCover = drafts.filter(
      (d) => d.coverWook === (imageinfo.normalizedFrom ?? imageinfo.title).slice(5)
    );
    if (!imageinfo.url) {
      log.warn(`Image file is 404 for image "${imageinfo.title}" in article "${articleTitle}".`);
      continue;
    }

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
          throw new Error("Non 2xx response status! Response:\n" + JSON.stringify(resp));
        }
        if (resp.headers.get("Content-Type") !== "image/webp") {
          throw new Error(
            `Image in non webp. article: ${articleTitle}, filename: ${image.filename}`
          );
          // image.filename = imageinfo.title.slice(5);
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
      for (let draft of draftsWithThisCover) {
        draft.cover = image.filename;
        draft.coverWidth = dimensions.width;
        draft.coverHeight = dimensions.height;
        draft.coverTimestamp = imageinfo.timestamp;
        draft.coverSha1 = imageinfo.sha1;
      }
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
        for (let draft of draftsWithThisCover) {
          draft.coverHash = encode(new Uint8ClampedArray(bufferData), width, height, w, h);
        }
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
      for (let draft of draftsWithThisCover) {
        draft.cover = current.cover;
        draft.coverWidth = current.coverWidth;
        draft.coverHeight = current.coverHeight;
        draft.coverTimestamp = current.coverTimestamp;
        draft.coverSha1 = current.coverSha1;
        draft.coverHash = current.coverHash;
      }
    }

    let blurhashValid = isBlurhashValid(draftsWithThisCover[0].coverHash);
    if (!blurhashValid.result) {
      log.error(
        `Blurhash invalid for ${imageinfo.title} of ${articleTitle}! Hash: "${draftsWithThisCover[0].coverHash}" Reason: ` +
          blurhashValid.errorReason
      );
    }

    log.setStatusBarText([`Image: ${++progress}/${outOf}`]);
  }
}
