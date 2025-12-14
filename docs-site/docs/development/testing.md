---
title: Testing
description: Writing and running tests in Echo Alexandria
---

# Testing Guide

Testing is essential for building reliable, maintainable software. This guide covers how to write and run tests for Echo Alexandria using Bun's built-in test runner.

:::note
Testing infrastructure is currently under development. This guide outlines best practices and patterns to follow as testing coverage is implemented.
:::

## Overview

Echo Alexandria uses **Bun's native test runner** for all testing needs:

- **No external test frameworks needed** - Bun includes `bun:test` out of the box
- **Jest-compatible API** - Familiar syntax if you've used Jest
- **Fast execution** - Test files run nearly instantly
- **Parallel execution** - Multiple test files run concurrently by default
- **TypeScript support** - Write tests in TypeScript without compilation

## Test File Convention

Test files follow the naming convention:

```
src/
├── api/
│   ├── catalog.ts
│   ├── catalog.test.ts         # Test file for catalog.ts
│   ├── server.ts
│   └── server.test.ts          # Test file for server.ts
├── db/
│   ├── queries.ts
│   └── queries.test.ts         # Test file for queries.ts
└── import/
    ├── parse.ts
    └── parse.test.ts           # Test file for parse.ts
```

Use `.test.ts` suffix for all test files.

## Basic Test Structure

### Simple Unit Test

```typescript
// src/api/catalog.test.ts
import { test, expect } from 'bun:test';
import { getCatalogEntry } from './catalog';

test('getCatalogEntry returns book metadata', async () => {
  const result = await getCatalogEntry(1);

  expect(result).toBeDefined();
  expect(result.id).toBe(1);
  expect(result.title).toBeString();
});
```

### Test Suite Organization

```typescript
import { test, expect, describe } from 'bun:test';

describe('Catalog API', () => {
  describe('GET /books/:id', () => {
    test('returns book with valid ID', () => {
      // test implementation
    });

    test('returns 404 for unknown ID', () => {
      // test implementation
    });
  });

  describe('POST /books', () => {
    test('creates new book', () => {
      // test implementation
    });

    test('validates required fields', () => {
      // test implementation
    });
  });
});
```

## Running Tests

### Run All Tests

```bash
bun test
```

Runs all `.test.ts` files in the project and prints results.

### Run Specific Test File

```bash
bun test src/api/catalog.test.ts
```

### Watch Mode

```bash
bun test --watch
```

Automatically re-runs tests when files change. Ideal for development.

### Coverage Report

```bash
bun test --coverage
```

Generates coverage statistics showing how much of the code is tested.

### Verbose Output

```bash
bun test --verbose
```

Shows detailed test results and execution times.

## Assertion Patterns

### Basic Assertions

```typescript
import { test, expect } from 'bun:test';

test('assertion examples', () => {
  // Equality
  expect(2 + 2).toBe(4);
  expect({ a: 1 }).toEqual({ a: 1 });

  // Type checks
  expect('hello').toBeString();
  expect(42).toBeNumber();
  expect(true).toBeBoolean();
  expect([1, 2, 3]).toBeArray();
  expect({ a: 1 }).toBeObject();

  // Existence
  expect(value).toBeDefined();
  expect(value).toBeNull();
  expect(value).toBeTruthy();
  expect(value).toBeFalsy();

  // Comparisons
  expect(5).toBeGreaterThan(3);
  expect(3).toBeLessThan(5);
  expect(3).toBeGreaterThanOrEqual(3);

  // Collections
  expect([1, 2, 3]).toContain(2);
  expect('hello world').toContain('world');

  // Pattern matching
  expect('test@example.com').toMatch(/\.com$/);

  // Negation
  expect(false).not.toBe(true);
  expect([1, 2]).not.toContain(3);
});
```

### Exception Testing

```typescript
test('throws error on invalid input', () => {
  expect(() => {
    processData(null);
  }).toThrow();

  expect(() => {
    processData(null);
  }).toThrow('Invalid data');
});

test('async function rejects', async () => {
  await expect(async () => {
    await fetchData('invalid');
  }).rejects.toThrow();
});
```

## Unit Testing Examples

### Testing API Routes

```typescript
// src/api/catalog.test.ts
import { test, expect, describe } from 'bun:test';
import { Hono } from 'hono';
import { getCatalog } from './catalog';

describe('Catalog Routes', () => {
  test('GET /catalog returns list of books', async () => {
    const app = new Hono();
    app.get('/catalog', getCatalog);

    const response = await app.request('/catalog');
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toBeArray();
    expect(data[0]).toHaveProperty('id');
    expect(data[0]).toHaveProperty('title');
  });

  test('handles pagination parameters', async () => {
    const app = new Hono();
    app.get('/catalog', getCatalog);

    const response = await app.request('/catalog?offset=10&limit=5');
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.length).toBeLessThanOrEqual(5);
  });
});
```

### Testing Database Queries

