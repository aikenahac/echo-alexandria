# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";

// import .css files directly and it works
import './index.css';

import { createRoot } from "react-dom/client";

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.md`.

---

## Project Overview

Echo Data Source is a backend service that imports and indexes OpenLibrary data dumps (authors, works, editions) into PostgreSQL and Elasticsearch, providing search APIs for a book tracking application.

## Development Commands

### Running the API Server
```bash
bun dev                    # Start the API server (default port 3000)
```

### Database Management (Drizzle ORM)
```bash
bun db:generate           # Generate migration files from schema changes
bun db:push              # Push schema changes directly to database
bun db:studio            # Launch Drizzle Studio GUI at https://local.drizzle.studio
```

### Data Import Scripts
```bash
bun import:authors       # Import authors from OpenLibrary dump
bun import:works         # Import works from OpenLibrary dump
bun import:editions      # Import editions from OpenLibrary dump
bun import:all           # Run full refresh (authors → works → editions)
```

Individual import scripts can also be run directly:
```bash
bun src/import/authors.ts
bun src/import/works.ts
bun src/import/editions.ts
bun src/jobs/refresh.ts
```

## Architecture

### Data Flow
1. **Import Pipeline**: Downloads OpenLibrary data dumps (gzipped text files) → Streams and parses JSONL → Batch upserts to PostgreSQL → Bulk indexes to Elasticsearch
2. **Search**: API requests → Elasticsearch query → Returns results with relevance scoring
3. **Admin**: Authenticated API triggers → Background import jobs → Job tracking in `import_jobs` table

### Key Components

**Database Layer (`src/db/`)**
- `schema.ts`: Drizzle ORM schema defining 4 tables: `authors`, `works`, `editions`, `import_jobs`
- Uses PostgreSQL with GIN indexes for full-text search and array operations
- Foreign key relationships: editions ↔ works ↔ authors (stored as key arrays, e.g., `["/authors/OL23919A"]`)

**Import System (`src/import/`)**
- `download.ts`: Streams OpenLibrary dumps (~GB files) from URLs, decompresses with gzip
- `parse.ts`: JSONL parser that yields records one at a time (memory efficient)
- `batch.ts`: Batches records (default 1000) for efficient PostgreSQL upserts and Elasticsearch bulk indexing
- `authors.ts`, `works.ts`, `editions.ts`: Type-specific import logic with progress tracking
- Import order matters: Authors → Works → Editions (to satisfy foreign key references)

**Elasticsearch (`src/elasticsearch/`)**
- `client.ts`: Lazy-loaded singleton client with Proxy pattern
- `indices.ts`: Index creation with custom mappings (text fields, keyword arrays)
- `indexing.ts`: Bulk indexing operations with batch optimization
- `search.ts`: Multi-field search with boosting (title^3, other fields^1)

**API Server (`src/api/`)**
- Built with Hono framework (lightweight, fast router)
- `/api/search/editions?q=query&limit=20&offset=0` - Search editions
- `/api/search/authors?q=query&limit=20&offset=0` - Search authors
- `/api/admin/import/:type` - Trigger imports (requires `X-API-Key` header)
- `/health` - Health check endpoint

### Environment Variables

Required variables (see `.env.example`):
- `DATABASE_URL`: PostgreSQL connection string
- `ELASTICSEARCH_URL`: Elasticsearch endpoint
- `ADMIN_API_KEY`: Secret key for admin import endpoints
- `PORT`: API server port (default: 3000)

### Database Schema Notes

All three main tables (`authors`, `works`, `editions`) share this pattern:
- Primary key: `key` (text) - OpenLibrary identifier like `/authors/OL23919A`
- `rawData` (jsonb) - Full original JSON for extensibility
- `lastImported` - Timestamp for tracking freshness
- Array fields use PostgreSQL arrays with GIN indexes for fast lookups
- Full-text search via GIN indexes on `to_tsvector('english', field)`

### Job Tracking

The `import_jobs` table tracks import progress:
- Each import creates a job record with UUID
- Status: "running" | "completed" | "failed"
- Metrics: `recordsProcessed`, `recordsInserted`, `recordsUpdated`
- Updates every 10,000 records for progress monitoring
