---
title: Project Structure
description: Understanding the Echo Alexandria codebase organization
---

# Project Structure

Echo Alexandria follows a modular, layered architecture designed for maintainability and scalability. This guide explains the organization and purpose of each directory and key files.

## Overall Directory Layout

```
echo-alexandria/
├── src/                      # Application source code
│   ├── api/                  # HTTP API routes and endpoints
│   ├── db/                   # Database layer with ORM
│   ├── elasticsearch/        # Search engine integration
│   ├── import/               # Data import pipeline
│   ├── jobs/                 # Background job orchestrators
│   └── index.ts              # Application entry point
├── drizzle/                  # Generated database migrations
├── data/                     # Downloaded data files (.gitignored)
├── .github/
│   └── workflows/            # CI/CD pipeline definitions
├── cron/                     # Scheduled job scripts
├── docker-compose.yaml       # Container orchestration
├── .env.example              # Environment variable template
├── tsconfig.json             # TypeScript configuration
├── package.json              # Dependencies and scripts
├── bunfig.toml               # Bun runtime configuration
├── drizzle.config.ts         # Drizzle ORM configuration
├── CLAUDE.md                 # AI assistant guidelines
└── README.md                 # Project overview
```

## Source Code Directories

### `/src/api/` - HTTP API Layer

Handles all HTTP requests and responses using Hono.js framework.

```
src/api/
├── server.ts          # Main server setup and routing
├── middleware.ts      # Request/response middleware
├── catalog.ts         # Book catalog endpoints
├── import-status.ts   # Import progress tracking endpoints
├── types.ts           # Request/response TypeScript types
└── errors.ts          # Error handling and response formats
```

**Key responsibilities:**
- Route definitions and handlers
- Request validation and parsing
- Response formatting and serialization
- Error handling and status codes
- API middleware (logging, CORS, authentication)

**File naming convention:** kebab-case for files

**Example file:** `src/api/catalog.ts`
```typescript
import { Hono } from 'hono';

const catalog = new Hono();

catalog.get('/books/:id', async (c) => {
  // Handle GET request
});

export default catalog;
```

### `/src/db/` - Database Layer

Core database abstraction using Drizzle ORM with PostgreSQL.

```
src/db/
├── schema.ts          # Table definitions and relations
├── migrate.ts         # Migration runner
├── index.ts           # Database client singleton
├── queries.ts         # Pre-built query helpers
└── types.ts           # Exported TypeScript types from schema
```

**Key responsibilities:**
- Define data models and relationships
- Manage migrations and schema versions
- Provide type-safe database access
- Connection pooling and lifecycle management
- Query builders and helpers

**Schema example:** `src/db/schema.ts` snippet
```typescript
import { pgTable, text, integer, relations } from 'drizzle-orm/pg-core';

export const authors = pgTable('authors', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  // ... other fields
});

export const works = pgTable('works', {
  id: integer('id').primaryKey(),
  title: text('title').notNull(),
  authorId: integer('author_id'),
  // ... other fields
});

export const authorsRelations = relations(authors, ({ many }) => ({
  works: many(works),
}));
```

### `/src/elasticsearch/` - Search Layer

Full-text search functionality powered by Elasticsearch.

```
src/elasticsearch/
├── client.ts          # ES client initialization
├── indices.ts         # Index creation and configuration
├── indexing.ts        # Bulk indexing operations
├── search.ts          # Search query builders
└── types.ts           # ES document types
```

**Key responsibilities:**
- Initialize and configure Elasticsearch client
- Create and manage search indices
- Index documents for full-text search
- Build and execute search queries
- Handle search result formatting

**Usage example:**
```typescript
import { search } from './search.ts';

const results = await search('harry potter', {
  offset: 0,
  limit: 20,
  filters: { language: 'en' }
});
```

### `/src/import/` - Data Import Pipeline

Multi-stage pipeline for importing data from OpenLibrary.

```
src/import/
├── download.ts        # Fetch OpenLibrary dumps
├── parse.ts           # JSONL file parsing
├── batch.ts           # Batch database inserts
├── progress.ts        # Track import progress
├── authors.ts         # Author data processing
├── works.ts           # Work data processing
└── editions.ts        # Edition data processing
```

**Pipeline flow:**
1. `download.ts` - Download compressed JSONL from OpenLibrary CDN
2. `parse.ts` - Stream and parse JSONL lines
3. `authors.ts` / `works.ts` / `editions.ts` - Transform and validate data
4. `batch.ts` - Insert in optimized batches
5. `progress.ts` - Track completion and log statistics

**Key responsibilities:**
- Handle large dataset downloads efficiently
- Parse streaming JSON data without loading into memory
- Transform and normalize data for storage
- Validate data integrity
- Track progress and handle interruptions
- Batch insert for performance

