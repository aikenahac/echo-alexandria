---
title: Data Relationships
---

# OpenLibrary Entity Relationships

Understanding how Authors, Works, and Editions relate to each other is critical for querying and displaying data correctly. OpenLibrary uses a hierarchical model with specific linking patterns that Echo Alexandria maintains in its database and search indices.

## Entity Key Formats

OpenLibrary uses consistent key formats for each entity type, enabling reliable identification and cross-referencing:

### Author Keys

Format: `/authors/OL{number}A`

Examples:
- `/authors/OL23919A` - J.R.R. Tolkien
- `/authors/OL2817612A` - C.S. Lewis
- `/authors/OL43812A` - Jane Austen

- Always ends with uppercase `A`
- Number is unique within authors
- Stable and never change (legacy compatibility)

### Work Keys

Format: `/works/OL{number}W`

Examples:
- `/works/OL45804W` - The Lord of the Rings
- `/works/OL80746W` - The Chronicles of Narnia
- `/works/OL48183W` - Pride and Prejudice

- Always ends with uppercase `W`
- Number is unique within works
- Each intellectual work has exactly one key

### Edition Keys

Format: `/books/OL{number}M`

Examples:
- `/books/OL7353617M` - LOTR 2012 Houghton Mifflin edition
- `/books/OL7353618M` - LOTR 2011 Penguin edition
- `/books/OL7353619M` - LOTR 1954 Allen & Unwin first edition

- Always ends with uppercase `M` (for "manifestation")
- Uses `/books/` prefix (not `/editions/`)
- Number is unique within editions
- Each physical publication has its own key

## Hierarchical Structure

OpenLibrary uses a three-level hierarchy:

```
Author
  ├── Work 1
  │   ├── Edition 1
  │   ├── Edition 2
  │   └── Edition 3
  ├── Work 2
  │   ├── Edition 4
  │   └── Edition 5
  └── Work 3
      └── Edition 6
```

This means:
- One author can write multiple works
- One work can have multiple editions
- Each edition belongs to exactly one work
- Each edition can have multiple authors (co-authored works)

## Author to Works Relationship

### Direct References

Interestingly, the author dump does NOT directly list an author's works. Instead:

```json
// Author record has no "works" field
{
  "name": "J.R.R. Tolkien",
  "personal_name": "John Ronald Reuel Tolkien",
  "birth_date": "1892",
  // No "works" array here
}
```

### Derived from Works

An author's works are determined by examining the works dump:

```json
// Work record contains author_keys
{
  "title": "The Hobbit",
  "author_keys": ["/authors/OL23919A"]
}

{
  "title": "The Lord of the Rings",
  "author_keys": ["/authors/OL23919A"]
}
```

### Implementation in Echo Alexandria

Echo Alexandria resolves this relationship in two ways:

**1. Database Join**
```sql
-- Find all works by a given author
SELECT w.*
FROM works w
WHERE w.author_keys @> ARRAY['/authors/OL23919A']::text[];
```

**2. Elasticsearch Query**
```json
{
  "query": {
    "match": {
      "author_keys": "/authors/OL23919A"
    }
  }
}
```

Both approaches handle the many-to-many relationship efficiently.

### Many-to-Many Nature

- One author can have multiple works
- One work can have multiple authors (co-authorship)

Example: J.R.R. Tolkien and C.S. Lewis co-edited a work:

```json
{
  "title": "Essays Presented to Charles Williams",
  "author_keys": [
    "/authors/OL23919A",      // Tolkien
    "/authors/OL2817612A"     // Lewis
  ]
}
```

## Work to Editions Relationship

### Direct References

Editions directly reference their parent work:

```json
// Edition records contain work_keys
{
  "title": "The Lord of the Rings",
  "work_keys": ["/works/OL45804W"],
  "isbn_13": "978-0544003415"
}

{
  "title": "The Lord of the Rings",
  "work_keys": ["/works/OL45804W"],
  "isbn_13": "978-0061215599"
}
```

### One-to-Many Relationship

- One work typically has many editions
- Each edition has exactly one work (usually)
- Rare omnibus editions may reference multiple works

