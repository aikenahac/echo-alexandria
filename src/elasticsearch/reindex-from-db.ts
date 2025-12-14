import { db } from "../db";
import { editions, authors } from "../db/schema";
import { recreateIndices } from "./indices";
import { bulkIndexEditions, bulkIndexAuthors, refreshIndices } from "./indexing";
import { count } from "drizzle-orm";

/**
 * Re-index Elasticsearch from existing PostgreSQL data
 * Use this after updating index mappings to avoid re-importing from OpenLibrary dumps
 */

async function reindexEditions() {
  console.log("\n>>> Re-indexing editions from PostgreSQL...");

  const batchSize = 1000;
  let offset = 0;
  let totalIndexed = 0;

  // Get total count
  const countResult = await db.select({ count: count() }).from(editions);
  const totalEditions = Number(countResult[0].count);
  console.log(`Total editions in database: ${totalEditions.toLocaleString()}`);

  const startTime = Date.now();
  let lastLogTime = startTime;

  while (true) {
    // Fetch batch of editions
    const batch = await db
      .select()
      .from(editions)
      .limit(batchSize)
      .offset(offset);

    if (batch.length === 0) break;

    // Index batch to Elasticsearch
    await bulkIndexEditions(batch);

    totalIndexed += batch.length;
    offset += batchSize;

    // Log progress every 10 seconds
    const now = Date.now();
    if (now - lastLogTime > 10000) {
      const elapsed = (now - startTime) / 1000;
      const rate = totalIndexed / elapsed;
      const remaining = (totalEditions - totalIndexed) / rate;
      const progress = ((totalIndexed / totalEditions) * 100).toFixed(1);

      console.log(
        `Progress: ${totalIndexed.toLocaleString()}/${totalEditions.toLocaleString()} (${progress}%) | ` +
          `Rate: ${Math.round(rate)}/sec | ` +
          `ETA: ${Math.round(remaining / 60)} min`
      );

      lastLogTime = now;
    }
  }

  const elapsed = (Date.now() - startTime) / 1000;
  console.log(
    `✓ Indexed ${totalIndexed.toLocaleString()} editions in ${Math.round(elapsed / 60)} minutes`
  );
}

async function reindexAuthors() {
  console.log("\n>>> Re-indexing authors from PostgreSQL...");

  const batchSize = 1000;
  let offset = 0;
  let totalIndexed = 0;

  // Get total count
  const countResult = await db.select({ count: count() }).from(authors);
  const totalAuthors = Number(countResult[0].count);
  console.log(`Total authors in database: ${totalAuthors.toLocaleString()}`);

  const startTime = Date.now();
  let lastLogTime = startTime;

  while (true) {
    // Fetch batch of authors
    const batch = await db
      .select()
      .from(authors)
      .limit(batchSize)
      .offset(offset);

    if (batch.length === 0) break;

    // Index batch to Elasticsearch
    await bulkIndexAuthors(batch);

    totalIndexed += batch.length;
    offset += batchSize;

    // Log progress every 10 seconds
    const now = Date.now();
    if (now - lastLogTime > 10000) {
      const elapsed = (now - startTime) / 1000;
      const rate = totalIndexed / elapsed;
      const remaining = (totalAuthors - totalIndexed) / rate;
      const progress = ((totalIndexed / totalAuthors) * 100).toFixed(1);

      console.log(
        `Progress: ${totalIndexed.toLocaleString()}/${totalAuthors.toLocaleString()} (${progress}%) | ` +
          `Rate: ${Math.round(rate)}/sec | ` +
          `ETA: ${Math.round(remaining / 60)} min`
      );

      lastLogTime = now;
    }
  }

  const elapsed = (Date.now() - startTime) / 1000;
  console.log(
    `✓ Indexed ${totalAuthors.toLocaleString()} authors in ${Math.round(elapsed / 60)} minutes`
  );
}

async function main() {
  console.log("=".repeat(70));
  console.log("Re-indexing Elasticsearch from PostgreSQL");
  console.log("=".repeat(70));
  console.log("");
  console.log("This will:");
  console.log("1. Recreate Elasticsearch indices with new mappings");
  console.log("2. Re-index all data from PostgreSQL (no dump downloads needed)");
  console.log("3. Compute quality fields for all editions");
  console.log("");

  const startTime = Date.now();

  try {
    // Step 1: Recreate indices with new mappings
    console.log("\n>>> Step 1/4: Recreating Elasticsearch indices...");
    await recreateIndices();

    // Step 2: Re-index authors
    console.log("\n>>> Step 2/4: Re-indexing authors...");
    await reindexAuthors();

    // Step 3: Re-index editions
    console.log("\n>>> Step 3/4: Re-indexing editions...");
    await reindexEditions();

    // Step 4: Refresh indices
    console.log("\n>>> Step 4/4: Refreshing indices...");
    await refreshIndices();

    const totalTime = Math.round((Date.now() - startTime) / 1000 / 60);

    console.log("");
    console.log("=".repeat(70));
    console.log(`✓ Re-indexing complete! Total time: ${totalTime} minutes`);
    console.log("=".repeat(70));
    console.log("");
    console.log("Next steps:");
    console.log("1. Test search: bun src/elasticsearch/test-search.ts");
    console.log("2. Start API server: bun dev");
    console.log("3. Test queries: curl 'http://localhost:3000/api/search/editions?q=harry+potter'");
    console.log("");
  } catch (error) {
    console.error("\n✗ Re-indexing failed:", error);
    process.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
