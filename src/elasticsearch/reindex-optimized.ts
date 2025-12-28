import { db } from "../db";
import { editions, authors, reindexJobs } from "../db/schema";
import { recreateIndices } from "./indices";
import { bulkIndexEditions, bulkIndexAuthors, refreshIndices } from "./indexing";
import { count, desc, eq, gt, inArray } from "drizzle-orm";

/**
 * Optimized re-index with cursor-based pagination and reduced DB writes
 * Target: 5,000-10,000 editions/sec
 */

export async function reindexWithTracking(jobId: string) {
  try {
    // Create job record
    await db.insert(reindexJobs).values({
      id: jobId,
      type: "full",
      status: "running",
      currentPhase: "recreating_indices",
    });

    console.log(`[Job ${jobId}] Starting re-index...`);

    // Step 1: Recreate indices
    console.log(`[Job ${jobId}] Recreating indices...`);
    await recreateIndices();

    // Step 2: Re-index authors
    await db
      .update(reindexJobs)
      .set({ currentPhase: "indexing_authors" })
      .where(eq(reindexJobs.id, jobId));

    console.log(`[Job ${jobId}] Re-indexing authors...`);
    await reindexAuthors(jobId);

    // Step 3: Re-index editions
    await db
      .update(reindexJobs)
      .set({ currentPhase: "indexing_editions" })
      .where(eq(reindexJobs.id, jobId));

    console.log(`[Job ${jobId}] Re-indexing editions...`);
    await reindexEditions(jobId);

    // Step 4: Refresh indices
    await db
      .update(reindexJobs)
      .set({ currentPhase: "refreshing" })
      .where(eq(reindexJobs.id, jobId));

    console.log(`[Job ${jobId}] Refreshing indices...`);
    await refreshIndices();

    // Mark as completed
    await db
      .update(reindexJobs)
      .set({
        status: "completed",
        currentPhase: null,
        completedAt: new Date(),
      })
      .where(eq(reindexJobs.id, jobId));

    console.log(`[Job ${jobId}] Re-index completed!`);
  } catch (error) {
    // Mark as failed
    await db
      .update(reindexJobs)
      .set({
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        completedAt: new Date(),
      })
      .where(eq(reindexJobs.id, jobId));

    console.error(`[Job ${jobId}] Re-index failed:`, error);
    throw error;
  }
}

async function reindexEditions(jobId: string) {
  // OPTIMIZATION 1: Larger batch size (10x increase)
  const batchSize = 10000;

  // OPTIMIZATION 2: Update DB every 10 batches instead of every batch
  const progressUpdateInterval = 10;
  let batchesSinceLastUpdate = 0;

  let totalIndexed = 0;
  let lastKey = "";

  // Get total count
  const countResult = await db.select({ count: count() }).from(editions);
  const totalEditions = Number(countResult[0]?.count ?? 0);

  // Update job with total
  await db
    .update(reindexJobs)
    .set({ totalEditions })
    .where(eq(reindexJobs.id, jobId));

  console.log(`Total editions: ${totalEditions.toLocaleString()}`);

  const startTime = Date.now();
  let lastLogTime = startTime;

  while (true) {
    // OPTIMIZATION 3: Cursor-based pagination (much faster than OFFSET)
    // Fetch batch using WHERE key > lastKey instead of OFFSET
    const batch = lastKey
      ? await db
          .select()
          .from(editions)
          .where(gt(editions.key, lastKey))
          .orderBy(editions.key)
          .limit(batchSize)
      : await db
          .select()
          .from(editions)
          .orderBy(editions.key)
          .limit(batchSize);

    if (batch.length === 0) break;

    // CRITICAL FIX: Resolve author names before indexing (same as import process)
    // Extract all unique author keys from this batch
    const authorKeys = [
      ...new Set(batch.flatMap((edition) => edition.authorKeys || [])),
    ];

    // Build a map of author key -> author name
    const authorsMap = new Map<string, string>();

    if (authorKeys.length > 0) {
      const authorRecords = await db
        .select({ key: authors.key, name: authors.name })
        .from(authors)
        .where(inArray(authors.key, authorKeys));

      authorRecords.forEach((a) => authorsMap.set(a.key, a.name));
    }

    // Prepare editions with resolved author names for Elasticsearch
    const editionsForES = batch.map((edition) => ({
      ...edition,
      authors: (edition.authorKeys || []).map(
        (k) => authorsMap.get(k) || "Unknown"
      ),
    }));

    // Index batch to Elasticsearch with resolved author names
    await bulkIndexEditions(editionsForES);

    // Update last key for cursor pagination
    const lastBatch = batch[batch.length - 1];
    if (!lastBatch) break; // Safety check
    lastKey = lastBatch.key;

    totalIndexed += batch.length;
    batchesSinceLastUpdate++;

    // OPTIMIZATION 4: Only update DB every N batches
    if (batchesSinceLastUpdate >= progressUpdateInterval) {
      await db
        .update(reindexJobs)
        .set({ editionsIndexed: totalIndexed })
        .where(eq(reindexJobs.id, jobId));

      batchesSinceLastUpdate = 0;
    }

    // Log progress every 10 seconds
    const now = Date.now();
    if (now - lastLogTime > 10000) {
      const elapsed = (now - startTime) / 1000;
      const rate = totalIndexed / elapsed;
      const remaining = (totalEditions - totalIndexed) / rate;
      const progress = ((totalIndexed / totalEditions) * 100).toFixed(1);

      console.log(
        `[Job ${jobId}] Editions: ${totalIndexed.toLocaleString()}/${totalEditions.toLocaleString()} (${progress}%) | ` +
          `Rate: ${Math.round(rate)}/sec | ` +
          `ETA: ${Math.round(remaining / 60)} min`
      );

      lastLogTime = now;
    }
  }

  // Final update
  await db
    .update(reindexJobs)
    .set({ editionsIndexed: totalIndexed })
    .where(eq(reindexJobs.id, jobId));

  const elapsed = (Date.now() - startTime) / 1000;
  console.log(
    `✓ Indexed ${totalIndexed.toLocaleString()} editions in ${Math.round(elapsed / 60)} minutes`
  );
}