```json
{
  "title": "The Complete Lord of the Rings",
  "work_keys": [
    "/works/OL45804W",    // The Fellowship
    "/works/OL45805W",    // The Two Towers
    "/works/OL45806W"     // The Return of the King
  ]
}
```

### Implementation in Echo Alexandria

**Database Query**
```sql
-- Find all editions of a work
SELECT e.*
FROM editions e
WHERE e.work_keys @> ARRAY['/works/OL45804W']::text[];
```

**Elasticsearch Query**
```json
{
  "query": {
    "match": {
      "work_keys": "/works/OL45804W"
    }
  }
}
```

## Author to Editions Relationship

### Denormalization

Editions include a denormalized `author_keys` array for efficient queries:

```json
{
  "title": "The Lord of the Rings",
  "work_keys": ["/works/OL45804W"],
  "author_keys": ["/authors/OL23919A"],  // Denormalized from work
  "isbn_13": "978-0544003415"
}
```

### Why Denormalize?

This design choice provides:

1. **Performance**: Direct author search without joining works
   ```sql
   -- Fast: Single table scan
   SELECT * FROM editions
   WHERE author_keys @> ARRAY['/authors/OL23919A']::text[];
   ```

2. **Simplicity**: Easier to index and query
   ```json
   {
     "query": {
       "match": {
         "author_keys": "/authors/OL23919A"
       }
     }
   }
   ```

3. **Consistency**: Author reference in one place

### Trade-offs

**Advantages**:
- Faster searches for editions by author
- No multi-level joins required
- Simpler Elasticsearch queries

**Disadvantages**:
- Redundant data storage
- Must keep in sync with work data
- Update complexity if author changes

Echo Alexandria updates `author_keys` in editions whenever works are updated.

## Reference Resolution

### What Is It?

Reference resolution means converting OpenLibrary keys into human-readable display data. For example:

**Raw data**:
```
author_keys: ["/authors/OL23919A"]
```

**Resolved data**:
```
authors: [
  {
    key: "/authors/OL23919A",
    name: "J.R.R. Tolkien"
  }
]
```

### How Echo Alexandria Does It

**During Import**:
1. Load all authors into PostgreSQL
2. Create in-memory lookup table for frequently accessed authors
3. When importing works, resolve author_keys to author names
4. Store both key and name in works table

**During Query**:
1. Return author_keys from database
2. Look up author details from cache or separate query
3. Present resolved data to API client

**In Elasticsearch**:
1. Store both author_keys and author_names fields
2. Index both for search functionality
3. Return resolved data in search results

### Database Schema Pattern

```sql
-- Works table stores key and name
CREATE TABLE works (
  id BIGINT PRIMARY KEY,
  ol_key TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  author_keys TEXT[] NOT NULL,        -- ["/authors/OL23919A"]
  author_names TEXT[] NOT NULL,       -- ["J.R.R. Tolkien"]
  last_modified TIMESTAMP
);

-- Quick resolution without join
SELECT author_keys, author_names FROM works
WHERE ol_key = '/works/OL45804W';
```

## Orphaned Records

### What Is an Orphaned Record?

An orphaned edition is one that references a non-existent work:

```json
{
  "title": "Mystery Book",
  "work_keys": ["/works/OL99999999W"],  // This work doesn't exist in dump
  "isbn_13": "978-0000000000"
}
```

### Common Causes

1. **Import timing**: Edition imported before its work
2. **Data quality**: Work was deleted or hidden in OpenLibrary
3. **Incomplete dumps**: Work exists but not in this month's dump
4. **System issues**: Network error during work import

### How Echo Alexandria Handles Orphaned Records

**During Import**:
1. Import works first, then editions
2. Validate work_keys reference exist before indexing
3. Log warnings for orphaned editions

**In Database**:
```sql
-- Find orphaned editions
SELECT e.* FROM editions e
WHERE NOT EXISTS (
  SELECT 1 FROM works w
  WHERE w.ol_key = ANY(e.work_keys)
);
```

**Search Impact**:
- Orphaned editions still appear in search (searchable by title, ISBN)
- Cannot be browsed via work relationships
- Special handling in API responses

## Data Integrity Considerations

### Consistency Checks

Echo Alexandria performs regular consistency checks:

