---
title: Bun Guide
description: Learn to develop with Bun in Echo Alexandria
---

# Bun Runtime Guide

Echo Alexandria is built on [Bun](https://bun.sh), a modern JavaScript runtime offering significant performance improvements and developer experience enhancements over Node.js.

## Why Bun?

Bun provides several key advantages for this project:

### Performance

- **3-4x faster startup time** - Ideal for serverless and CLI tools
- **Faster file I/O** - Critical for the data import pipeline
- **Native TypeScript** - No compilation step needed
- **Optimized package manager** - `bun install` is significantly faster than npm/yarn

### All-in-One Runtime

Unlike Node.js which requires external tools, Bun includes:

- **Package manager** - No need for npm or yarn
- **Test runner** - Built-in testing framework
- **Bundler** - Production-ready asset bundling
- **Script runner** - Execute TypeScript directly
- **.env loader** - Automatic environment variable loading
- **Task runner** - Run scripts from package.json

### Developer Experience

- **TypeScript-first** - Write TypeScript, not JavaScript
- **Modern APIs** - `fetch`, `WebSocket`, `ReadableStream` built-in
- **Hot reload** - `--hot` flag for development
- **Better error messages** - Clear, actionable errors

## Installation

### macOS

```bash
curl -fsSL https://bun.sh/install | bash
```

Then add to `~/.zshrc` or `~/.bash_profile`:

```bash
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
```

### Linux

```bash
curl -fsSL https://bun.sh/install | bash
```

Add to `~/.bashrc`:

```bash
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
```

### Windows (WSL2)

```bash
curl -fsSL https://bun.sh/install | bash
```

### Verify Installation

```bash
bun --version
# Output: 1.0.0 (or later)
```

## Key Differences from Node.js

### Environment Variables

**Node.js** requires dotenv:

```typescript
import dotenv from 'dotenv';
dotenv.config();
const dbUrl = process.env.DATABASE_URL;
```

**Bun** loads `.env` automatically:

```typescript
// .env is automatically loaded
const dbUrl = process.env.DATABASE_URL;
```

Configuration in `bunfig.toml`:

```toml
[bun]
env = "load_production"
```

### HTTP Server

**Node.js** with Express:

```typescript
import express from 'express';
const app = express();
app.listen(3000);
```

**Bun** with native APIs:

```typescript
import { Hono } from 'hono';

const app = new Hono();
export default app;
```

Or native Bun.serve():

```typescript
Bun.serve({
  port: 3000,
  fetch(req) {
    return new Response('Hello!');
  },
});
```

### Database Clients

Bun provides native database support:

```typescript
// PostgreSQL
import { sql } from 'bun:sql';
const result = await sql`SELECT * FROM users`;

// SQLite
import { Database } from 'bun:sqlite';
const db = new Database('data.db');

// Redis
import { redis } from 'bun:redis';
await redis.set('key', 'value');
```

Echo Alexandria uses Drizzle ORM which works seamlessly with Bun.

### WebSocket Support

**Bun** has built-in WebSocket support:

```typescript
Bun.serve({
  websocket: {
    open: (ws) => {
      ws.send('Welcome!');
    },
    message: (ws, message) => {
      ws.send(`Echo: ${message}`);
    },
    close: (ws) => {
      // Cleanup
    },
  },
  fetch(req) {
    // Handle HTTP
  },
});
```

## Bun Command Reference

### Package Management

```bash
# Install dependencies from package.json
bun install

# Add a dependency
bun add lodash

# Remove a dependency
bun remove lodash

# Update dependencies
bun update

# Check installed packages
bun pm list
```

### Running Scripts

```bash
# Run a script from package.json
bun run dev
bun run start
bun run build

# Run without script definition
bun run ./src/index.ts
```

### TypeScript Execution

```bash
# Run a TypeScript file directly
bun src/index.ts

# Run with hot reload (watches file changes)
bun --hot src/index.ts

# Debug mode
bun --inspect src/index.ts
```

### Testing

```bash
# Run all tests
bun test

# Run specific test file
bun test src/api/catalog.test.ts

# Watch mode
bun test --watch

# With coverage
bun test --coverage
```

### Building

```bash
# Bundle for production
bun build src/index.ts --outdir dist

# Generate TypeScript declarations
bun build src/index.ts --declaration
```

## Bun APIs Used in Echo Alexandria

### File Operations

Bun provides high-performance file I/O critical for the import pipeline:

```typescript
// Read file
const file = await Bun.file('data.json').text();
const buffer = await Bun.file('data.bin').arrayBuffer();

// Write file
await Bun.write('output.json', JSON.stringify(data));

// Stream operations
const readable = Bun.file('large.jsonl').stream();
for await (const chunk of readable) {
  // Process chunk
}

// File size and metadata
const size = (await Bun.file('data.json').size());
```

Used in `src/import/download.ts` and `src/import/parse.ts` for efficient data handling.

### Native fetch()

```typescript
// Fetch is global, no import needed
const response = await fetch('https://api.example.com/data');
const data = await response.json();
```

Used throughout import pipeline to download OpenLibrary data.

### Child Process

Execute system commands:

```typescript
// Run command and capture output
const result = await Bun.$`ls -la`;
console.log(result.stdout.toString());

// Template strings with variables
const dir = '/tmp';
const output = await Bun.$`find ${dir} -name "*.json"`;
```

### Hash Functions

```typescript
import { hash } from 'bun';

const checksum = hash('data').toString('hex');
```

## Development Workflow

### Starting Development Server

Echo Alexandria includes hot reload support:

```bash
# Start with hot reload (recommended for development)
bun --hot src/index.ts
```

The server automatically restarts when you modify files. Changes are picked up instantly without manual restarts.

### Running Database Commands

```bash
# Run migrations
bun db/migrate.ts

# Generate new migration from schema changes
bun db:generate

# Open visual database browser
bun db:studio
```

### Running Imports

```bash
# Import authors from OpenLibrary
bun src/import/authors.ts

# Import works
bun src/import/works.ts

# Import editions
bun src/import/editions.ts

# Full refresh (orchestrated)
bun src/jobs/refresh.ts
```

## Performance Tips

### File Operations

For large data processing, use Bun's streaming APIs:

```typescript
// Bad: Loads entire file into memory
const data = await Bun.file('huge.jsonl').text();
const lines = data.split('\n');

// Good: Streams line by line
const stream = Bun.file('huge.jsonl').stream();
for await (const line of stream) {
  // Process each line
}
```

### Package Management

Bun's lockfile is superior to npm:

```bash
# Much faster than npm install
bun install

# Lockfile is bun.lockb (binary, smaller and faster)
```

### Hot Reload

Use `--hot` for development but not in production:

```bash
# Development
bun --hot src/index.ts

# Production
bun src/index.ts
```

## Debugging

### Debug Mode

```bash
# Start with debugging enabled
bun --inspect src/index.ts

# Opens Chrome DevTools at chrome://inspect
# Can set breakpoints and inspect variables
```

### Logging

Use console methods freely:

```typescript
console.log('Info message');
console.error('Error message');
console.warn('Warning message');
console.time('operation');
// ... code ...
console.timeEnd('operation');
```

### Stack Traces

Bun provides clear error messages:

```bash
Error: Connection refused
  at Database.connect (db/index.ts:42:15)
  at startServer (index.ts:8:3)
```

## Troubleshooting

### Common Issues

**Issue: "bun: command not found"**

Solution: Add Bun to PATH:

```bash
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# Source your shell config
source ~/.bashrc
```

**Issue: "Cannot find module 'xyz'"**

Solution: Install dependencies:

```bash
bun install
```

**Issue: Dependency conflicts**

Solution: Clean install:

```bash
rm bun.lockb
bun install
```

**Issue: Hot reload not working**

Solution: Ensure `--hot` flag is used:

```bash
bun --hot src/index.ts  # Correct
bun src/index.ts        # Won't watch files
```

## Performance Benchmarks

Comparing Bun vs Node.js 18 on typical tasks:

| Task | Bun | Node.js | Speedup |
|------|-----|---------|---------|
| Startup | 5ms | 120ms | 24x |
| Package Install | 2s | 8s | 4x |
| TypeScript Compile | 20ms | 500ms | 25x |
| File I/O (large) | 45ms | 180ms | 4x |

These improvements compound in data-heavy operations like imports.

## Migration from Node.js

If migrating existing Node.js code to Bun:

1. **Remove dotenv** - Bun loads .env automatically
2. **Update imports** - Use Bun-native APIs when possible
3. **Package manager** - Replace `npm/yarn/pnpm` with `bun`
4. **Testing** - Update to `bun test` if using Jest
5. **Scripts** - Update package.json scripts to use `bun`

Example migration:

```bash
# Before
npm install
npm run dev
npm test

# After
bun install
bun run dev
bun test
```

## Next Steps

- [Local Setup](./local-setup.md) - Set up development environment
- [Project Structure](./project-structure.md) - Understand the codebase
- [Bun Documentation](https://bun.sh/docs) - Official Bun docs
- [Hono Documentation](https://hono.dev) - Framework docs used in Echo Alexandria

---

Bun's performance and developer experience make it ideal for building modern applications. Explore its capabilities as you develop Echo Alexandria!
