import { recreateIndices } from "./indices";

/**
 * Standalone script to recreate Elasticsearch indices
 * Use this after updating index mappings or analyzers
 */
async function main() {
  console.log("Recreating Elasticsearch indices with new mappings...");
  console.log("WARNING: This will delete existing indices and all indexed data.");
  console.log("(PostgreSQL data will remain intact)");
  console.log("");

  try {
    await recreateIndices();
    console.log("");
    console.log("✓ Indices recreated successfully!");
    console.log("");
    console.log("Next steps:");
    console.log("1. Run: bun import:all");
    console.log("   (This will re-import and re-index all data from PostgreSQL)");
    console.log("");
  } catch (error) {
    console.error("✗ Failed to recreate indices:", error);
    process.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
