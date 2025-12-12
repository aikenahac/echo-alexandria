import { db } from "../db";
import { authors, works, editions } from "../db/schema";
import { sql } from "drizzle-orm";

/**
 * Generic batch inserter for efficient bulk imports
 */
export class BatchInserter<T> {
  private batch: T[] = [];
  private readonly batchSize: number;
  private readonly insertFn: (items: T[]) => Promise<void>;
  private totalInserted = 0;

  constructor(batchSize: number, insertFn: (items: T[]) => Promise<void>) {
    this.batchSize = batchSize;
    this.insertFn = insertFn;
  }

  async add(item: T) {
    this.batch.push(item);
    if (this.batch.length >= this.batchSize) {
      await this.flush();
    }
  }

  async flush() {
    if (this.batch.length === 0) return;

    await this.insertFn(this.batch);
    this.totalInserted += this.batch.length;
    this.batch = [];
  }

  getTotalInserted(): number {
    return this.totalInserted;
  }
}

/**
 * Upsert authors in batches
 */
export async function upsertAuthorsBatch(authorRecords: any[]) {
  if (authorRecords.length === 0) return;

  try {
    await db
      .insert(authors)
      .values(authorRecords)
      .onConflictDoUpdate({
        target: authors.key,
        set: {
          name: sql`EXCLUDED.name`,
          personalName: sql`EXCLUDED.personal_name`,
          birthDate: sql`EXCLUDED.birth_date`,
          deathDate: sql`EXCLUDED.death_date`,
          bio: sql`EXCLUDED.bio`,
          alternateNames: sql`EXCLUDED.alternate_names`,
          photos: sql`EXCLUDED.photos`,
          rawData: sql`EXCLUDED.raw_data`,
          lastImported: sql`EXCLUDED.last_imported`,
        },
      });
  } catch (error) {
    console.error("Error upserting authors batch:", error);
    throw error;
  }
}

/**
 * Upsert works in batches
 */
export async function upsertWorksBatch(workRecords: any[]) {
  if (workRecords.length === 0) return;

  try {
    await db
      .insert(works)
      .values(workRecords)
      .onConflictDoUpdate({
        target: works.key,
        set: {
          title: sql`EXCLUDED.title`,
          description: sql`EXCLUDED.description`,
          subjects: sql`EXCLUDED.subjects`,
          authorKeys: sql`EXCLUDED.author_keys`,
          firstPublishDate: sql`EXCLUDED.first_publish_date`,
          covers: sql`EXCLUDED.covers`,
          rawData: sql`EXCLUDED.raw_data`,
          lastImported: sql`EXCLUDED.last_imported`,
        },
      });
  } catch (error) {
    console.error("Error upserting works batch:", error);
    throw error;
  }
}

/**
 * Upsert editions in batches
 */
export async function upsertEditionsBatch(editionRecords: any[]) {
  if (editionRecords.length === 0) return;

  try {
    await db
      .insert(editions)
      .values(editionRecords)
      .onConflictDoUpdate({
        target: editions.key,
        set: {
          title: sql`EXCLUDED.title`,
          workKeys: sql`EXCLUDED.work_keys`,
          authorKeys: sql`EXCLUDED.author_keys`,
          isbn10: sql`EXCLUDED.isbn_10`,
          isbn13: sql`EXCLUDED.isbn_13`,
          publishers: sql`EXCLUDED.publishers`,
          publishDate: sql`EXCLUDED.publish_date`,
          numberOfPages: sql`EXCLUDED.number_of_pages`,
          covers: sql`EXCLUDED.covers`,
          languages: sql`EXCLUDED.languages`,
          physicalFormat: sql`EXCLUDED.physical_format`,
          editionName: sql`EXCLUDED.edition_name`,
          rawData: sql`EXCLUDED.raw_data`,
          lastImported: sql`EXCLUDED.last_imported`,
        },
      });
  } catch (error) {
    console.error("Error upserting editions batch:", error);
    throw error;
  }
}
