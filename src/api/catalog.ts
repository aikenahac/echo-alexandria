import { db } from "../db";
import { authors, works, editions } from "../db/schema";
import { desc, ilike, sql, or } from "drizzle-orm";

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Get paginated list of authors
 */
export async function listAuthors(
  page = 1,
  pageSize = 50,
  search?: string
): Promise<PaginatedResponse<any>> {
  const offset = (page - 1) * pageSize;

  // Build where clause
  const whereClause = search
    ? or(
        ilike(authors.name, `%${search}%`),
        ilike(authors.personalName, `%${search}%`)
      )
    : undefined;

  // Get total count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(authors)
    .where(whereClause);

  // Get paginated data
  const data = await db
    .select({
      key: authors.key,
      name: authors.name,
      personalName: authors.personalName,
      birthDate: authors.birthDate,
      deathDate: authors.deathDate,
      photos: authors.photos,
    })
    .from(authors)
    .where(whereClause)
    .orderBy(desc(authors.createdAt))
    .limit(pageSize)
    .offset(offset);

  return {
    data,
    total: Number(count),
    page,
    pageSize,
    totalPages: Math.ceil(Number(count) / pageSize),
  };
}

/**
 * Get paginated list of works
 */
export async function listWorks(
  page = 1,
  pageSize = 50,
  search?: string
): Promise<PaginatedResponse<any>> {
  const offset = (page - 1) * pageSize;

  const whereClause = search ? ilike(works.title, `%${search}%`) : undefined;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(works)
    .where(whereClause);

  const data = await db
    .select({
      key: works.key,
      title: works.title,
      authorKeys: works.authorKeys,
      subjects: works.subjects,
      firstPublishDate: works.firstPublishDate,
      covers: works.covers,
    })
    .from(works)
    .where(whereClause)
    .orderBy(desc(works.createdAt))
    .limit(pageSize)
    .offset(offset);

  return {
    data,
    total: Number(count),
    page,
    pageSize,
    totalPages: Math.ceil(Number(count) / pageSize),
  };
}

/**
 * Get paginated list of editions
 */
export async function listEditions(
  page = 1,
  pageSize = 50,
  search?: string
): Promise<PaginatedResponse<any>> {
  const offset = (page - 1) * pageSize;

  const whereClause = search ? ilike(editions.title, `%${search}%`) : undefined;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(editions)
    .where(whereClause);

  const data = await db
    .select({
      key: editions.key,
      title: editions.title,
      authorKeys: editions.authorKeys,
      isbn10: editions.isbn10,
      isbn13: editions.isbn13,
      publishers: editions.publishers,
      publishDate: editions.publishDate,
      numberOfPages: editions.numberOfPages,
      covers: editions.covers,
    })
    .from(editions)
    .where(whereClause)
    .orderBy(desc(editions.createdAt))
    .limit(pageSize)
    .offset(offset);

  return {
    data,
    total: Number(count),
    page,
    pageSize,
    totalPages: Math.ceil(Number(count) / pageSize),
  };
}
