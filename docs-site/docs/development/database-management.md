---
title: Database Management
description: Working with Drizzle ORM and PostgreSQL in Echo Alexandria
---

# Database Management

Echo Alexandria uses [Drizzle ORM](https://orm.drizzle.team) for type-safe database access with PostgreSQL. This guide covers schema management, migrations, and common database operations.

## Drizzle ORM Overview

Drizzle provides:

- **Type Safety** - Full TypeScript support with auto-inferred types
- **Zero Overhead** - Compiles to raw SQL, no runtime abstractions
- **Schema-First Design** - Define schema in TypeScript, not SQL
- **Built-in Migrations** - Automatic migration generation
- **Query Builder** - Type-safe SQL query construction
- **Relational Queries** - Built-in support for relationships

## Schema Definition

### Location and Structure

Schemas are defined in `/src/db/schema.ts`:

```typescript
import {
  pgTable,
  integer,
  text,
  timestamp,
  relations,
  index,
  unique,
} from 'drizzle-orm/pg-core';

// Define tables
export const authors = pgTable('authors', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  birthDate: timestamp('birth_date'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  nameIdx: index('authors_name_idx').on(table.name),
}));

export const works = pgTable('works', {
  id: integer('id').primaryKey(),
  title: text('title').notNull(),
  authorId: integer('author_id'),
  publishDate: timestamp('publish_date'),
}, (table) => ({
  authorIdx: index('works_author_id_idx').on(table.authorId),
}));

// Define relationships
export const authorsRelations = relations(authors, ({ many }) => ({
  works: many(works),
}));

export const worksRelations = relations(works, ({ one }) => ({
  author: one(authors, {
    fields: [works.authorId],
    references: [authors.id],
  }),
}));
```

### Column Types

Common PostgreSQL column types in Drizzle:

```typescript
import { pgTable, integer, text, timestamp, boolean, numeric, jsonb } from 'drizzle-orm/pg-core';

const table = pgTable('example', {
  // Integer types
  count: integer('count'),
  bigNum: bigint('big_num', { mode: 'number' }),

  // Text types
  name: text('name'),
  email: text('email').unique(),
  description: text('description'),

  // Date/time
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at'),

  // Boolean
  isActive: boolean('is_active').default(true),

  // Numeric (for decimals)
  price: numeric('price', { precision: 10, scale: 2 }),

  // JSON
  metadata: jsonb('metadata'),
});
```

### Column Modifiers

```typescript
// Constraints
column: text('col').notNull(),                    // NOT NULL
column: integer('col').primaryKey(),              // PRIMARY KEY
column: text('col').unique(),                     // UNIQUE
column: integer('col').references(() => other.id), // FOREIGN KEY

// Defaults
column: timestamp('col').defaultNow(),            // DEFAULT NOW()
column: boolean('col').default(true),             // DEFAULT true
column: text('col').default('N/A'),               // DEFAULT 'N/A'

// Indexes
index('idx_name').on(table.column),              // CREATE INDEX
unique('uk_name').on(table.col1, table.col2),    // UNIQUE constraint
```

## Making Schema Changes

### Step 1: Edit Schema

Modify `/src/db/schema.ts`:

```typescript
// Add a new column to existing table
export const authors = pgTable('authors', {
  // ... existing columns ...
  biography: text('biography'),  // NEW COLUMN
  nationality: text('nationality'),  // NEW COLUMN
});
```

### Step 2: Generate Migration

```bash
bun db:generate
```

This creates a new migration file in `/drizzle/`:

```sql
-- drizzle/0003_add_biography.sql
ALTER TABLE authors ADD COLUMN biography TEXT;
ALTER TABLE authors ADD COLUMN nationality TEXT;
```

Always **review the generated SQL** to ensure correctness.

### Step 3: Apply Migration

```bash
bun db:push
```

The migration is applied to your development database.

### Step 4: Verify Changes

```bash
# In psql
\d authors

# Or with Drizzle Studio
bun db:studio
```

## Migration Workflow

### Automatic Generation

For most schema changes, Drizzle generates migrations automatically:

```bash
# After editing schema.ts
bun db:generate
```

### Manual Migration (Advanced)

For complex migrations not supported by auto-generation:

```bash
# Create an empty migration
bun db:generate --name add_custom_trigger

# Edit the generated SQL file in drizzle/
# Then apply it
bun db:push
```

### Viewing Migrations

All migrations are stored in `/drizzle/`:

```bash
ls drizzle/*.sql
# Output:
# drizzle/0001_initial_schema.sql
# drizzle/0002_add_author_index.sql
# drizzle/0003_add_biography.sql
```

Migration metadata is tracked in `drizzle/_journal.json`.

## Drizzle Studio

Drizzle Studio is a visual database browser and editor:

```bash
bun db:studio
```

This opens a web interface at `http://localhost:4983` where you can:

- Browse tables and columns
- View and edit data
- Create/modify tables visually
- Run SQL queries
- Export data

Perfect for exploring and debugging your database during development.

## Query Patterns

### Basic Queries

#### Select All

```typescript
import { db } from './db';
import { authors } from './db/schema';

// Select all rows
const allAuthors = await db.select().from(authors);
```

#### Select with Filters

```typescript
import { eq, like } from 'drizzle-orm';

// WHERE clause
const author = await db
  .select()
  .from(authors)
  .where(eq(authors.id, 1));

// LIKE search
const byName = await db
  .select()
  .from(authors)
  .where(like(authors.name, '%Shakespeare%'));
```

#### Select Specific Columns

```typescript
// SELECT name, birth_date
const names = await db
  .select({
    name: authors.name,
    birth: authors.birthDate,
  })
  .from(authors);
```

### Insert Operations

#### Basic Insert

```typescript
import { db } from './db';
import { authors } from './db/schema';

const result = await db
  .insert(authors)
  .values({
    id: 1,
    name: 'Jane Austen',
    birthDate: new Date('1775-12-16'),
  });
```

#### Insert with Returning

```typescript
// Get the inserted row back
const [newAuthor] = await db
  .insert(authors)
  .values({
    name: 'George Orwell',
  })
  .returning();

console.log(newAuthor.id); // Auto-generated ID
```

#### Batch Insert

```typescript
const authorsData = [
  { name: 'Author 1', birthDate: new Date('1900-01-01') },
  { name: 'Author 2', birthDate: new Date('1905-01-01') },
  { name: 'Author 3', birthDate: new Date('1910-01-01') },
];

await db.insert(authors).values(authorsData);
```

### Update Operations

#### Basic Update

```typescript
import { eq } from 'drizzle-orm';

await db
  .update(authors)
  .set({ name: 'Updated Name' })
  .where(eq(authors.id, 1));
```

#### Update with Returning

```typescript
const [updated] = await db
  .update(authors)
  .set({ biography: 'New biography' })
  .where(eq(authors.id, 1))
  .returning();
```

### Upsert (Insert or Update)

```typescript
import { sql } from 'drizzle-orm';

await db
  .insert(authors)
  .values({
    id: 1,
    name: 'Jane Austen',
  })
  .onConflictDoUpdate({
    target: authors.id,
    set: {
      name: 'Jane Austen (Updated)',
    },
  });
```

### Delete Operations

```typescript
await db
  .delete(authors)
  .where(eq(authors.id, 1));
```

### Joins

#### Inner Join

```typescript
import { authors, works } from './db/schema';

const results = await db
  .select({
    authorName: authors.name,
    workTitle: works.title,
  })
  .from(authors)
  .innerJoin(works, eq(authors.id, works.authorId));
```

#### Left Join

```typescript
const results = await db
  .select()
  .from(authors)
  .leftJoin(works, eq(authors.id, works.authorId));
```

### Relational Queries

With relationships defined, use relational queries:

```typescript
// Query with relations
const authorsWithWorks = await db.query.authors.findMany({
  with: {
    works: true,
  },
});

// Filtered relations
const author = await db.query.authors.findFirst({
  where: eq(authors.id, 1),
  with: {
    works: {
      where: eq(works.publishDate, new Date('2020-01-01')),
    },
  },
});
```

### Advanced Filters

```typescript
import { or, and, gt, lt, inArray, between } from 'drizzle-orm';

// OR condition
const results = await db
  .select()
  .from(authors)
  .where(or(
    eq(authors.id, 1),
    eq(authors.id, 2),
  ));

// AND condition
const results = await db
  .select()
  .from(authors)
  .where(and(
    gt(authors.id, 0),
    like(authors.name, '%Austen%'),
  ));

// IN operator
const results = await db
  .select()
  .from(authors)
  .where(inArray(authors.id, [1, 2, 3]));

// BETWEEN
const results = await db
  .select()
  .from(authors)
  .where(between(authors.id, 1, 10));
```

### Pagination

```typescript
const limit = 20;
const offset = 0;

const page1 = await db
  .select()
  .from(authors)
  .limit(limit)
  .offset(offset);

const page2 = await db
  .select()
  .from(authors)
  .limit(limit)
  .offset(limit);
```

### Ordering

```typescript
import { desc, asc } from 'drizzle-orm';

// ORDER BY name ASC
const ascending = await db
  .select()
  .from(authors)
  .orderBy(asc(authors.name));

// ORDER BY id DESC
const descending = await db
  .select()
  .from(authors)
  .orderBy(desc(authors.id));
```

### Aggregation

```typescript
import { count, max, min, avg } from 'drizzle-orm';

const stats = await db
  .select({
    total: count(),
    maxId: max(authors.id),
    minId: min(authors.id),
  })
  .from(authors);
```

## Connection Pooling

Echo Alexandria uses optimized connection pooling in `/src/db/index.ts`:

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,              // Maximum connections
  idleTimeoutMillis: 20000,  // 20 second idle timeout
  connectionTimeoutMillis: 10000,  // 10 second connection timeout
});

