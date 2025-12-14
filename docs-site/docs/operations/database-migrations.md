---
title: Database Migrations
sidebar_position: 3
---

# Database Migrations

Managing database schema changes with Drizzle ORM. This guide covers generating, applying, and managing migrations.

## Overview

Echo Alexandria uses [Drizzle ORM](https://orm.drizzle.team) for database schema management. Migrations are TypeScript files that define schema changes and are automatically executed when the application starts.

### Migration Workflow

```
1. Edit schema (src/db/schema.ts)
   ↓
2. Generate migration (bun db:generate)
   ↓
3. Review generated SQL (drizzle folder)
   ↓
4. Push to database (bun db:push) OR auto-run on startup
   ↓
5. Application runs with updated schema
```

## Drizzle Configuration

The `drizzle.config.ts` file defines how migrations are managed:

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",        // Schema definition file
  out: "./drizzle",                    // Migration output directory
  dialect: "postgresql",               // Database type
  dbCredentials: {
    url: process.env.DATABASE_URL!,   // Connection string
  },
});
```

### Key Configuration Values

**schema:** `./src/db/schema.ts`
- Single file containing all table definitions
- Drizzle generates migrations based on changes here
- Never edit generated migrations directly

**out:** `./drizzle`
- Directory where migrations are generated
- Contains `.sql` files (actual SQL) and `.ts` files (metadata)
- Commit to version control
- Do not edit manually

**dialect:** `postgresql`
- Optimizes migrations for PostgreSQL
- Ensures correct SQL syntax and data types

## Migration Commands

### Generate Migrations

Create a new migration file based on schema changes:

```bash
bun db:generate
```

**When to use:**
- After modifying `src/db/schema.ts`
- Before deploying schema changes
- To create a historical record of changes

**Example workflow:**

```bash
# 1. Edit schema.ts to add a new column
# 2. Generate migration
bun db:generate

# 3. Review the generated SQL
cat drizzle/*.sql

# 4. Commit migration to version control
git add drizzle/
git commit -m "Add user email column"
```

### Push to Database

Apply all pending migrations to the database:

```bash
bun db:push
```

**When to use:**
- During initial setup
- When you want to manually apply migrations
- Before running the application

**Important Notes:**
- This is NOT recommended for production
- Can lose data if migrations drop columns
- Should use automatic migration on startup instead

### Automatic Migration on Startup

The application automatically runs migrations when starting:

```bash
bun src/index.ts
```

The startup process runs:
1. Loads environment variables
2. Connects to PostgreSQL
3. Runs `src/db/migrate.ts`
4. Applies all pending migrations
5. Starts the API server

**Migration Logic (migrate.ts):**

```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  console.log("Running migrations...");

  const migrationClient = postgres(process.env.DATABASE_URL, { max: 1 });
  const db = drizzle(migrationClient);

  // Runs all .sql files from ./drizzle folder
  await migrate(db, { migrationsFolder: "./drizzle" });

  await migrationClient.end();

  console.log("Migrations complete!");
}

runMigrations().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
```

### Drizzle Studio

Interactive web interface for viewing and managing your database:

```bash
bun db:studio
```

Opens a browser interface at `http://localhost:5555` showing:
- All tables and their structure
- Data browsing and editing
- Query execution
- Schema visualization

**Use Cases:**
- Debugging schema issues
- Viewing production data (read-only by default)
- Testing queries before deployment
- Understanding data relationships

## Migration Folder Structure

```
drizzle/
├── 0000_initial_schema.sql        # First migration (schema creation)
├── 0000_initial_schema.ts         # Metadata for first migration
├── 0001_add_user_email.sql        # Second migration
├── 0001_add_user_email.ts         # Metadata
├── 0002_update_indexes.sql        # Third migration
└── 0002_update_indexes.ts         # Metadata
```

### Migration File Structure

**SQL File (0001_add_user_email.sql):**
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR NOT NULL
);

CREATE INDEX idx_users_email ON users(email);
```

**TypeScript Metadata (0001_add_user_email.ts):**
```typescript
import { sql } from "drizzle-orm";

export async function up(db) {
  await db.execute(sql`/* ... migration SQL ... */`);
}

export async function down(db) {
  // Rollback logic (if supported)
}
```

## Schema Definition Example

Example schema structure from `src/db/schema.ts`:

```typescript
import { pgTable, serial, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const authors = pgTable("authors", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  birthDate: timestamp("birth_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const works = pgTable("works", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  authorId: integer("author_id").references(() => authors.id),
  createdAt: timestamp("created_at").defaultNow(),
});
```

## Modifying the Schema

### Adding a New Column

```typescript
// src/db/schema.ts
export const authors = pgTable("authors", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  birthDate: timestamp("birth_date"),
  biography: varchar("biography", { length: 5000 }),  // NEW COLUMN
  createdAt: timestamp("created_at").defaultNow(),
});
```

Then generate and apply the migration:

