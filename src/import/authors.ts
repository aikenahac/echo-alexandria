import { db } from "../db";
import { importJobs } from "../db/schema";
import { downloadDump } from "./download";
import { parseDump } from "./parse";
import { BatchInserter, upsertAuthorsBatch } from "./batch";
import { eq } from "drizzle-orm";
import { createIndices } from "../elasticsearch/indices";
import { bulkIndexAuthors, refreshIndices } from "../elasticsearch/indexing";
import { ProgressLogger } from "./progress";

export async function importAuthors() {
  const jobId = crypto.randomUUID();

  console.log("");
  console.log("=".repeat(70));
  console.log(`Starting authors import (Job ID: ${jobId})`);
  console.log("=".repeat(70));

  // Create import job
  await db.insert(importJobs).values({
    id: jobId,
    type: "authors",
    status: "running",
  });

  let recordsProcessed = 0;
  let recordsInserted = 0;

  try {
    // Ensure Elasticsearch indices exist
    console.log("\n>>> Ensuring Elasticsearch indices exist...");
    await createIndices();

    // Download dump
    console.log("\n>>> Downloading authors dump...");
    const filePath = await downloadDump("authors");

    // Initialize progress logger
    const progress = new ProgressLogger("Authors", 10000);
    progress.logPhase("Parsing and importing authors...");

    // Batch inserter (1000 records per batch)
    const inserter = new BatchInserter(1000, async (batch) => {
      const authorRecords = batch.map((record: any) => ({
        key: record.key,
        name: record.json.name || "Unknown Author",
        personalName: record.json.personal_name || null,
        birthDate: record.json.birth_date || null,
        deathDate: record.json.death_date || null,
        bio:
          typeof record.json.bio === "string"
            ? record.json.bio
            : record.json.bio?.value || null,
        alternateNames: record.json.alternate_names || [],
        photos: record.json.photos || [],
        rawData: record.json,
        lastImported: new Date(),
      }));

      // Insert into PostgreSQL
      await upsertAuthorsBatch(authorRecords);

      // Index into Elasticsearch
      await bulkIndexAuthors(authorRecords);
    });

    // Parse and insert
    for await (const record of parseDump(filePath)) {
      if (record.type === "/type/author") {
        await inserter.add(record);
        recordsProcessed++;

        // Log progress
        progress.log(recordsProcessed);

        if (recordsProcessed % 10000 === 0) {
          // Update progress in database
          await db
            .update(importJobs)
            .set({ recordsProcessed })
            .where(eq(importJobs.id, jobId));
        }
      }
    }

    await inserter.flush();
    recordsInserted = inserter.getTotalInserted();

    // Refresh Elasticsearch indices to make searchable
    progress.logPhase("Refreshing Elasticsearch indices...");
    await refreshIndices();

    // Mark job complete
    await db
      .update(importJobs)
      .set({
        status: "completed",
        recordsProcessed,
        recordsInserted,
        completedAt: new Date(),
      })
      .where(eq(importJobs.id, jobId));

    // Log final summary
    progress.logComplete(recordsProcessed, recordsInserted);

    return { success: true, jobId, recordsProcessed, recordsInserted };
  } catch (error) {
    console.error("Authors import failed:", error);

    await db
      .update(importJobs)
      .set({
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        completedAt: new Date(),
      })
      .where(eq(importJobs.id, jobId));

    throw error;
  }
}

// Run if called directly
if (import.meta.main) {
  await importAuthors();
}
