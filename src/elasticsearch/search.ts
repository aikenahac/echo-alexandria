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
        bool: {
          should: [
            // Exact match gets highest boost
            {
              term: {
                "title.keyword": {
                  value: searchTerm,
                  boost: 100,
                },
              },
            },
            // Phrase match on exact field
            {
              match_phrase: {
                "title.exact": {
                  query: searchTerm,
                  boost: 50,
                },
              },
            },
            // Prefix match
            {
              match_phrase_prefix: {
                title: {
                  query: searchTerm,
                  boost: 10,
                },
              },
            },
            // Standard match
            {
              match: {
                title: {
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
