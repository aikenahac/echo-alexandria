---
title: Contributing
description: Guidelines for contributing to Echo Alexandria
---

# Contributing to Echo Alexandria

Thank you for your interest in contributing! This guide explains how to contribute code, documentation, and improvements to the Echo Alexandria project.

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Be respectful, constructive, and collaborative in all interactions.

## Getting Started

### 1. Fork the Repository

```bash
# Go to GitHub and fork the repository
# https://github.com/your-org/echo-alexandria

# Clone your fork
git clone https://github.com/your-username/echo-alexandria.git
cd echo-alexandria

# Add upstream remote
git remote add upstream https://github.com/your-org/echo-alexandria.git
```

### 2. Set Up Development Environment

Follow the [Local Setup Guide](./local-setup.md) to configure your development environment.

```bash
# Install dependencies
bun install

# Create development database
createdb echo_alexandria_dev

# Run migrations
bun db/migrate.ts

# Start development server
bun --hot src/index.ts
```

### 3. Create a Feature Branch

```bash
# Update main branch
git fetch upstream
git checkout main
git reset --hard upstream/main

# Create feature branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/bug-description
```

## Branch Naming Convention

Use descriptive branch names following this pattern:

```
feature/user-authentication      # New feature
fix/null-pointer-crash           # Bug fix
docs/api-documentation          # Documentation
refactor/database-queries       # Code improvement
perf/optimize-search-indexing   # Performance improvement
test/add-api-tests              # Tests
```

## Making Changes

### Code Style

Echo Alexandria follows these style guidelines:

#### TypeScript

```typescript
// Use strict mode - no `any` types
export function getAuthor(id: number): Author | null {
  // ...
}

// Proper error handling
try {
  const data = await fetchData();
} catch (error) {
  if (error instanceof NetworkError) {
    // Handle network error
  } else {
    // Handle other errors
    throw error;
  }
}

// Use const/let, avoid var
const MAX_BATCH_SIZE = 1000;
let currentIndex = 0;

// Prefer arrow functions
const processItem = (item: Item): void => {
  // ...
};

// Use optional chaining and nullish coalescing
const value = obj?.property ?? defaultValue;
```

#### Naming Conventions

```typescript
// Files: kebab-case
src/api/catalog.ts
src/db/query-builder.ts

// Variables & Functions: camelCase
const userName = 'Alice';
function getUserById(id: number) {}

// Classes & Types: PascalCase
class SearchClient {}
type AuthorResponse = {
  id: number;
  name: string;
};

// Constants: UPPER_SNAKE_CASE
const MAX_CONNECTIONS = 20;
const DEFAULT_TIMEOUT = 5000;

// Private methods: Leading underscore (convention)
private _formatData(data: unknown): string {}
```

### Formatting

Use Prettier for automatic code formatting:

```bash
# Format single file
bunx prettier --write src/api/catalog.ts

# Format entire project
bunx prettier --write src/

# Check formatting without changes
bunx prettier --check src/
```

Configure in VS Code for automatic on-save formatting (see [Local Setup](./local-setup.md)).

### Linting

Run ESLint to catch errors:

```bash
# Check for linting errors
bunx eslint src/

# Fix auto-fixable errors
bunx eslint src/ --fix
```

## Commit Guidelines

### Commit Message Format

Follow the Conventional Commits specification for clear, semantic commit messages:

```
type(scope): subject

body

footer
```

#### Type

```
feat      - A new feature
fix       - A bug fix
docs      - Documentation only changes
style     - Changes that don't affect code meaning (formatting, whitespace, etc.)
refactor  - Code change that neither fixes a bug nor adds a feature
perf      - Code change that improves performance
test      - Adding or updating tests
chore     - Build process, dependency updates, tooling
ci        - CI/CD configuration changes
```

#### Scope

```
api       - API layer changes
db        - Database layer changes
import    - Import pipeline changes
search    - Search/Elasticsearch changes
```

