import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { createGunzip } from "zlib";
import { mkdir } from "fs/promises";
import { existsSync } from "fs";

const DUMP_URLS = {
  works: "https://openlibrary.org/data/ol_dump_works_latest.txt.gz",
  editions: "https://openlibrary.org/data/ol_dump_editions_latest.txt.gz",
  authors: "https://openlibrary.org/data/ol_dump_authors_latest.txt.gz",
};

export async function downloadDump(
  type: "works" | "editions" | "authors"
): Promise<string> {
  const url = DUMP_URLS[type];
  const outputPath = `./data/${type}_latest.txt`;

  // Ensure data directory exists
  if (!existsSync("./data")) {
    await mkdir("./data", { recursive: true });
  }

  console.log(`Downloading ${type} dump from ${url}...`);
  console.log(`This may take a while depending on your internet connection.`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error("Response body is null");
    }

    // Stream the response through gunzip to decompress
    await pipeline(
      response.body as any,
      createGunzip(),
      createWriteStream(outputPath)
    );

    console.log(`Downloaded and extracted to ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error(`Failed to download ${type} dump:`, error);
    throw error;
  }
}