```typescript
// src/db/queries.test.ts
import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { db } from './index';
import { authors } from './schema';

describe('Author Queries', () => {
  beforeEach(async () => {
    // Setup: Clear test data
    await db.delete(authors);
  });

  afterEach(async () => {
    // Cleanup: Remove test data
    await db.delete(authors);
  });

  test('inserts and retrieves author', async () => {
    await db.insert(authors).values({
      id: 1,
      name: 'Test Author',
    });

    const result = await db.query.authors.findFirst();
    expect(result?.name).toBe('Test Author');
  });

  test('filters authors by name', async () => {
    await db.insert(authors).values([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ]);

    const result = await db
      .select()
      .from(authors)
      .where(like(authors.name, 'Alice'));

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Alice');
  });
});
```

### Testing Import Pipeline

```typescript
// src/import/parse.test.ts
import { test, expect } from 'bun:test';
import { parseJsonLine } from './parse';

test('parses valid JSONL line', () => {
  const line = '{"id": 1, "name": "Test"}';
  const result = parseJsonLine(line);

  expect(result).toEqual({ id: 1, name: 'Test' });
});

test('throws on invalid JSON', () => {
  const line = '{invalid json}';

  expect(() => {
    parseJsonLine(line);
  }).toThrow();
});

test('handles empty lines gracefully', () => {
  expect(parseJsonLine('')).toBeNull();
  expect(parseJsonLine('   ')).toBeNull();
});
```

## Integration Testing

### Testing with Database

```typescript
import { test, expect, describe, beforeAll, afterAll } from 'bun:test';
import { db } from './db';
import { authors, works } from './db/schema';
import { searchBooks } from './api/search';

describe('Book Search Integration', () => {
  beforeAll(async () => {
    // Setup test data
    await db.insert(authors).values({
      id: 1,
      name: 'J.K. Rowling',
    });

    await db.insert(works).values({
      id: 1,
      title: 'Harry Potter',
      authorId: 1,
    });
  });

  afterAll(async () => {
    // Cleanup
    await db.delete(works);
    await db.delete(authors);
  });

  test('finds book by title', async () => {
    const results = await searchBooks('Harry');
    expect(results).toHaveLength(1);
    expect(results[0].title).toContain('Harry');
  });
});
```

### Testing API Endpoints

```typescript
import { test, expect, describe } from 'bun:test';
import app from './api/server';

describe('API Endpoints', () => {
  test('GET /health returns 200', async () => {
    const response = await app.request('/health');
    expect(response.status).toBe(200);
  });

  test('GET /api/books returns list', async () => {
    const response = await app.request('/api/books');
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toBeArray();
  });

  test('GET /api/books/:id returns single book', async () => {
    const response = await app.request('/api/books/1');
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('id', 1);
  });

  test('GET /api/books/999 returns 404', async () => {
    const response = await app.request('/api/books/999');
    expect(response.status).toBe(404);
  });
});
```

## Test Fixtures and Setup

### Shared Test Data

```typescript
// test/fixtures.ts
import { db } from '../src/db';
import { authors, works } from '../src/db/schema';

export async function seedAuthors() {
  return db.insert(authors).values([
    { id: 1, name: 'Jane Austen' },
    { id: 2, name: 'Emily Bronte' },
    { id: 3, name: 'Charlotte Bronte' },
  ]);
}

export async function seedWorks() {
  return db.insert(works).values([
    { id: 1, title: 'Pride and Prejudice', authorId: 1 },
    { id: 2, title: 'Emma', authorId: 1 },
    { id: 3, title: 'Wuthering Heights', authorId: 2 },
  ]);
}

export async function cleanupDatabase() {
  await db.delete(works);
  await db.delete(authors);
}
```

Usage in tests:

```typescript
import { test, beforeEach, afterEach } from 'bun:test';
import { seedAuthors, cleanupDatabase } from './fixtures';

test('searches authors', async () => {
  beforeEach(seedAuthors);
  afterEach(cleanupDatabase);

  // test implementation
});
```

## Mocking Patterns

### Mocking External Services

```typescript
import { test, expect, mock } from 'bun:test';
import { fetchAuthorData } from './import/authors';

test('fetches author data with mocked API', async () => {
  // Create a mock fetch
  const mockFetch = mock((url: string) => {
    if (url.includes('author/1')) {
      return Promise.resolve(
        new Response(JSON.stringify({
          id: 1,
          name: 'Mock Author',
        }))
      );
    }
    return Promise.reject(new Error('Not found'));
  });

  // Replace global fetch temporarily
  global.fetch = mockFetch;

  const result = await fetchAuthorData(1);
  expect(result.name).toBe('Mock Author');

  // Verify mock was called
  expect(mockFetch).toHaveBeenCalled();
  expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/author/1');
});
```

### Mocking Database Calls

