import { db } from "../db";
import { authors, editions } from "../db/schema";
import { inArray, sql } from "drizzle-orm";

/**
 * Resolve author names from author keys
 * @param authorKeys - Array of author keys (e.g., ["/authors/OL23919A"])
 * @returns Array of author names
 */
export async function resolveAuthorNames(
  authorKeys: string[]
): Promise<string[]> {
  if (!authorKeys || authorKeys.length === 0) return [];

  const authorRecords = await db
    .select({ key: authors.key, name: authors.name })
    .from(authors)
    .where(inArray(authors.key, authorKeys));

  const authorsMap = new Map<string, string>();
  authorRecords.forEach((a) => authorsMap.set(a.key, a.name));

  return authorKeys.map((k) => authorsMap.get(k) || "Unknown");
}

/**
 * Resolve author names for multiple editions efficiently
 * @param editionsToResolve - Array of editions
 * @returns Array of editions with resolved author names
 */
export async function resolveAuthorsForEditions(
  editionsToResolve: any[]
): Promise<any[]> {
  // Extract all unique author keys from all editions
  const authorKeys = [
    ...new Set(
      editionsToResolve.flatMap((edition) => edition.authorKeys || [])
    ),
  ];

  // Build a map of author key -> author name
  const authorsMap = new Map<string, string>();

  if (authorKeys.length > 0) {
    const authorRecords = await db
      .select({ key: authors.key, name: authors.name })
      .from(authors)
      .where(inArray(authors.key, authorKeys));

    authorRecords.forEach((a) => authorsMap.set(a.key, a.name));
  }

  // Return editions with resolved author names
  return editionsToResolve.map((edition) => ({
    ...edition,
    authors: (edition.authorKeys || []).map(
      (k: string) => authorsMap.get(k) || "Unknown"
    ),
  }));
}

/**
 * Compute quality score for edition selection
 * This is similar to the indexing quality score but used for selecting canonical editions
 */
export function computeEditionSelectionScore(edition: any): number {
  let score = 1.0;

  // Check if has known authors (not "Unknown")
  const knownAuthors = (edition.authors || []).filter(
    (author: string) => author && author !== "Unknown"
  );
  const hasKnownAuthors = knownAuthors.length > 0;

  // Check if is English
  const isEnglish = (edition.languages || []).some((lang: string) =>
    lang.includes("/languages/eng")
  );

  // TIER 1: Critical quality signals
  const hasCover = (edition.covers?.length || 0) > 0;
  if (hasCover && hasKnownAuthors) {
    score *= 3.0; // Even stronger boost for selection purposes
  } else if (hasCover) {
    score *= 2.0;
  }

  // Known authors boost
  if (hasKnownAuthors) {
    score *= 2.5; // Higher boost for selection
    if (knownAuthors.length > 1) {
      score *= 1.2; // Bonus for multiple known authors
    }
  } else if ((edition.authors?.length || 0) > 0) {
    score *= 1.05; // Minimal boost for "Unknown" authors
  }

  // TIER 2: Language preference
  if (isEnglish) {
    score *= 1.8; // Strong English preference
  }

  // TIER 3: Additional quality signals
  if ((edition.isbn13?.length || 0) > 0) {
    score *= 1.4;
  } else if ((edition.isbn10?.length || 0) > 0) {
    score *= 1.2;
  }

  if ((edition.publishers?.length || 0) > 0) {
    score *= 1.2;
  }

  if (edition.publishDate) {
    score *= 1.2;
  }

  if (edition.numberOfPages && edition.numberOfPages > 0) {
    score *= 1.1;
  }

  return score;
}

/**
 * Compare two dates for sorting
 * More recent dates are considered "greater"
 */
function compareDates(dateA: string | null, dateB: string | null): number {
  if (!dateA && !dateB) return 0;
  if (!dateA) return -1;
  if (!dateB) return 1;

  // Try to parse dates
  // OpenLibrary dates can be in various formats: "2007", "July 2007", "July 21, 2007", etc.
  const yearA = extractYear(dateA);
  const yearB = extractYear(dateB);

  if (yearA === null && yearB === null) return 0;
  if (yearA === null) return -1;
  if (yearB === null) return 1;

  return yearA - yearB;
}

/**
 * Extract year from a date string
 */
function extractYear(dateStr: string): number | null {
  // Look for 4-digit year
  const match = dateStr.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0]) : null;
}

/**
 * Select canonical edition for a work
 * @param workKey - The work key (e.g., "/works/OL45804W")
 * @returns The canonical edition or null if no editions found
 */
export async function selectCanonicalEdition(
  workKey: string
): Promise<any | null> {
  // Fetch all editions for this work
  const editionsForWork = await db
    .select()
    .from(editions)
    .where(sql`${editions.workKeys} @> ARRAY[${workKey}]::text[]`);

  if (editionsForWork.length === 0) {
    return null;
  }

  // Resolve author names for all editions
  const editionsWithAuthors = await resolveAuthorsForEditions(editionsForWork);

  // Score each edition
  const scoredEditions = editionsWithAuthors.map((edition) => ({
    edition,
    score: computeEditionSelectionScore(edition),
  }));

  // Sort by score (descending), then by publishDate (descending for most recent)
  scoredEditions.sort((a, b) => {
    // First compare by score
    if (Math.abs(a.score - b.score) > 0.01) {
      return b.score - a.score; // Higher score first
    }
    // If scores are very close, prefer more recent publication
    return compareDates(b.edition.publishDate, a.edition.publishDate);
  });

  return scoredEditions[0].edition;
}

/**
 * Compute work-level quality score based on work and canonical edition
 */
export function computeWorkQualityScore(
  work: any,
  canonicalEdition: any,
  authors: string[]
): number {
  let score = 1.0;

  // Use edition quality as base
  const editionScore = computeEditionSelectionScore(canonicalEdition);
  score *= editionScore;

  // Additional boost for having description at work level
  if (work.description) {
    score *= 1.2;
  }

  // Boost for having subjects
  if ((work.subjects?.length || 0) > 0) {
    score *= 1.1;
  }

  return score;
}
