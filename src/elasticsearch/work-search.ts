import { es } from "./client";
import { INDICES } from "./indices";

export interface WorkSearchResult {
  workKey: string;
  title: string;
  authors: string[];
  description: string | null;
  subjects: string[];
  canonicalEdition: {
    key: string;
    title: string;
    covers: number[];
    isbn10: string[];
    isbn13: string[];
    publishers: string[];
    publishDate: string | null;
    numberOfPages: number | null;
    languages: string[];
  };
  editionCount: number;
  score: number;
}

/**
 * Search works by title/author using Elasticsearch with enhanced quality boosting
 * This returns works with their canonical editions, providing cleaner search results
 */
export async function searchWorks(
  query: string,
  limit = 20,
  offset = 0
): Promise<WorkSearchResult[]> {
  if (!query.trim()) return [];

  const searchTerm = query.trim();

  const response = await es.search({
    index: INDICES.WORKS,
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
                    fields: ["title.exact^50", "authors.exact^40"],
                    type: "phrase",
                    boost: 50,
                  },
                },

                // Tier 3: Multi-field best_fields with AND operator
                {
                  multi_match: {
                    query: searchTerm,
                    fields: [
                      "title^10",
                      "authors^7",
                      "description^2",
                      "subjects^3",
                    ],
                    type: "best_fields",
                    operator: "and",
                    boost: 20,
                  },
                },

                // Tier 4: Cross-fields search (treats as single virtual field)
                {
                  multi_match: {
                    query: searchTerm,
                    fields: ["title^8", "authors^6", "description^2"],
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
                    fields: ["title^4", "authors^2", "subjects"],
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

          // Enhanced quality-based scoring functions
          functions: [
            // Pre-computed quality score (most important factor)
            {
              field_value_factor: {
                field: "qualityScore",
                factor: 1.0,
                modifier: "none",
                missing: 1.0,
              },
            },

            // Boost works with known authors (not "Unknown")
            {
              filter: { term: { hasKnownAuthors: true } },
              weight: 1.3,
            },

            // Boost English language works
            {
              filter: { term: { isEnglish: true } },
              weight: 1.2,
            },

            // Strong penalty for low quality (no cover + unknown authors)
            // This ensures poor quality works rank very low
            {
              filter: {
                bool: {
                  must: [
                    { term: { hasKnownAuthors: false } },
                    { term: { hasCover: false } },
                  ],
                },
              },
              weight: 0.3, // 70% penalty
            },

            // Boost for having description (indicates complete metadata)
            {
              filter: { term: { hasDescription: true } },
              weight: 1.1,
            },

            // Slight boost for having more editions (indicates popular work)
            {
              filter: { exists: { field: "editionCount" } },
              field_value_factor: {
                field: "editionCount",
                modifier: "log1p",
                factor: 0.05,
                missing: 0,
              },
            },
          ],

          score_mode: "multiply",
          boost_mode: "multiply",
          max_boost: 15.0, // Increased from 10.0 to allow better separation
        },
      },
      from: offset,
      size: limit,
    },
  });

  return response.hits.hits.map((hit: any) => ({
    workKey: hit._source.key,
    title: hit._source.title,
    authors: hit._source.authors || [],
    description: hit._source.description || null,
    subjects: hit._source.subjects || [],
    canonicalEdition: {
      key: hit._source.canonicalEditionKey,
      title: hit._source.canonicalEditionTitle || hit._source.title,
      covers: hit._source.covers || [],
      isbn10: hit._source.isbn10 || [],
      isbn13: hit._source.isbn13 || [],
      publishers: hit._source.publishers || [],
      publishDate: hit._source.publishDate || null,
      numberOfPages: hit._source.numberOfPages || null,
      languages: hit._source.languages || [],
    },
    editionCount: hit._source.editionCount || 1,
    score: hit._score,
  }));
}
