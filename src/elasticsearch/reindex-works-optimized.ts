import { db } from "../db";
import { works, editions, authors } from "../db/schema";
import { bulkIndexWorks } from "./indexing";
import { computeEditionSelectionScore, computeWorkQualityScore } from "./work-indexing";
import { count, sql, inArray, gt } from "drizzle-orm";

/**
 * ULTRA-OPTIMIZED works reindex
 * Key optimizations:
 * 1. Cursor-based pagination (not offset)
 * 2. Batch fetch ALL editions for ALL works in batch (1 query instead of N)
 * 3. Batch fetch ALL authors needed (1 query instead of N)
 * 4. In-memory canonical selection (no extra queries)
 * 5. Larger batches (10k works)
 */
export async function reindexWorks() {
  console.log("Starting OPTIMIZED works reindex...");
  console.log("");

  const batchSize = 10000; // 10x larger batches
  const progressInterval = 50000;

  let totalIndexed = 0;
  let totalSkipped = 0;
  let lastKey = "";

  // Get total count
  const countResult = await db.select({ count: count() }).from(works);
  const totalWorks = Number(countResult[0]?.count ?? 0);

  console.log(`Total works to process: ${totalWorks.toLocaleString()}`);
  console.log("");

  const startTime = Date.now();
  let lastLogTime = startTime;

  // Global author cache (persists across batches)
  const authorCache = new Map<string, string>();

  while (true) {
    // Cursor-based pagination (MUCH faster than offset)
    const worksBatch = lastKey
      ? await db
          .select()
          .from(works)
          .where(gt(works.key, lastKey))
          .orderBy(works.key)
          .limit(batchSize)
      : await db
          .select()
          .from(works)
          .orderBy(works.key)
          .limit(batchSize);

    if (worksBatch.length === 0) break;

    // Extract all work keys in this batch
    const workKeys = worksBatch.map((w) => w.key);

    // **OPTIMIZATION 1**: Fetch ALL editions for ALL works in ONE query
    const allEditions = await db
      .select()
      .from(editions)
      .where(sql`${editions.workKeys} && ARRAY[${sql.join(workKeys.map(k => sql`${k}`), sql`, `)}]::text[]`);

    // Group editions by work (in-memory)
    const editionsByWork = new Map<string, any[]>();
    for (const edition of allEditions) {
      for (const workKey of edition.workKeys || []) {
        if (workKeys.includes(workKey)) {
          if (!editionsByWork.has(workKey)) {
            editionsByWork.set(workKey, []);
          }
          editionsByWork.get(workKey)!.push(edition);
        }
      }
    }

    // **OPTIMIZATION 2**: Collect ALL unique author keys needed for this batch
    const allAuthorKeys = new Set<string>();
    for (const work of worksBatch) {
      for (const authorKey of work.authorKeys || []) {
        if (!authorCache.has(authorKey)) {
          allAuthorKeys.add(authorKey);
        }
      }
    }
    for (const edition of allEditions) {
      for (const authorKey of edition.authorKeys || []) {
        if (!authorCache.has(authorKey)) {
          allAuthorKeys.add(authorKey);
        }
      }
    }

    // Fetch all authors in ONE query
    if (allAuthorKeys.size > 0) {
      const authorRecords = await db
        .select({ key: authors.key, name: authors.name })
        .from(authors)
        .where(inArray(authors.key, Array.from(allAuthorKeys)));

      for (const author of authorRecords) {
        authorCache.set(author.key, author.name);
      }
    }

    // Process works in-memory
    const workDocuments = [];

    for (const work of worksBatch) {
      try {
        const workEditions = editionsByWork.get(work.key) || [];

        if (workEditions.length === 0) {
          totalSkipped++;
          continue;
        }

        // **OPTIMIZATION 3**: In-memory canonical selection (no DB queries)
        // Resolve authors for all editions
        const editionsWithAuthors = workEditions.map((edition) => ({
          ...edition,
          authors: (edition.authorKeys || []).map(
            (k: string) => authorCache.get(k) || "Unknown"
          ),
        }));

        // Score and select best edition
        const scoredEditions = editionsWithAuthors.map((edition) => ({
          edition,
          score: computeEditionSelectionScore(edition),
        }));

        scoredEditions.sort((a, b) => {
          if (Math.abs(a.score - b.score) > 0.01) {
            return b.score - a.score;
          }
          // Prefer more recent
          const yearA = extractYear(a.edition.publishDate);
          const yearB = extractYear(b.edition.publishDate);
          if (yearA !== null && yearB !== null) {
            return yearB - yearA;
          }
          return 0;
        });

        const canonicalEdition = scoredEditions[0]?.edition;
        if (!canonicalEdition) {
          totalSkipped++;
          continue;
        }

        // Resolve work authors
        const workAuthors = (work.authorKeys || []).map(
          (k) => authorCache.get(k) || "Unknown"
        );

        // Compute quality indicators
        const knownAuthors = workAuthors.filter((a) => a && a !== "Unknown");
        const hasKnownAuthors = knownAuthors.length > 0;
        const isEnglish = (canonicalEdition.languages || []).some((lang: string) =>
          lang.includes("/languages/eng")
        );
        const hasCover = (canonicalEdition.covers?.length || 0) > 0;
        const hasDescription = !!work.description;
        const hasIsbn =
          ((canonicalEdition.isbn10?.length || 0) +
            (canonicalEdition.isbn13?.length || 0)) > 0;

        const qualityScore = computeWorkQualityScore(
          work,
          canonicalEdition,
          workAuthors
        );

        workDocuments.push({
          key: work.key,
          title: work.title,
          description: work.description,
          subjects: work.subjects || [],
          authorKeys: work.authorKeys || [],
          authors: workAuthors,
          firstPublishDate: work.firstPublishDate,

          // Canonical edition
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

          // Metadata
          editionCount: workEditions.length,
          editionKeys: workEditions.map((e) => e.key),

          // Quality
          hasKnownAuthors,
          isEnglish,
          hasCover,
          hasDescription,
          hasIsbn,
          qualityScore,
        });
      } catch (error) {
        console.error(`Error processing work ${work.key}:`, error);
        totalSkipped++;
      }
    }

    // Bulk index
    if (workDocuments.length > 0) {
      await bulkIndexWorks(workDocuments);
      totalIndexed += workDocuments.length;
    }

    // Update cursor
    const lastWork = worksBatch[worksBatch.length - 1];
    if (!lastWork) break; // Safety check
    lastKey = lastWork.key;

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
          `Cache: ${authorCache.size.toLocaleString()} authors | ` +
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
  console.log(`⚡ Rate: ${Math.round((totalIndexed + totalSkipped) / elapsed)}/sec`);
  console.log(`📦 Author cache size: ${authorCache.size.toLocaleString()}`);
  console.log("=".repeat(70));
  console.log("");
}

function extractYear(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const match = dateStr.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0]) : null;
}

if (import.meta.main) {
  await reindexWorks();
}