**Typical usage:**
```bash
bun src/import/authors.ts    # Import authors
bun src/import/works.ts      # Import works
bun src/import/editions.ts   # Import editions
```

### `/src/jobs/` - Background Jobs

Orchestrators for scheduled and long-running tasks.

```
src/jobs/
└── refresh.ts         # Monthly refresh orchestrator
```

**Current jobs:**
- **refresh.ts** - Orchestrates full data refresh monthly, coordinating author, work, and edition imports with progress tracking and rollback support

**Job responsibilities:**
- Coordinate multiple import stages
- Handle error recovery and rollback
- Track overall progress
- Generate completion reports
- Support scheduling via cron

## Configuration Files

### `tsconfig.json`

TypeScript compiler configuration.

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "lib": ["ES2020"],
    "strict": true,
    "moduleResolution": "bundler",
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

Key settings:
- `strict: true` - Enable all strict type checking
- `target: ES2020` - Modern JavaScript with async/await support
- `module: ES2020` - Modern ES modules

### `drizzle.config.ts`

Drizzle ORM configuration for migrations.

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

### `bunfig.toml`

Bun runtime configuration.

```toml
[bun]
# Automatically load .env file
env = "load_production"
```

### `.env.example`

Template for environment variables. Copy to `.env` for local development.

```bash
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgres://localhost/echo_alexandria_dev

# Elasticsearch
ELASTICSEARCH_HOST=http://localhost:9200

# OpenLibrary
OPENLIBRARY_BASE_URL=https://openlibrary.org
```

## Generated Files

### `/drizzle/` - Database Migrations

Auto-generated migration files by Drizzle Kit.

```
drizzle/
├── 0001_initial_schema.sql
├── 0002_add_author_index.sql
├── meta/
│   ├── 0001_snapshot.json
│   └── 0002_snapshot.json
└── _journal.json
```

Never edit these files manually. Instead:

1. Edit `src/db/schema.ts`
2. Run `bun db:generate`
3. Review the generated SQL
4. Run `bun db:push` to apply

## File Naming Conventions

- **Files**: `kebab-case.ts` (e.g., `catalog.ts`, `import-status.ts`)
- **Classes**: `PascalCase` (e.g., `SearchClient`, `ImportPipeline`)
- **Functions**: `camelCase` (e.g., `parseJsonl`, `insertBatch`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_BATCH_SIZE`)
- **Types**: `PascalCase` (e.g., `BookMetadata`, `SearchResult`)

## Code Organization Patterns

### Separation of Concerns

Each module has a single responsibility:

- **Database layer** handles data access only
- **API layer** handles HTTP concerns only
- **Search layer** handles search indexing/querying only
- **Import layer** handles data transformation only

### Type Safety

All modules export TypeScript types:

```typescript
// From schema
export type Author = typeof authors.$inferSelect;
export type CreateAuthor = typeof authors.$inferInsert;

// From API
export type BookResponse = {
  id: number;
  title: string;
  author: string;
};
```

### Error Handling

Consistent error patterns across modules:

```typescript
interface ApiError {
  code: string;
  message: string;
  status: number;
}

class ImportError extends Error {
  constructor(public stage: string, message: string) {
    super(message);
  }
}
```

## Entry Points

### Server Entry Point: `src/index.ts`

```typescript
import { serve } from '@hono/node-server';
import app from './api/server';

const port = process.env.PORT || 3000;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Server running at http://localhost:${port}`);
});
```

Starts the HTTP server on configured port.

### Import Entry Points

Each import type has its own entry:

```bash
bun src/import/authors.ts     # Import authors
bun src/import/works.ts       # Import works
bun src/import/editions.ts    # Import editions
bun src/jobs/refresh.ts       # Orchestrate full refresh
```

### Database Operations

```bash
bun db/migrate.ts             # Run migrations
bun db:generate              # Generate new migration
bun db:push                  # Apply migrations
bun db:studio                # Open visual database browser
```

## Dependency Graph

The architecture follows a unidirectional dependency flow:

```
api/
  ↓
db/ + elasticsearch/ + import/
  ↓
Node.js runtime + external services
```

- **API** depends on database and search layers
- **Database** and **Search** are independent
- **Import** can run independently or be called by jobs
- **Jobs** orchestrate imports

This design allows:
- Independent module testing
- Easier refactoring and maintenance
- Clear responsibility boundaries
- Reusable components

## Related Documentation

- [Bun Guide](./bun-guide.md) - Runtime-specific features
- [Database Management](./database-management.md) - Schema and migration details
- [API Documentation](/docs/api/overview) - Endpoint specifications
- [Local Setup](./local-setup.md) - Development environment setup

---

Understanding this structure helps you navigate the codebase effectively and contribute new features in the right locations.
