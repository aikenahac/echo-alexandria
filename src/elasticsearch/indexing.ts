import { es } from "./client";
import { INDICES } from "./indices";

/**
 * Bulk index editions into Elasticsearch
 */
export async function bulkIndexEditions(editions: any[]) {
  if (editions.length === 0) return;

  const operations = editions.flatMap((edition) => [
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
    },
  ]);

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
 * Refresh indices to make recent changes searchable
 */
export async function refreshIndices() {
  await es.indices.refresh({ index: [INDICES.EDITIONS, INDICES.AUTHORS] });
  console.log("Refreshed Elasticsearch indices");
}
