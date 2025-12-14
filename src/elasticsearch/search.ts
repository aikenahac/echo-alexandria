import { es } from "./client";
import { INDICES } from "./indices";

export interface EditionSearchResult {
  key: string;
  title: string;
  authors: string[];
  isbn10: string[];
  isbn13: string[];
  publishDate: string | null;
  numberOfPages: number | null;
  covers: number[];
  publishers: string[];
}

export interface AuthorSearchResult {
  key: string;
  name: string;
  birthDate: string | null;
  deathDate: string | null;
  photos: number[];
}

/**
 * Search editions by title using Elasticsearch
 * Prioritizes exact matches and phrase matches
 */
export async function searchEditions(
  query: string,
  limit = 20,
  offset = 0
): Promise<EditionSearchResult[]> {
  if (!query.trim()) return [];

  const searchTerm = query.trim();

  const response = await es.search({
    index: INDICES.EDITIONS,
    body: {
      query: {
        function_score: {
          query: {
            bool: {
              should: [
                // Tier 1: Exact normalized match (highest priority)
                {
                  multi_match: {
                    query: searchTerm,
                    fields: ["title.keyword^200", "authors.keyword^150"],
                    type: "phrase",
                    boost: 100,
                  },
                },

                // Tier 2: Exact phrase without stemming
                {
                  multi_match: {
                    query: searchTerm,
                    fields: ["title.exact^100", "authors.exact^75"],
                    type: "phrase",
                    boost: 50,
                  },
                },

                // Tier 3: Multi-field best_fields with AND operator
                {
                  multi_match: {
                    query: searchTerm,
                    fields: ["title^10", "authors^7", "editionName^3"],
                    type: "best_fields",
                    operator: "and",
                    boost: 20,
                  },
                },

                // Tier 4: Cross-fields search (treats as single virtual field)
                {
                  multi_match: {
                    query: searchTerm,
                    fields: ["title^8", "authors^6"],
                    type: "cross_fields",
                    operator: "and",
                    boost: 10,
                  },
                },

                // Tier 5: Phrase prefix for autocomplete
                {
                  multi_match: {
                    query: searchTerm,
                    fields: ["title.prefix^5", "authors^3"],
                    type: "phrase_prefix",
                    boost: 5,
                  },
                },

                // Tier 6: Standard match with OR and 75% minimum
                {
                  multi_match: {
                    query: searchTerm,
                    fields: ["title^4", "authors^2", "editionName"],
                    type: "best_fields",
                    operator: "or",
                    minimum_should_match: "75%",
                    boost: 2,
                  },
                },

                // Tier 7: Fuzzy matching for typos
                {
                  multi_match: {
                    query: searchTerm,
                    fields: ["title^2", "authors"],
                    type: "best_fields",
                    fuzziness: "AUTO",
                    prefix_length: 2,
                    boost: 1,
                  },
                },
              ],
              minimum_should_match: 1,
            },
          },

          // Quality-based scoring functions
          functions: [
            // Use pre-computed quality score
            {
              field_value_factor: {
                field: "qualityScore",
                factor: 1.0,
                modifier: "none",
                missing: 1.0,
              },
            },

            // Additional boost for page count (indicates complete data)
            {
              filter: { exists: { field: "numberOfPages" } },
              field_value_factor: {
                field: "numberOfPages",
                modifier: "log1p",
                factor: 0.1,
                missing: 0,
              },
            },
          ],

          score_mode: "multiply",
          boost_mode: "multiply",
          max_boost: 10.0,
        },
      },
      from: offset,
      size: limit,
    },
  });

  return response.hits.hits.map((hit: any) => ({
    key: hit._source.key,
    title: hit._source.title,
    authors: hit._source.authors || [],
    isbn10: hit._source.isbn10 || [],
    isbn13: hit._source.isbn13 || [],
    publishDate: hit._source.publishDate || null,
    numberOfPages: hit._source.numberOfPages || null,
    covers: hit._source.covers || [],
    publishers: hit._source.publishers || [],
  }));
}

/**
 * Search authors by name using Elasticsearch
 * Prioritizes exact matches and phrase matches
 */
export async function searchAuthors(
  query: string,
  limit = 20,
  offset = 0
): Promise<AuthorSearchResult[]> {
  if (!query.trim()) return [];

  const searchTerm = query.trim();

  const response = await es.search({
    index: INDICES.AUTHORS,
    body: {
      query: {
        bool: {
          should: [
            // Exact match gets highest boost
            {
              term: {
                "name.keyword": {
                  value: searchTerm,
                  boost: 100,
                },
              },
            },
            // Phrase match on exact field
            {
              match_phrase: {
                "name.exact": {
                  query: searchTerm,
                  boost: 50,
                },
              },
            },
            // Prefix match
            {
              match_phrase_prefix: {
                name: {
                  query: searchTerm,
                  boost: 10,
                },
              },
            },
            // Standard match
            {
              match: {
                name: {
                  query: searchTerm,
                  boost: 1,
                },
              },
            },
          ],
          minimum_should_match: 1,
        },
      },
      from: offset,
      size: limit,
    },
  });

  return response.hits.hits.map((hit: any) => ({
    key: hit._source.key,
    name: hit._source.name,
    birthDate: hit._source.birthDate || null,
    deathDate: hit._source.deathDate || null,
    photos: hit._source.photos || [],
  }));
}
