import { db } from "../db";
import { importJobs, authors } from "../db/schema";
import { downloadDump } from "./download";
import { parseDump } from "./parse";
import { BatchInserter, upsertEditionsBatch } from "./batch";
import { eq, inArray } from "drizzle-orm";
import { createIndices } from "../elasticsearch/indices";
import { bulkIndexEditions, refreshIndices } from "../elasticsearch/indexing";
import { ProgressLogger } from "./progress";

export async function importEditions() {
  const jobId = crypto.randomUUID();

  console.log("");
  console.log("=".repeat(70));
  console.log(`Starting editions import (Job ID: ${jobId})`);
  console.log(
    `NOTE: This is the largest dump (~45GB uncompressed) and will take several hours.`
  );
  console.log("=".repeat(70));

  // Create import job
  await db.insert(importJobs).values({
    id: jobId,
    type: "editions",
    status: "running",
  });

  let recordsProcessed = 0;
  let recordsInserted = 0;

  try {
    // Ensure Elasticsearch indices exist
    console.log("\n>>> Ensuring Elasticsearch indices exist...");
    await createIndices();

    // Download dump
    console.log("\n>>> Downloading editions dump...");
    const filePath = await downloadDump("editions");

    // Initialize progress logger
    const progress = new ProgressLogger("Editions", 10000);
    progress.logPhase("Parsing and importing editions...");

    // Batch inserter (1000 records per batch)
    const inserter = new BatchInserter(1000, async (batch) => {
      const editionRecords = batch.map((record: any) => {
        // Extract work keys from works array
        const workKeys =
          record.json.works?.map((w: any) => {
            if (typeof w === "string") return w;
            if (w.key) return w.key;
            return null;
          }).filter((k: any) => k !== null) || [];

        // Extract author keys from authors array
        const authorKeys =
          record.json.authors?.map((a: any) => {
            if (typeof a === "string") return a;
            if (a.author?.key) return a.author.key;
            if (a.key) return a.key;
            return null;
          }).filter((k: any) => k !== null) || [];

        // Extract language keys
        const languages =
          record.json.languages?.map((l: any) => {
            if (typeof l === "string") return l;
            if (l.key) return l.key;
            return null;
          }).filter((k: any) => k !== null) || [];

        return {
          key: record.key,
          title: record.json.title || "Untitled",
          workKeys,
          authorKeys,
          isbn10: record.json.isbn_10 || [],
          isbn13: record.json.isbn_13 || [],
          publishers: record.json.publishers || [],
          publishDate: record.json.publish_date || null,
          numberOfPages: record.json.number_of_pages || null,
          covers: record.json.covers || [],
          languages,
          physicalFormat: record.json.physical_format || null,
          editionName: record.json.edition_name || null,
          rawData: record.json,
          lastImported: new Date(),
        };
      });

      // Insert into PostgreSQL
      await upsertEditionsBatch(editionRecords);

      // Resolve author names for Elasticsearch indexing
      const authorKeys = [
        ...new Set(editionRecords.flatMap((r) => r.authorKeys || [])),
      ];
      const authorsMap = new Map<string, string>();

      if (authorKeys.length > 0) {
        const authorRecords = await db
          .select({ key: authors.key, name: authors.name })
          .from(authors)
          .where(inArray(authors.key, authorKeys));

        authorRecords.forEach((a) => authorsMap.set(a.key, a.name));
      }

      // Prepare editions with resolved author names for Elasticsearch
      const editionsForES = editionRecords.map((edition) => ({
        ...edition,
        authors: (edition.authorKeys || []).map(
          (k) => authorsMap.get(k) || "Unknown"
        ),
      }));

      // Index into Elasticsearch
      await bulkIndexEditions(editionsForES);
    });

    // Parse and insert
    for await (const record of parseDump(filePath)) {
      if (record.type === "/type/edition") {
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
    console.error("Editions import failed:", error);

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
  await importEditions();
}