export const db = drizzle(pool);
```

These settings:
- Keep max 20 connections to avoid resource exhaustion
- Close idle connections after 20 seconds
- Timeout connection attempts after 10 seconds

Adjust these based on your needs, but defaults work for most applications.

## Type Extraction

Drizzle automatically infers types from schema:

```typescript
import { authors } from './schema';

// Type for a single author row (from SELECT)
type Author = typeof authors.$inferSelect;

// Type for creating/inserting an author
type CreateAuthor = typeof authors.$inferInsert;

// Usage in functions
function processAuthor(author: Author) {
  console.log(author.id, author.name);
}

async function createAuthor(data: CreateAuthor) {
  return db.insert(authors).values(data).returning();
}
```

This ensures your functions match your schema without duplicate type definitions.

## Raw SQL

For complex queries not easily expressed with the query builder:

```typescript
import { sql } from 'drizzle-orm';

const result = await db.execute(
  sql`
    SELECT a.name, COUNT(w.id) as work_count
    FROM authors a
    LEFT JOIN works w ON a.id = w.author_id
    GROUP BY a.id
    ORDER BY work_count DESC
  `
);
```

Use raw SQL sparingly - prefer query builder when possible for type safety.

## Testing Database Changes

### Test with Fresh Data

```bash
# Create a test database
createdb echo_alexandria_test

