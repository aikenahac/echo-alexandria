import { db } from "../db";
import { works, editions } from "../db/schema";
import { bulkIndexWorks } from "./indexing";
import {
  selectCanonicalEdition,
  resolveAuthorNames,
  computeWorkQualityScore,
} from "./work-indexing";
import { count, sql } from "drizzle-orm";

/**
 * Reindex all works with their canonical editions
 * This script processes works in batches and selects the best edition for each work
 */
export async function reindexWorks() {
  console.log("Starting works reindex...");
  console.log("");

  const batchSize = 1000; // Process 1000 works at a time
  const progressInterval = 10000; // Log progress every 10k works

  let totalIndexed = 0;
  let totalSkipped = 0;
  let offset = 0;

  // Get total count
  const countResult = await db.select({ count: count() }).from(works);
  const totalWorks = Number(countResult[0]?.count ?? 0);

  console.log(`Total works to process: ${totalWorks.toLocaleString()}`);
  console.log("");

  const startTime = Date.now();
  let lastLogTime = startTime;

  while (true) {
    // Fetch batch of works
    const worksBatch = await db.select().from(works).limit(batchSize).offset(offset);

    if (worksBatch.length === 0) {
      break;
    }

    // Process each work in the batch
    const workDocuments = [];

    for (const work of worksBatch) {
      try {
        // Select canonical edition for this work
        const canonicalEdition = await selectCanonicalEdition(work.key);

        if (!canonicalEdition) {
          // Skip works with no editions (orphaned works)
          totalSkipped++;
          continue;
        }

        // Resolve author names from authorKeys
        const authors = await resolveAuthorNames(work.authorKeys || []);

        // Get all editions for edition count
        const editionsForWork = await db
          .select({ key: editions.key })
          .from(editions)
          .where(sql`${editions.workKeys} @> ARRAY[${work.key}]::text[]`);

        // Compute quality indicators
        const knownAuthors = authors.filter((a) => a && a !== "Unknown");
        const hasKnownAuthors = knownAuthors.length > 0;
        const isEnglish = (canonicalEdition.languages || []).some((lang: string) =>
          lang.includes("/languages/eng")
        );
        const hasCover = (canonicalEdition.covers?.length || 0) > 0;
        const hasDescription = !!work.description;
        const hasIsbn =
          ((canonicalEdition.isbn10?.length || 0) +
            (canonicalEdition.isbn13?.length || 0)) >
          0;

        // Compute work quality score
        const qualityScore = computeWorkQualityScore(
          work,
          canonicalEdition,
          authors
        );

        // Create work document for indexing
        const workDocument = {
          key: work.key,
          title: work.title,
          description: work.description,
          subjects: work.subjects || [],
          authorKeys: work.authorKeys || [],
          authors: authors,
          firstPublishDate: work.firstPublishDate,

          // Canonical edition fields (denormalized)
          canonicalEditionKey: canonicalEdition.key,
          canonicalEditionTitle: canonicalEdition.title,
          covers: canonicalEdition.covers || [],
          isbn10: canonicalEdition.isbn10 || [],
          isbn13: canonicalEdition.isbn13 || [],
          publishers: canonicalEdition.publishers || [],
          publishDate: canonicalEdition.publishDate,
          numberOfPages: canonicalEdition.numberOfPages,
          languages: canonicalEdition.languages || [],
          physicalFormat: canonicalEdition.physicalFormat,

          // Aggregate metadata
          editionCount: editionsForWork.length,
          editionKeys: editionsForWork.map((e) => e.key),

          // Quality scoring fields
          hasKnownAuthors,
          isEnglish,
          hasCover,
          hasDescription,
          hasIsbn,
          qualityScore,
        };

        workDocuments.push(workDocument);
      } catch (error) {
        console.error(`Error processing work ${work.key}:`, error);
        totalSkipped++;
      }
    }

    // Bulk index this batch
    if (workDocuments.length > 0) {
      await bulkIndexWorks(workDocuments);
      totalIndexed += workDocuments.length;
    }

    offset += batchSize;

    // Log progress
    const now = Date.now();
    if (
      (totalIndexed + totalSkipped) % progressInterval === 0 ||
      now - lastLogTime > 10000
    ) {
      const processed = totalIndexed + totalSkipped;
      const elapsed = (now - startTime) / 1000;
      const rate = processed / elapsed;
      const remaining = (totalWorks - processed) / rate;
      const progress = ((processed / totalWorks) * 100).toFixed(1);

      console.log(
        `Progress: ${processed.toLocaleString()}/${totalWorks.toLocaleString()} (${progress}%) | ` +
          `Indexed: ${totalIndexed.toLocaleString()} | ` +
          `Skipped: ${totalSkipped.toLocaleString()} | ` +
          `Rate: ${Math.round(rate)}/sec | ` +
          `ETA: ${Math.round(remaining / 60)} min`
      );

      lastLogTime = now;
    }
  }

  const elapsed = (Date.now() - startTime) / 1000;

  console.log("");
  console.log("=".repeat(70));
  console.log("Works reindex completed!");
  console.log(`✓ Indexed: ${totalIndexed.toLocaleString()} works`);
  console.log(`✗ Skipped: ${totalSkipped.toLocaleString()} works (no editions)`);
  console.log(`⏱  Time: ${Math.round(elapsed / 60)} minutes`);
  console.log(
    `⚡ Rate: ${Math.round((totalIndexed + totalSkipped) / elapsed)}/sec`
  );
  console.log("=".repeat(70));
  console.log("");
}

/**
 * CLI entry point
 */
if (import.meta.main) {
  await reindexWorks();
}
