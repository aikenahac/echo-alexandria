import { db } from "../db";
import { importJobs } from "../db/schema";
import { downloadDump } from "./download";
import { parseDump } from "./parse";
import { BatchInserter, upsertWorksBatch } from "./batch";
import { eq } from "drizzle-orm";

export async function importWorks() {
  const jobId = crypto.randomUUID();

  console.log(`Starting works import (Job ID: ${jobId})`);

  // Create import job
  await db.insert(importJobs).values({
    id: jobId,
    type: "works",
    status: "running",
  });

  let recordsProcessed = 0;
  let recordsInserted = 0;

  try {
    // Download dump
    console.log("Downloading works dump...");
    const filePath = await downloadDump("works");

    console.log("Parsing and importing works...");

    // Batch inserter (1000 records per batch)
    const inserter = new BatchInserter(1000, async (batch) => {
      const workRecords = batch.map((record: any) => {
        // Extract author keys from authors array
        const authorKeys =
          record.json.authors?.map((a: any) => {
            if (typeof a === "string") return a;
            if (a.author?.key) return a.author.key;
            if (a.key) return a.key;
            return null;
          }).filter((k: any) => k !== null) || [];

        return {
          key: record.key,
          title: record.json.title || "Untitled",
          description:
            typeof record.json.description === "string"
              ? record.json.description
              : record.json.description?.value || null,
          subjects: record.json.subjects || [],
          authorKeys,
          firstPublishDate: record.json.first_publish_date || null,
          covers: record.json.covers || [],
          rawData: record.json,
          lastImported: new Date(),
        };
      });

      await upsertWorksBatch(workRecords);
    });

    // Parse and insert
    for await (const record of parseDump(filePath)) {
      if (record.type === "/type/work") {
        await inserter.add(record);
        recordsProcessed++;

        if (recordsProcessed % 10000 === 0) {
          console.log(`Processed ${recordsProcessed} works...`);
          // Update progress
          await db
            .update(importJobs)
            .set({ recordsProcessed })
            .where(eq(importJobs.id, jobId));
        }
      }
    }

    await inserter.flush();
    recordsInserted = inserter.getTotalInserted();

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

    console.log(`Works import complete!`);
    console.log(`- Processed: ${recordsProcessed}`);
    console.log(`- Inserted/Updated: ${recordsInserted}`);

    return { success: true, jobId, recordsProcessed, recordsInserted };
  } catch (error) {
    console.error("Works import failed:", error);

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
  await importWorks();
}
