import { es, checkElasticsearchConnection } from "./client";

export const INDICES = {
  WORKS: "works",
  EDITIONS: "editions",
  AUTHORS: "authors",
};

/**
 * Create Elasticsearch indices with appropriate mappings
 */
export async function createIndices() {
  console.log("Creating Elasticsearch indices...");

  // First, check if Elasticsearch is accessible
  const connectionStatus = await checkElasticsearchConnection();
  if (!connectionStatus.connected) {
    throw new Error(
      `Cannot connect to Elasticsearch: ${connectionStatus.error}\n` +
        `URL: ${connectionStatus.details?.url}\n` +
        `Suggestion: ${connectionStatus.details?.suggestion}`
    );
  }

  console.log("✓ Elasticsearch connection verified");

  // Create works index
  const worksExists = await es.indices.exists({ index: INDICES.WORKS });
  if (!worksExists) {
    await es.indices.create({
      index: INDICES.WORKS,
      body: {
        settings: {
          number_of_shards: 1,
          number_of_replicas: 0,
          analysis: {
            analyzer: {
              english_text: {
                type: "custom",
                tokenizer: "standard",
                filter: ["lowercase", "asciifolding", "english_stop", "english_stemmer"],
              },
              english_exact: {
                type: "custom",
                tokenizer: "standard",
                filter: ["lowercase", "asciifolding"],
              },
              autocomplete: {
                type: "custom",
                tokenizer: "standard",
                filter: ["lowercase", "asciifolding", "edge_ngram_filter"],
              },
            },
            filter: {
              english_stop: {
                type: "stop",
                stopwords: "_english_",
              },
              english_stemmer: {
                type: "stemmer",
                language: "english",
              },
              edge_ngram_filter: {
                type: "edge_ngram",
                min_gram: 2,
                max_gram: 20,
              },
            },
            normalizer: {
              lowercase_normalizer: {
                type: "custom",
                filter: ["lowercase", "asciifolding"],
              },
            },
          },
        },
        mappings: {
          properties: {
            // Work-level fields
            key: { type: "keyword" },
            title: {
              type: "text",
              analyzer: "english_text",
              fields: {
                keyword: {
                  type: "keyword",
                  normalizer: "lowercase_normalizer",
                },
                exact: {
                  type: "text",
                  analyzer: "english_exact",
                },
                prefix: {
                  type: "text",
                  analyzer: "autocomplete",
                  search_analyzer: "english_exact",
                },
              },
            },
            description: {
              type: "text",
              analyzer: "english_text",
            },
            subjects: { type: "keyword" },
            authorKeys: { type: "keyword" },
            authors: {
              type: "text",
              analyzer: "english_text",
              fields: {
                keyword: {
                  type: "keyword",
                  normalizer: "lowercase_normalizer",
                },
                exact: {
                  type: "text",
                  analyzer: "english_exact",
                },
              },
            },
            firstPublishDate: { type: "keyword" },

            // Canonical edition fields (denormalized from best edition)
            canonicalEditionKey: { type: "keyword" },
            canonicalEditionTitle: {
              type: "text",
              analyzer: "english_text",
            },
            covers: { type: "integer" },
            isbn10: { type: "keyword" },
            isbn13: { type: "keyword" },
            publishers: { type: "keyword" },
            publishDate: { type: "keyword" },
            numberOfPages: { type: "integer" },
            languages: { type: "keyword" },
            physicalFormat: { type: "keyword" },

            // Aggregate metadata
            editionCount: { type: "integer" },
            editionKeys: { type: "keyword" },

            // Quality scoring fields
            hasKnownAuthors: { type: "boolean" },
            isEnglish: { type: "boolean" },
            hasCover: { type: "boolean" },
            hasDescription: { type: "boolean" },
            hasIsbn: { type: "boolean" },
            qualityScore: { type: "float" },
          },
        },
      },
    });
    console.log("Created works index");
  } else {
    console.log("Works index already exists");
  }

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
              english_text: {
                type: "custom",
                tokenizer: "standard",
                filter: ["lowercase", "asciifolding", "english_stop", "english_stemmer"],
              },
              english_exact: {
                type: "custom",
                tokenizer: "standard",
                filter: ["lowercase", "asciifolding"],
              },
              autocomplete: {
                type: "custom",
                tokenizer: "standard",
                filter: ["lowercase", "asciifolding", "edge_ngram_filter"],
              },
            },
            filter: {
              english_stop: {
                type: "stop",
                stopwords: "_english_",
              },
              english_stemmer: {
                type: "stemmer",
                language: "english",
              },
              edge_ngram_filter: {
                type: "edge_ngram",
                min_gram: 2,
                max_gram: 20,
              },
            },
            normalizer: {
              lowercase_normalizer: {
                type: "custom",
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
              analyzer: "english_text",
              fields: {
                keyword: {
                  type: "keyword",
                  normalizer: "lowercase_normalizer",
                },
                exact: {
                  type: "text",
                  analyzer: "english_exact",
                },
                prefix: {
                  type: "text",
                  analyzer: "autocomplete",
                  search_analyzer: "english_exact",
                },
              },
            },
            workKeys: { type: "keyword" },
            authorKeys: { type: "keyword" },
            authors: {
              type: "text",
              analyzer: "english_text",
              fields: {
                keyword: {
                  type: "keyword",
                  normalizer: "lowercase_normalizer",
                },
                exact: {
                  type: "text",
                  analyzer: "english_exact",
                },
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
            editionName: {
              type: "text",
              analyzer: "english_text",
            },
            // Quality indicator fields (computed at index time)
            coverCount: { type: "integer" },
            hasCover: { type: "boolean" },
            isbnCount: { type: "integer" },
            hasIsbn: { type: "boolean" },
            authorCount: { type: "integer" },
            hasAuthors: { type: "boolean" },
            qualityScore: { type: "float" },
            // New quality indicator fields for enhanced ranking
            hasKnownAuthors: { type: "boolean" },
            isEnglish: { type: "boolean" },
            knownAuthorCount: { type: "integer" },
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

  // First, check if Elasticsearch is accessible
  const connectionStatus = await checkElasticsearchConnection();
  if (!connectionStatus.connected) {
    throw new Error(
      `Cannot connect to Elasticsearch: ${connectionStatus.error}\n` +
        `URL: ${connectionStatus.details?.url}\n` +
        `Suggestion: ${connectionStatus.details?.suggestion}`
    );
  }

  console.log("✓ Elasticsearch connection verified");

  // Delete if exists
  const worksExists = await es.indices.exists({ index: INDICES.WORKS });
  if (worksExists) {
    await es.indices.delete({ index: INDICES.WORKS });
    console.log("Deleted works index");
  }

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