```typescript
import { test, expect, mock } from 'bun:test';
import { getAuthorBooks } from './db/queries';

test('retrieves author books with mocked DB', async () => {
  const mockQuery = mock((authorId: number) => {
    return Promise.resolve([
      { id: 1, title: 'Book 1', authorId },
      { id: 2, title: 'Book 2', authorId },
    ]);
  });

  const books = await mockQuery(1);
  expect(books).toHaveLength(2);
  expect(mockFetch).toHaveBeenCalledWith(1);
});
```

## Testing Async Code

### Testing Promises

```typescript
test('resolves with correct value', async () => {
  const promise = Promise.resolve('success');
  await expect(promise).resolves.toBe('success');
});

test('rejects with error', async () => {
  const promise = Promise.reject(new Error('failed'));
  await expect(promise).rejects.toThrow('failed');
});
```

### Testing Async Functions

```typescript
test('async function returns data', async () => {
  const result = await fetchData();
  expect(result).toBeDefined();
});

test('async function handles errors', async () => {
  await expect(async () => {
    await riskyOperation();
  }).rejects.toThrow();
});
```

## Snapshot Testing

Snapshot tests verify output hasn't changed unexpectedly:

```typescript
import { test, expect } from 'bun:test';
import { formatAuthorBio } from './utils';

test('formats author bio', () => {
  const bio = formatAuthorBio({
    name: 'Jane Austen',
    born: 1775,
    died: 1817,
  });

  // First run: creates snapshot
  // Subsequent runs: compares against snapshot
  expect(bio).toMatchSnapshot();
});
```

### Updating Snapshots

```bash
# Update all snapshot tests
bun test --update-snapshots

# Or with watch mode
bun test --watch --update-snapshots
```

## Best Practices

### 1. Test Naming

Use clear, descriptive test names:

```typescript
// Bad
test('works', () => {});
test('test 1', () => {});

// Good
test('filterAuthorsByYear returns authors born after specified year', () => {});
test('parseJsonLine throws error on malformed JSON', () => {});
```

### 2. Arrange-Act-Assert Pattern

```typescript
test('calculates total cost correctly', () => {
  // Arrange: Set up test data
  const items = [
    { price: 10, quantity: 2 },
    { price: 5, quantity: 3 },
  ];

  // Act: Execute the function
  const total = calculateTotal(items);

  // Assert: Verify the result
  expect(total).toBe(35);
});
```

### 3. One Assertion Per Test (Usually)

```typescript
// Good: Each test focuses on one thing
test('validates email format', () => {
  expect(validateEmail('valid@example.com')).toBe(true);
});

test('rejects invalid email', () => {
  expect(validateEmail('invalid')).toBe(false);
});

// Avoid: Multiple unrelated assertions
test('validates everything', () => {
  expect(validateEmail('test@example.com')).toBe(true);
  expect(validatePhone('555-1234')).toBe(true);
  expect(validateZip('12345')).toBe(true);
});
```

### 4. Use Hooks Properly

```typescript
import { test, expect, describe, beforeEach, afterEach } from 'bun:test';

describe('Database Operations', () => {
  beforeEach(async () => {
    // Runs before each test
    await setupDatabase();
  });

  afterEach(async () => {
    // Runs after each test
    await cleanupDatabase();
  });

  test('test 1', () => {});
  test('test 2', () => {});
});
```

### 5. Keep Tests Independent

```typescript
// Bad: Test depends on another test
test('step 1 creates user', () => {
  // ...
});

test('step 2 uses user from step 1', () => {
  // depends on step 1 running first
});

// Good: Each test is independent
test('creates user with valid data', () => {
  // Setup own data
  // Execute
  // Assert
});

test('retrieves created user by ID', () => {
  // Setup own data
  // Execute
  // Assert
});
```

## Testing Roadmap

Current testing implementation status:

- [x] Test framework setup (Bun test)
- [ ] Unit test coverage for database queries
- [ ] Unit test coverage for API routes
- [ ] Integration test suite
- [ ] Import pipeline tests
- [ ] Search functionality tests
- [ ] End-to-end test examples
- [ ] CI/CD integration for tests
- [ ] Coverage threshold enforcement (80%+)

## Running Tests in CI/CD

For automated testing in GitHub Actions or other CI systems:

```bash
# Run all tests
bun test

# Run with coverage
bun test --coverage

# Run specific test files
bun test src/api/*.test.ts
bun test src/db/*.test.ts
```

Add to `.github/workflows/test.yml` for CI integration.

## Resources

- [Bun Test Documentation](https://bun.sh/docs/test) - Official test runner docs
- [Testing Best Practices](https://nodejs.org/en/docs/guides/testing/) - General testing principles
- [Test-Driven Development](https://en.wikipedia.org/wiki/Test-driven_development) - Methodology overview

## Next Steps

- [Local Setup](./local-setup.md) - Set up development environment
- [Project Structure](./project-structure.md) - Understand test file organization
- [Contributing](./contributing.md) - Add tests when contributing

---

As testing infrastructure is implemented, refer to this guide for consistent patterns and best practices. Tests are essential for maintaining code quality and preventing regressions.
