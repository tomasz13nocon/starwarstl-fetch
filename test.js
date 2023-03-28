import * as fs from "fs/promises";
import sharp from "sharp";
// import fetch from "node-fetch";
import { MongoClient } from  "mongodb";
import { decode } from "html-entities";
import { S3Image } from "./s3Image.js";
import wtf from "wtf_wikipedia";

// LISTS
// let doc = wtf(`*[[Bantha]] {{Mo}}
// *[[Insect]]
// **[[Flea]]
// ***[[Lava flea]]
// *[[Kowakian monkey-lizard]] {{Flash}}
// *[[Spark-roach]] {{1stm}}
// *[[Xandank]] {{1st}}`);
// console.log(doc.lists());

console.log(decode("") === "");

// let wt = await fs.readFile("timeline", "utf8");
// let doc = wtf(wt);
// let data = doc.tables()[1].json();
// console.dir([...data.entries()][1770], { depth: 5 });
// console.dir([...data.entries()].find(v => v[1].Title.text.startsWith( "Star Wars: The Force Awakens Graphic Novel Adaptation")), {depth:5});