# Run migrations on test database
DATABASE_URL=postgres://localhost/echo_alexandria_test bun db/migrate.ts

# Run your tests
DATABASE_URL=postgres://localhost/echo_alexandria_test bun test
```

### Using Test Fixtures

Load sample data for testing:

```typescript
// test/fixtures.ts
export async function setupTestData() {
  await db.delete(authors);

  await db.insert(authors).values([
    { id: 1, name: 'Test Author 1' },
    { id: 2, name: 'Test Author 2' },
  ]);
}

export async function cleanupTestData() {
  await db.delete(authors);
}
```

## Troubleshooting

### Connection Errors

**Error:** `connect ECONNREFUSED 127.0.0.1:5432`

**Solution:**
- Check PostgreSQL is running: `psql -U postgres -c "SELECT version();"`
- Verify DATABASE_URL in .env: `echo $DATABASE_URL`
- Check port: Default is 5432

### Migration Conflicts

**Error:** `Migration X has already been applied`

**Solution:**
```bash
# Check migration status
psql echo_alexandria_dev -c "SELECT * FROM __drizzle_migrations__;"

# Reset for development (CAREFUL! Deletes all data)
psql echo_alexandria_dev -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
bun db/migrate.ts
```

### Type Errors

**Error:** `Property 'id' does not exist on type 'unknown'`

**Solution:** Ensure types are extracted from schema:

```typescript
// Bad
const result = await db.select().from(authors);
console.log(result[0].id);  // Error

// Good
type Author = typeof authors.$inferSelect;
const result: Author[] = await db.select().from(authors);
console.log(result[0].id);  // OK
```

### Slow Queries

**Issue:** Queries take a long time

**Solution:**
- Add indexes to frequently filtered columns
- Use EXPLAIN to analyze query plans
- Check connection pool isn't exhausted

## Best Practices

1. **Use Types** - Always type your query results
2. **Define Relations** - Use relational queries for complex data
3. **Create Indexes** - Add indexes for frequently queried columns
4. **Review Migrations** - Always review generated SQL before applying
5. **Test Changes** - Use test database to verify migrations
6. **Use Transactions** - Wrap related operations for consistency
7. **Batch Operations** - Use batch insert for large datasets

## Related Documentation

- [Local Setup](./local-setup.md) - Database initialization
- [Project Structure](./project-structure.md) - Database module structure
- [Drizzle Documentation](https://orm.drizzle.team) - Official docs
- [PostgreSQL Documentation](https://www.postgresql.org/docs/) - Database reference

---

Drizzle makes database operations type-safe and enjoyable. Master these patterns and you'll work effectively with Echo Alexandria's data layer.
