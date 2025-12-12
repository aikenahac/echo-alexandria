import { importAuthors } from "../import/authors";
import { importWorks } from "../import/works";
import { importEditions } from "../import/editions";

/**
 * Monthly refresh orchestrator
 * Import order: Authors → Works → Editions
 * (Authors must exist before Works reference them)
 */
export async function refreshAll() {
  console.log("=".repeat(60));
  console.log("Starting monthly OpenLibrary data refresh");
  console.log("=".repeat(60));

  const startTime = Date.now();

  try {
    // Step 1: Import Authors
    console.log("\n[1/3] Importing authors...");
    await importAuthors();

    // Step 2: Import Works
    console.log("\n[2/3] Importing works...");
    await importWorks();

    // Step 3: Import Editions
    console.log("\n[3/3] Importing editions...");
    await importEditions();

    const duration = Math.round((Date.now() - startTime) / 1000 / 60);
    console.log("\n" + "=".repeat(60));
    console.log(`✓ Monthly refresh complete! Total time: ${duration} minutes`);
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\n✗ Monthly refresh failed:", error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.main) {
  await refreshAll();
}