```sql
-- Check all author references are valid
SELECT COUNT(*) FROM works w
WHERE NOT EXISTS (
  SELECT 1 FROM authors a
  WHERE a.ol_key = ANY(w.author_keys)
);

-- Check all work references are valid
SELECT COUNT(*) FROM editions e
WHERE NOT EXISTS (
  SELECT 1 FROM works w
  WHERE w.ol_key = ANY(e.work_keys)
);
```

### Handling Inconsistencies

If issues are found:

1. Log the problem with specific record IDs
2. Leave records in place (don't delete)
3. Mark for manual review
4. Implement filters in API responses if needed

### Update Cascades

When records are updated, related records may need updates:

```
Author updated
  → No cascade needed (author data is independent)

Work updated (title, author_keys)
  → Update denormalized author_keys in editions
  → Reindex all related editions

Edition updated
  → Only that edition needs reindexing
```

## Relationship Diagrams

### Simple Hierarchy

```
┌────────────┐
│   Author   │
│ Tolkien    │
└──────┬─────┘
       │ writes
       ▼
┌────────────┐        ┌────────────┐        ┌────────────┐
│    Work    │◄───────│    Work    │───────►│    Work    │
│ Fellowship │        │  Two Tower │        │    King    │
└──────┬─────┘        └──────┬─────┘        └──────┬─────┘
       │ published            │ published           │ published
       ▼                      ▼                      ▼
┌────────────┐        ┌────────────┐        ┌────────────┐
│  Edition   │        │  Edition   │        │  Edition   │
│ 2012 HMH   │        │ 2011 Penguin        │ 1954 A&U   │
└────────────┘        └────────────┘        └────────────┘
```

### Co-Authorship

```
     ┌──────────────┐
     │   Tolkien    │
     └───────┬──────┘
             │
             ▼
    ┌─────────────────────┐
    │    Co-Edited Work   │
    │  Essays for Charles │
    └─────────────────────┘
             ▲
             │
     ┌───────┴──────┐
     │   C.S. Lewis │
     └──────────────┘
```

### Denormalization Pattern

```
Database Structure:
┌──────────┐         ┌──────────┐
│  Works   │         │ Editions │
├──────────┤         ├──────────┤
│ author_  │────────►│ author_  │
│ keys     │ Denorm  │ keys     │
│ [A123]   │◄────────│ [A123]   │
└──────────┘         └──────────┘

Query Path:
Edition → Direct lookup of author_keys
No join to Works needed
```

## Common Query Patterns

### Find All Works by Author

```sql
SELECT * FROM works
WHERE author_keys @> ARRAY['/authors/OL23919A']::text[]
ORDER BY first_publish_date;
```

### Find All Editions of a Work

```sql
SELECT * FROM editions
WHERE work_keys @> ARRAY['/works/OL45804W']::text[]
ORDER BY publish_date DESC;
```

### Find All Editions by Author (Direct)

```sql
SELECT * FROM editions
WHERE author_keys @> ARRAY['/authors/OL23919A']::text[]
ORDER BY publish_date DESC;
```

### Find All Editions by Author (Via Work)

```sql
SELECT e.* FROM editions e
JOIN works w ON w.ol_key = ANY(e.work_keys)
WHERE w.author_keys @> ARRAY['/authors/OL23919A']::text[]
ORDER BY e.publish_date DESC;
```

## Elasticsearch Mapping

The relationships are indexed to support full-text search:

```json
{
  "mappings": {
    "properties": {
      "work_keys": {
        "type": "keyword"
      },
      "author_keys": {
        "type": "keyword"
      },
      "work_names": {
        "type": "text",
        "analyzer": "standard"
      },
      "author_names": {
        "type": "text",
        "analyzer": "standard"
      }
    }
  }
}
```

This enables:
- Exact key matching: `author_keys: "/authors/OL23919A"`
- Name matching: `author_names: "Tolkien"`
- Combined queries: Find all Tolkien works and their editions

## Next Steps

- Learn about the [dump format](./data-format.md) used to store this data
- Understand the [update schedule](./update-schedule.md) for keeping relationships current
- See the [Import API](../api/admin/import-trigger) for details on how relationships are maintained
