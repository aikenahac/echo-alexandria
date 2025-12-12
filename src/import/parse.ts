import { createReadStream } from "fs";
import { createInterface } from "readline";

export interface DumpRecord {
  type: string;
  key: string;
  revision: number;
  lastModified: string;
  json: any;
}

/**
 * Parse OpenLibrary dump file format (tab-separated with JSON)
 * Format: type\tkey\trevision\tlast_modified\tjson_data
 */
export async function* parseDump(
  filePath: string
): AsyncGenerator<DumpRecord> {
  const stream = createReadStream(filePath);
  const rl = createInterface({ input: stream });

  let lineNumber = 0;
  let skippedLines = 0;

  for await (const line of rl) {
    lineNumber++;

    // Skip empty lines
    if (!line.trim()) {
      continue;
    }

    const parts = line.split("\t");

    // OpenLibrary dumps should have exactly 5 columns
    if (parts.length < 5) {
      skippedLines++;
      if (skippedLines % 1000 === 0) {
        console.log(`Skipped ${skippedLines} malformed lines so far...`);
      }
      continue;
    }

    const [type, key, revision, lastModified, jsonStr] = parts;

    try {
      const json = JSON.parse(jsonStr);
      yield {
        type,
        key,
        revision: parseInt(revision, 10),
        lastModified,
        json,
      };
    } catch (error) {
      skippedLines++;
      if (skippedLines % 1000 === 0) {
        console.error(
          `Parse error at line ${lineNumber} for key ${key}:`,
          error
        );
      }
      continue;
    }

    // Progress logging every 10000 lines
    if (lineNumber % 10000 === 0) {
      console.log(`Processed ${lineNumber} lines...`);
    }
  }

  console.log(`Parsing complete. Total lines: ${lineNumber}, Skipped: ${skippedLines}`);
}
