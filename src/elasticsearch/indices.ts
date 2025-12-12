import { es } from "./client";

export const INDICES = {
  EDITIONS: "editions",
  AUTHORS: "authors",
};

/**
 * Create Elasticsearch indices with appropriate mappings
 */
export async function createIndices() {
  console.log("Creating Elasticsearch indices...");

  // Create editions index
  const editionsExists = await es.indices.exists({ index: INDICES.EDITIONS });
  if (!editionsExists) {
    await es.indices.create({
      index: INDICES.EDITIONS,
      body: {
        settings: {
          number_of_shards: 1,
          number_of_replicas: 0,
          analysis: {
            analyzer: {
              title_analyzer: {
                type: "custom",
                tokenizer: "standard",
                filter: ["lowercase", "asciifolding"],
              },
            },
          },
        },
        mappings: {
          properties: {
            key: { type: "keyword" },
            title: {
              type: "text",
              analyzer: "title_analyzer",
              fields: {
                keyword: { type: "keyword" },
                exact: {
                  type: "text",
                  analyzer: "standard",
                },
              },
            },
            workKeys: { type: "keyword" },
            authorKeys: { type: "keyword" },
            authors: {
              type: "text",
              fields: {
                keyword: { type: "keyword" },
              },
            },
            isbn10: { type: "keyword" },
            isbn13: { type: "keyword" },
            publishers: { type: "keyword" },
            publishDate: { type: "keyword" },
            numberOfPages: { type: "integer" },
            covers: { type: "integer" },
            languages: { type: "keyword" },
            physicalFormat: { type: "keyword" },
            editionName: { type: "text" },
          },
        },
      },
    });
    console.log("Created editions index");
  } else {
    console.log("Editions index already exists");
  }

  // Create authors index
  const authorsExists = await es.indices.exists({ index: INDICES.AUTHORS });
  if (!authorsExists) {
    await es.indices.create({
      index: INDICES.AUTHORS,
      body: {
        settings: {
          number_of_shards: 1,
          number_of_replicas: 0,
          analysis: {
            analyzer: {
              name_analyzer: {
                type: "custom",
                tokenizer: "standard",
                filter: ["lowercase", "asciifolding"],
              },
            },
          },
        },
        mappings: {
          properties: {
            key: { type: "keyword" },
            name: {
              type: "text",
              analyzer: "name_analyzer",
              fields: {
                keyword: { type: "keyword" },
                exact: {
                  type: "text",
                  analyzer: "standard",
                },
              },
            },
            personalName: { type: "text" },
            birthDate: { type: "keyword" },
            deathDate: { type: "keyword" },
            bio: { type: "text" },
            alternateNames: { type: "text" },
            photos: { type: "integer" },
          },
        },
      },
    });
    console.log("Created authors index");
  } else {
    console.log("Authors index already exists");
  }
}

/**
 * Delete and recreate indices (for fresh imports)
 */
export async function recreateIndices() {
  console.log("Recreating Elasticsearch indices...");

  // Delete if exists
  const editionsExists = await es.indices.exists({ index: INDICES.EDITIONS });
  if (editionsExists) {
    await es.indices.delete({ index: INDICES.EDITIONS });
    console.log("Deleted editions index");
  }

  const authorsExists = await es.indices.exists({ index: INDICES.AUTHORS });
  if (authorsExists) {
    await es.indices.delete({ index: INDICES.AUTHORS });
    console.log("Deleted authors index");
  }

  // Create fresh indices
  await createIndices();
}