#### Examples

```
feat(api): add book search endpoint
fix(db): handle null values in author queries
docs(setup): update PostgreSQL installation instructions
refactor(import): extract batch processor to separate module
perf(search): add index on book titles
test(api): add integration tests for catalog endpoints
```

### Commit Best Practices

```bash
# Write clear, descriptive messages
git commit -m "feat(api): add filtering to book catalog endpoint"

# Reference issues in commit body
git commit -m "fix(db): resolve connection timeout issue

This fixes the database connection pooling that would timeout
after extended idle periods.

Fixes #123"

# Keep commits focused and atomic
# Don't mix unrelated changes in one commit

# Avoid overly large commits
# Split into logical, reviewable chunks
```

## Before Submitting a Pull Request

### 1. Update Your Branch

```bash
# Fetch latest changes from upstream
git fetch upstream

# Rebase on latest main
git rebase upstream/main

# Or merge if you prefer
git merge upstream/main
```

### 2. Run Tests

```bash
# Run all tests
bun test

# Run tests for affected modules
bun test src/api/*.test.ts
```

### 3. Format Code

```bash
# Format with Prettier
bunx prettier --write src/

# Fix linting issues
bunx eslint src/ --fix
```

### 4. Build Check

```bash
# Verify TypeScript compilation
bun build src/index.ts --declaration
```

### 5. Verify Database

If schema changes were made:

```bash
# Generate migration
bun db:generate

# Review generated SQL
cat drizzle/latest_migration.sql

# Test migration
bun db:push

# Verify with Drizzle Studio
bun db:studio
```

## Pull Request Process

### 1. Create Pull Request

Push your changes and create a PR on GitHub:

```bash
git push origin feature/your-feature-name
```

Then open a pull request through GitHub web interface.

### 2. PR Title and Description

Use a clear, descriptive PR title and include a detailed description:

```markdown
## Description
Brief description of changes

## Type of Change
- [x] New feature
- [ ] Bug fix
- [ ] Documentation update
- [ ] Breaking change

## Related Issue
Fixes #123

## Changes Made
- Added new API endpoint for book search
- Added comprehensive test coverage
- Updated documentation

## Testing
- [x] Unit tests pass
- [x] Integration tests pass
- [x] Manual testing completed

## Checklist
- [x] Code follows style guidelines
- [x] Self-review completed
- [x] Comments added for complex logic
- [x] Documentation updated
- [x] Tests added for new functionality
- [x] No console errors or warnings
```

### 3. Code Review

