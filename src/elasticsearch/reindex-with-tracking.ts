import { db } from "../db";
import { editions, authors, reindexJobs } from "../db/schema";
import { recreateIndices } from "./indices";
import { bulkIndexEditions, bulkIndexAuthors, refreshIndices } from "./indexing";
import { count, desc, eq } from "drizzle-orm";

/**
 * Re-index Elasticsearch from PostgreSQL with job tracking
 * Can be called from admin API or CLI
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
  const batchSize = 1000;
  let offset = 0;
  let totalIndexed = 0;

  // Get total count
  const countResult = await db.select({ count: count() }).from(editions);
  const totalEditions = Number(countResult[0].count);

  // Update job with total
  await db
    .update(reindexJobs)
    .set({ totalEditions })
    .where(eq(reindexJobs.id, jobId));

  console.log(`Total editions: ${totalEditions.toLocaleString()}`);

  const startTime = Date.now();

  while (true) {
    // Fetch batch
    const batch = await db.select().from(editions).limit(batchSize).offset(offset);

    if (batch.length === 0) break;

    // Index batch
    await bulkIndexEditions(batch);

    totalIndexed += batch.length;
    offset += batchSize;

    // Update job progress every batch
    await db
      .update(reindexJobs)
      .set({ editionsIndexed: totalIndexed })
      .where(eq(reindexJobs.id, jobId));

    const elapsed = (Date.now() - startTime) / 1000;
    const rate = totalIndexed / elapsed;
    const progress = ((totalIndexed / totalEditions) * 100).toFixed(1);

    console.log(
      `[Job ${jobId}] Editions: ${totalIndexed.toLocaleString()}/${totalEditions.toLocaleString()} (${progress}%) | Rate: ${Math.round(rate)}/sec`
    );
  }
}

async function reindexAuthors(jobId: string) {
  const batchSize = 1000;
  let offset = 0;
  let totalIndexed = 0;

  // Get total count
  const countResult = await db.select({ count: count() }).from(authors);
  const totalAuthors = Number(countResult[0].count);

  // Update job with total
  await db
    .update(reindexJobs)
    .set({ totalAuthors })
    .where(eq(reindexJobs.id, jobId));

  console.log(`Total authors: ${totalAuthors.toLocaleString()}`);

  const startTime = Date.now();

  while (true) {
    // Fetch batch
    const batch = await db.select().from(authors).limit(batchSize).offset(offset);

    if (batch.length === 0) break;

    // Index batch
    await bulkIndexAuthors(batch);

    totalIndexed += batch.length;
    offset += batchSize;

    // Update job progress every batch
    await db
      .update(reindexJobs)
      .set({ authorsIndexed: totalIndexed })
      .where(eq(reindexJobs.id, jobId));

    const elapsed = (Date.now() - startTime) / 1000;
    const rate = totalIndexed / elapsed;
    const progress = ((totalIndexed / totalAuthors) * 100).toFixed(1);

    console.log(
      `[Job ${jobId}] Authors: ${totalIndexed.toLocaleString()}/${totalAuthors.toLocaleString()} (${progress}%) | Rate: ${Math.round(rate)}/sec`
    );
  }
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
 * CLI entry point
 */
if (import.meta.main) {
  const jobId = crypto.randomUUID();
  await reindexWithTracking(jobId);
}
