import { es } from "./client";
import { INDICES } from "./indices";

/**
 * Bulk index editions into Elasticsearch
 */
export async function bulkIndexEditions(editions: any[]) {
  if (editions.length === 0) return;

  const operations = editions.flatMap((edition) => {
    // Compute new quality indicators
    const knownAuthors = (edition.authors || []).filter(
      (author: string) => author && author !== "Unknown"
    );
    const hasKnownAuthors = knownAuthors.length > 0;
    const knownAuthorCount = knownAuthors.length;
    const isEnglish = (edition.languages || []).some((lang: string) =>
      lang.includes("/languages/eng")
    );

    return [
      { index: { _index: INDICES.EDITIONS, _id: edition.key } },
      {
        key: edition.key,
        title: edition.title,
        workKeys: edition.workKeys,
        authorKeys: edition.authorKeys,
        authors: edition.authors, // Resolved author names
        isbn10: edition.isbn10,
        isbn13: edition.isbn13,
        publishers: edition.publishers,
        publishDate: edition.publishDate,
        numberOfPages: edition.numberOfPages,
        covers: edition.covers,
        languages: edition.languages,
        physicalFormat: edition.physicalFormat,
        editionName: edition.editionName,
        // Quality indicator fields
        coverCount: edition.covers?.length || 0,
        hasCover: (edition.covers?.length || 0) > 0,
        isbnCount: (edition.isbn10?.length || 0) + (edition.isbn13?.length || 0),
        hasIsbn: ((edition.isbn10?.length || 0) + (edition.isbn13?.length || 0)) > 0,
        authorCount: edition.authors?.length || 0,
        hasAuthors: (edition.authors?.length || 0) > 0,
        // New quality indicator fields for enhanced ranking
        hasKnownAuthors,
        isEnglish,
        knownAuthorCount,
        qualityScore: computeQualityScore(edition, hasKnownAuthors, isEnglish),
      },
    ];
  });

  const response = await es.bulk({
    operations,
    refresh: false, // Don't refresh immediately for performance
  });

  if (response.errors) {
    const erroredDocuments = response.items.filter((item: any) => item.index?.error);
    console.error(`Elasticsearch bulk indexing errors: ${erroredDocuments.length}`);
    erroredDocuments.slice(0, 5).forEach((item: any) => {
      console.error(item.index?.error);
    });
  }
}

/**
 * Bulk index authors into Elasticsearch
 */
export async function bulkIndexAuthors(authors: any[]) {
  if (authors.length === 0) return;

  const operations = authors.flatMap((author) => [
    { index: { _index: INDICES.AUTHORS, _id: author.key } },
    {
      key: author.key,
      name: author.name,
      personalName: author.personalName,
      birthDate: author.birthDate,
      deathDate: author.deathDate,
      bio: author.bio,
      alternateNames: author.alternateNames,
      photos: author.photos,
    },
  ]);

  const response = await es.bulk({
    operations,
    refresh: false,
  });

  if (response.errors) {
    const erroredDocuments = response.items.filter((item: any) => item.index?.error);
    console.error(`Elasticsearch bulk indexing errors: ${erroredDocuments.length}`);
    erroredDocuments.slice(0, 5).forEach((item: any) => {
      console.error(item.index?.error);
    });
  }
}

/**
 * Bulk index works into Elasticsearch
 */
export async function bulkIndexWorks(works: any[]) {
  if (works.length === 0) return;

  const operations = works.flatMap((work) => [
    { index: { _index: INDICES.WORKS, _id: work.key } },
    {
      key: work.key,
      title: work.title,
      description: work.description,
      subjects: work.subjects,
      authorKeys: work.authorKeys,
      authors: work.authors,
      firstPublishDate: work.firstPublishDate,
      // Canonical edition fields
      canonicalEditionKey: work.canonicalEditionKey,
      canonicalEditionTitle: work.canonicalEditionTitle,
      covers: work.covers,
      isbn10: work.isbn10,
      isbn13: work.isbn13,
      publishers: work.publishers,
      publishDate: work.publishDate,
      numberOfPages: work.numberOfPages,
      languages: work.languages,
      physicalFormat: work.physicalFormat,
      // Aggregate metadata
      editionCount: work.editionCount,
      editionKeys: work.editionKeys,
      // Quality scoring fields
      hasKnownAuthors: work.hasKnownAuthors,
      isEnglish: work.isEnglish,
      hasCover: work.hasCover,
      hasDescription: work.hasDescription,
      hasIsbn: work.hasIsbn,
      qualityScore: work.qualityScore,
    },
  ]);

  const response = await es.bulk({
    operations,
    refresh: false,
  });

  if (response.errors) {
    const erroredDocuments = response.items.filter((item: any) => item.index?.error);
    console.error(`Elasticsearch bulk indexing errors: ${erroredDocuments.length}`);
    erroredDocuments.slice(0, 5).forEach((item: any) => {
      console.error(item.index?.error);
    });
  }
}

/**
 * Refresh indices to make recent changes searchable
 */
export async function refreshIndices() {
  await es.indices.refresh({ index: [INDICES.WORKS, INDICES.EDITIONS, INDICES.AUTHORS] });
  console.log("Refreshed Elasticsearch indices");
}

/**
 * Compute quality score for an edition based on available metadata
 * Higher quality = more complete data (covers, ISBNs, authors, etc.)
 *
 * @param edition - The edition record
 * @param hasKnownAuthors - Whether edition has non-"Unknown" authors
 * @param isEnglish - Whether edition is in English
 * @returns Quality score multiplier (typically 1.0 to 10.0+)
 */
function computeQualityScore(
  edition: any,
  hasKnownAuthors: boolean,
  isEnglish: boolean
): number {
  let score = 1.0;

  // TIER 1: Critical quality signals (highest multipliers)

  // Strong boost for having both cover AND known authors
  // This is the "premium" signal we want to prioritize
  const hasCover = (edition.covers?.length || 0) > 0;
  if (hasCover && hasKnownAuthors) {
    score *= 2.5; // STRONG boost for best quality editions
  } else if (hasCover) {
    score *= 1.5; // Moderate boost for cover only
  }

  // Boost for known authors (but less than cover + authors combo)
  if (hasKnownAuthors) {
    score *= 1.8; // Good boost for having real author names

    // Additional boost for multiple known authors
    const knownCount = (edition.authors || []).filter(
      (a: string) => a && a !== "Unknown"
    ).length;
    if (knownCount > 1) {
      score *= 1.1; // Slight additional boost for multiple authors
    }
  } else if ((edition.authors?.length || 0) > 0) {
    // Has authors but they're all "Unknown" - minimal boost
    score *= 1.05; // Very small boost (much less than 1.3 before)
  }

  // TIER 2: Language preference
  if (isEnglish) {
    score *= 1.4; // Solid boost for English content
  }

  // TIER 3: Additional quality signals (smaller multipliers)

  // Boost for having ISBN (indicates official publication)
  if ((edition.isbn13?.length || 0) > 0) {
    score *= 1.3; // Prefer ISBN-13
  } else if ((edition.isbn10?.length || 0) > 0) {
    score *= 1.2; // ISBN-10 is still good
  }

  // Boost for having publisher information
  if ((edition.publishers?.length || 0) > 0) {
    score *= 1.1;
  }

  // Boost for having publish date
  if (edition.publishDate) {
    score *= 1.1;
  }

  // Boost for having page count (indicates complete metadata)
  if (edition.numberOfPages && edition.numberOfPages > 0) {
    score *= 1.1;
  }

  return score;
}