- Be open to feedback
- Respond to review comments promptly
- Make requested changes in new commits (don't amend)
- Re-request review after making changes

```bash
# Make changes based on feedback
git add src/api/catalog.ts
git commit -m "address review comments: improve error handling"

# Push changes
git push origin feature/your-feature-name
```

### 4. Merge

Once approved, your PR will be merged to main. Congratulations!

## Development Workflow Example

### Example: Adding a New API Endpoint

```bash
# 1. Create feature branch
git checkout -b feature/add-author-search

# 2. Make changes
# - Edit src/api/catalog.ts to add search endpoint
# - Add search query logic to src/db/queries.ts
# - Create tests in src/api/catalog.test.ts

# 3. Ensure tests pass
bun test src/api/catalog.test.ts

# 4. Format code
bunx prettier --write src/api/catalog.ts
bunx eslint src/api/catalog.ts --fix

# 5. Verify with server
bun --hot src/index.ts
curl http://localhost:3000/api/authors/search?q=austen

# 6. Commit changes
git add src/api/catalog.ts src/db/queries.ts src/api/catalog.test.ts
git commit -m "feat(api): add author search endpoint"

# 7. Push and create PR
git push origin feature/add-author-search
# Open PR on GitHub with description and test results
```

## Writing Documentation

Documentation contributions are highly valued. When adding new features, update relevant documentation:

### Update Existing Docs

```bash
# Documentation lives in docs-site/docs/
docs/
├── development/
│   ├── local-setup.md
│   ├── project-structure.md
│   ├── database-management.md
│   └── ...
├── api/
├── concepts/
└── ...
```

### Documentation Style

```markdown
# Clear Headings

Use clear, descriptive headings for navigation.

## Subheadings

Organize content logically.

### Code Examples

Include practical examples:

\`\`\`typescript
// Code examples should be complete and runnable
const result = await db.select().from(authors);
\`\`\`

:::tip
Use admonitions for helpful tips and important information.
:::

:::warning
Highlight warnings and potential issues.
:::
```

## Reporting Issues

Found a bug or have a feature request?

### Creating an Issue

```markdown
## Description
Clear description of the issue or feature request.

## Steps to Reproduce (for bugs)
1. Step 1
2. Step 2
3. Step 3

## Expected Behavior
What should happen?

## Actual Behavior
What actually happens?

## Environment
- OS: macOS/Linux/Windows
- Bun version: X.X.X
- Node version: X.X.X (if applicable)
- Database: PostgreSQL X.X

## Screenshots
If applicable, add screenshots.

## Additional Context
Any additional information.
```

## Getting Help

- **Questions:** Open a GitHub Discussion
- **Bugs:** Open an Issue with detailed steps to reproduce
- **Security:** Email security@example.com (don't open public issue)
- **General Help:** Check documentation first, then ask in Discussion

## Development Tips

### Useful Commands

```bash
# Start dev server with hot reload
bun --hot src/index.ts

# Run tests in watch mode
bun test --watch

# Check test coverage
bun test --coverage

# Open database browser
bun db:studio

# Generate new migration after schema changes
bun db:generate

# Review application logs
# Dev server prints to stdout
```

### Debugging

```bash
# Start with debugging enabled
bun --inspect src/index.ts

# Opens Chrome DevTools at chrome://inspect
# Set breakpoints and inspect variables

# Or use console methods
console.log('Debug info:', variable);
console.error('Error:', error);
console.time('operation');
// ...
console.timeEnd('operation');
```

### Performance Testing

```bash
# Measure query performance
DATABASE_URL=postgres://... bun --inspect src/import/authors.ts

# Monitor import pipeline
bun src/jobs/refresh.ts 2>&1 | grep -i "duration\|error"
```

## Common Contribution Types

### Bug Fix

1. Create issue describing the bug
2. Create `fix/bug-name` branch
3. Add test that reproduces the bug
4. Fix the bug
5. Verify test passes
6. Create PR with clear description

### New Feature

1. Create issue or discussion proposing feature
2. Create `feature/feature-name` branch
3. Implement feature with tests
4. Update documentation
5. Get feedback in PR
6. Merge when approved

### Documentation

1. Create `docs/description` branch
2. Update relevant documentation files
3. Review for clarity and correctness
4. Create PR
5. Merge when approved

### Performance Improvement

1. Identify performance issue with benchmarks
2. Create `perf/description` branch
3. Implement optimization
4. Verify improvement with benchmarks
5. Add tests to prevent regression
6. Document changes
7. Create PR with performance metrics

## Contributor Recognition

Contributors are recognized in:

- GitHub contributor list
- Project CONTRIBUTORS file
- Release notes for significant contributions
- Project documentation

## License

By contributing to Echo Alexandria, you agree that your contributions will be licensed under the same license as the project (check LICENSE file for details).

## Additional Resources

- [Local Setup Guide](./local-setup.md) - Development environment
- [Project Structure](./project-structure.md) - Codebase organization
- [Testing Guide](./testing.md) - Writing tests
- [Database Guide](./database-management.md) - Database operations
- [Bun Guide](./bun-guide.md) - Runtime information

---

Thank you for contributing to Echo Alexandria! Your efforts help build a better platform for discovering and exploring literature.

If you have any questions, feel free to reach out through GitHub Issues or Discussions.
