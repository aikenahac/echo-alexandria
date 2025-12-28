import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Authors table
export const authors = pgTable(
  "authors",
  {
    key: text("key").primaryKey(), // e.g., "/authors/OL23919A"
    name: text("name").notNull(),
    personalName: text("personal_name"),
    birthDate: text("birth_date"),
    deathDate: text("death_date"),
    bio: text("bio"),
    alternateNames: text("alternate_names").array(),
    photos: integer("photos").array(), // Cover IDs
    rawData: jsonb("raw_data"), // Full JSON for future fields
    lastImported: timestamp("last_imported").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    nameIdx: index("authors_name_idx").on(table.name),
    // GIN index for full-text search on name
    nameGinIdx: index("authors_name_gin_idx").using(
      "gin",
      sql`to_tsvector('english', ${table.name})`
    ),
  })
);

// Works table
export const works = pgTable(
  "works",
  {
    key: text("key").primaryKey(), // e.g., "/works/OL45804W"
    title: text("title").notNull(),
    description: text("description"),
    subjects: text("subjects").array(),
    authorKeys: text("author_keys").array(), // Foreign keys to authors
    firstPublishDate: text("first_publish_date"),
    covers: integer("covers").array(),
    rawData: jsonb("raw_data"),
    lastImported: timestamp("last_imported").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    titleIdx: index("works_title_idx").on(table.title),
    // GIN index for full-text search on title
    titleGinIdx: index("works_title_gin_idx").using(
      "gin",
      sql`to_tsvector('english', ${table.title})`
    ),
    // GIN index for array searches
    authorKeysIdx: index("works_author_keys_idx").using(
      "gin",
      table.authorKeys
    ),
  })
);

// Editions table (MOST IMPORTANT - users track these)
export const editions = pgTable(
  "editions",
  {
    key: text("key").primaryKey(), // e.g., "/books/OL7353617M"
    title: text("title").notNull(),
    workKeys: text("work_keys").array(), // Foreign keys to works
    authorKeys: text("author_keys").array(),
    isbn10: text("isbn_10").array(),
    isbn13: text("isbn_13").array(),
    publishers: text("publishers").array(),
    publishDate: text("publish_date"),
    numberOfPages: integer("number_of_pages"),
    covers: integer("covers").array(),
    languages: text("languages").array(), // e.g., ["/languages/eng"]
    physicalFormat: text("physical_format"),
    editionName: text("edition_name"),
    rawData: jsonb("raw_data"),
    lastImported: timestamp("last_imported").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    titleIdx: index("editions_title_idx").on(table.title),
    // GIN index for full-text search on title
    titleGinIdx: index("editions_title_gin_idx").using(
      "gin",
      sql`to_tsvector('english', ${table.title})`
    ),
    // GIN indexes for array searches
    isbn10Idx: index("editions_isbn10_idx").using("gin", table.isbn10),
    isbn13Idx: index("editions_isbn13_idx").using("gin", table.isbn13),
    workKeysIdx: index("editions_work_keys_idx").using("gin", table.workKeys),
    authorKeysIdx: index("editions_author_keys_idx").using(
      "gin",
      table.authorKeys
    ),
  })
);

// Import tracking table
export const importJobs = pgTable(
  "import_jobs",
  {
    id: text("id").primaryKey(), // UUID
    type: text("type").notNull(), // "works" | "editions" | "authors"
    status: text("status").notNull(), // "running" | "completed" | "failed"
    recordsProcessed: integer("records_processed").default(0),
    recordsInserted: integer("records_inserted").default(0),
    recordsUpdated: integer("records_updated").default(0),
    error: text("error"),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    typeIdx: index("import_jobs_type_idx").on(table.type),
    statusIdx: index("import_jobs_status_idx").on(table.status),
    startedAtIdx: index("import_jobs_started_at_idx").on(table.startedAt),
  })
);

// Reindex tracking table
export const reindexJobs = pgTable(
  "reindex_jobs",
  {
    id: text("id").primaryKey(), // UUID
    type: text("type").notNull(), // "authors" | "editions" | "full"
    status: text("status").notNull(), // "running" | "completed" | "failed"
    authorsIndexed: integer("authors_indexed").default(0),
    editionsIndexed: integer("editions_indexed").default(0),
    totalAuthors: integer("total_authors").default(0),
    totalEditions: integer("total_editions").default(0),
    currentPhase: text("current_phase"), // "recreating_indices" | "indexing_authors" | "indexing_editions" | "indexing_works" | "refreshing"
    error: text("error"),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    statusIdx: index("reindex_jobs_status_idx").on(table.status),
    startedAtIdx: index("reindex_jobs_started_at_idx").on(table.startedAt),
  })
);