```bash
bun db:generate
# Review the migration SQL
cat drizzle/0003_add_author_biography.sql
```

### Creating a New Table

```typescript
// src/db/schema.ts
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  workId: integer("work_id").references(() => works.id).notNull(),
  rating: integer("rating").notNull(),
  reviewText: varchar("review_text", { length: 2000 }),
  createdAt: timestamp("created_at").defaultNow(),
});
```

Then:

```bash
bun db:generate
bun db:push
```

### Adding Indexes

```typescript
import { index } from "drizzle-orm/pg-core";

export const works = pgTable("works", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  authorId: integer("author_id").references(() => authors.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    titleIdx: index("idx_works_title").on(table.title),
    authorIdx: index("idx_works_author").on(table.authorId),
  };
});
```

## Best Practices

### Do's

- Generate migrations after schema changes
- Review generated SQL before applying
- Test migrations on a development database first
- Commit migration files to version control
- Use descriptive migration names
- Document complex migration logic

### Don'ts

- Never edit migration files manually
- Don't drop tables or columns without backup
- Don't skip migration testing
- Don't delete migration files
- Don't use raw SQL in production migrations without review
- Don't apply untested migrations to production

## Backup Before Migrations

Create a backup before applying migrations to production:

```bash
# Backup PostgreSQL database
docker exec echo_data_db pg_dump -U postgres -d echo_data_source > backup_before_migration.sql

# Backup PostgreSQL volume
docker run --rm -v echo_data_db_data:/data -v $(pwd):/backup \
  postgres:17 tar czf /backup/db_backup_before_migration.tar.gz /data
```

## Rollback Strategies

### If Migration Fails

```bash
# 1. Check PostgreSQL logs
docker logs echo_data_db | tail -20

# 2. Stop the application
docker-compose stop api

# 3. Restore from backup
cat backup_before_migration.sql | \
  docker exec -i echo_data_db psql -U postgres -d echo_data_source

# 4. Remove failed migration file
rm drizzle/0003_failed_migration.sql
rm drizzle/0003_failed_migration.ts

# 5. Restart application
docker-compose start api
```

### If Database Gets Out of Sync

```bash
# 1. Check migration history
docker exec echo_data_db \
  psql -U postgres -d echo_data_source \
  -c "SELECT * FROM \"_drizzle_migrations\";"

# 2. Manually fix sync table
docker exec echo_data_db \
  psql -U postgres -d echo_data_source \
  -c "DELETE FROM \"_drizzle_migrations\" WHERE hash = 'problematic_hash';"

# 3. Re-run migrations
bun src/db/migrate.ts
```

## Development Workflow

### Local Development with Migrations

```bash
# 1. Clone repository
git clone <repo>
cd echo-data-source

# 2. Setup environment
cp .env.example .env

# 3. Start services
docker-compose up -d

# 4. Migrations run automatically on startup
docker logs echo_data_api | grep "Migrations"

# 5. Verify schema was created
docker exec echo_data_db \
  psql -U postgres -d echo_data_source \
  -c "\dt"
```

### Feature Branch Workflow

```bash
# 1. Create feature branch
git checkout -b feature/new-table

# 2. Edit schema.ts
# 3. Generate migration
bun db:generate

# 4. Commit both schema and migration
git add src/db/schema.ts drizzle/
git commit -m "Add reviews table"

# 5. Push and create PR
git push origin feature/new-table

# 6. CI runs migrations on test database
# 7. Merge to main
# 8. Production automatically applies migrations on next deployment
```

## Monitoring Migrations

### Check Migration Status

```bash
# View applied migrations
docker exec echo_data_db \
  psql -U postgres -d echo_data_source \
  -c "SELECT * FROM \"_drizzle_migrations\" ORDER BY installed_on DESC LIMIT 10;"
```

### Migration Logs

```bash
# See migration output in application logs
docker logs -f echo_data_api | grep -i migration

# In production, check application logs
tail -f /var/log/echo-alexandria/app.log | grep -i migration
```

## Scaling Migrations

### For Large Datasets

When adding indexes to large tables:

```bash
# Generate migration
bun db:generate

# Review the migration (may take time on large tables)
cat drizzle/0004_add_large_index.sql

# Schedule during low-traffic period
# Apply with increased maintenance_work_mem
```

### Using CONCURRENTLY for Large Tables

```sql
-- Modify generated migration to use CONCURRENTLY
CREATE INDEX CONCURRENTLY idx_large_table_column
ON large_table(column);
```

## Testing Migrations

### On Development Database

```bash
# 1. Start fresh dev environment
docker-compose down -v
docker-compose up -d

# 2. Migrations auto-run
# 3. Verify schema
docker exec echo_data_db \
  psql -U postgres -d echo_data_source \
  -c "\d+ table_name"
```

## Next Steps

- Configure [Environment Variables](./environment-variables.md)
- Plan [Data Imports](./data-import.md)
- Set up [Monitoring](./monitoring.md)
- Review [Deployment](./deployment.md)