async function reindexAuthors(jobId: string) {
  // Use same optimizations for authors
  const batchSize = 10000;
  const progressUpdateInterval = 10;
  let batchesSinceLastUpdate = 0;

  let totalIndexed = 0;
  let lastKey = "";

  // Get total count
  const countResult = await db.select({ count: count() }).from(authors);
  const totalAuthors = Number(countResult[0]?.count ?? 0);

  // Update job with total
  await db
    .update(reindexJobs)
    .set({ totalAuthors })
    .where(eq(reindexJobs.id, jobId));

  console.log(`Total authors: ${totalAuthors.toLocaleString()}`);

  const startTime = Date.now();
  let lastLogTime = startTime;

  while (true) {
    // Cursor-based pagination
    const batch = lastKey
      ? await db
          .select()
          .from(authors)
          .where(gt(authors.key, lastKey))
          .orderBy(authors.key)
          .limit(batchSize)
      : await db
          .select()
          .from(authors)
          .orderBy(authors.key)
          .limit(batchSize);

    if (batch.length === 0) break;

    // Index batch
    await bulkIndexAuthors(batch);

    const lastBatch = batch[batch.length - 1];
    if (!lastBatch) break; // Safety check
    lastKey = lastBatch.key;
    totalIndexed += batch.length;
    batchesSinceLastUpdate++;

    // Update DB every N batches
    if (batchesSinceLastUpdate >= progressUpdateInterval) {
      await db
        .update(reindexJobs)
        .set({ authorsIndexed: totalIndexed })
        .where(eq(reindexJobs.id, jobId));

      batchesSinceLastUpdate = 0;
    }

    // Log progress every 10 seconds
    const now = Date.now();
    if (now - lastLogTime > 10000) {
      const elapsed = (now - startTime) / 1000;
      const rate = totalIndexed / elapsed;
      const remaining = (totalAuthors - totalIndexed) / rate;
      const progress = ((totalIndexed / totalAuthors) * 100).toFixed(1);

      console.log(
        `[Job ${jobId}] Authors: ${totalIndexed.toLocaleString()}/${totalAuthors.toLocaleString()} (${progress}%) | ` +
          `Rate: ${Math.round(rate)}/sec | ` +
          `ETA: ${Math.round(remaining / 60)} min`
      );

      lastLogTime = now;
    }
  }

  // Final update
  await db
    .update(reindexJobs)
    .set({ authorsIndexed: totalIndexed })
    .where(eq(reindexJobs.id, jobId));

  const elapsed = (Date.now() - startTime) / 1000;
  console.log(
    `✓ Indexed ${totalAuthors.toLocaleString()} authors in ${Math.round(elapsed / 60)} minutes`
  );
}

/**
 * Get status of a reindex job
 */
export async function getReindexJobStatus(jobId: string) {
  const job = await db
    .select()
    .from(reindexJobs)
    .where(eq(reindexJobs.id, jobId))
    .limit(1);

  return job[0] || null;
}

/**
 * Get latest reindex job
 */
export async function getLatestReindexJob() {
  const jobs = await db
    .select()
    .from(reindexJobs)
    .orderBy(desc(reindexJobs.startedAt))
    .limit(1);

  return jobs[0] || null;
}

/**
 * Reindex only authors
 */
export async function reindexAuthorsOnly(jobId: string) {
  try {
    await db.insert(reindexJobs).values({
      id: jobId,
      type: "authors",
      status: "running",
      currentPhase: "indexing_authors",
    });

    console.log(`[Job ${jobId}] Starting authors reindex...`);
    await reindexAuthors(jobId);

    await db
      .update(reindexJobs)
      .set({
        status: "completed",
        currentPhase: null,
        completedAt: new Date(),
      })
      .where(eq(reindexJobs.id, jobId));

    console.log(`[Job ${jobId}] Authors reindex completed!`);
  } catch (error) {
    await db
      .update(reindexJobs)
      .set({
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        completedAt: new Date(),
      })
      .where(eq(reindexJobs.id, jobId));

    console.error(`[Job ${jobId}] Authors reindex failed:`, error);
    throw error;
  }
}

/**
 * Reindex only editions
 */
export async function reindexEditionsOnly(jobId: string) {
  try {
    await db.insert(reindexJobs).values({
      id: jobId,
      type: "editions",
      status: "running",
      currentPhase: "indexing_editions",
    });

    console.log(`[Job ${jobId}] Starting editions reindex...`);
    await reindexEditions(jobId);

    await db
      .update(reindexJobs)
      .set({
        status: "completed",
        currentPhase: null,
        completedAt: new Date(),
      })
      .where(eq(reindexJobs.id, jobId));

    console.log(`[Job ${jobId}] Editions reindex completed!`);
  } catch (error) {
    await db
      .update(reindexJobs)
      .set({
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        completedAt: new Date(),
      })
      .where(eq(reindexJobs.id, jobId));

    console.error(`[Job ${jobId}] Editions reindex failed:`, error);
    throw error;
  }
}

/**
 * CLI entry point
 */
if (import.meta.main) {
  const jobId = crypto.randomUUID();
  await reindexWithTracking(jobId);
}
