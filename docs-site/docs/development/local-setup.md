---
title: Local Setup
description: Set up your Echo Alexandria development environment locally
---

# Local Development Setup

This guide walks you through setting up Echo Alexandria on your local machine for development.

## Prerequisites

Before starting, ensure you have the following installed:

- **Bun 1.0 or later** - The JavaScript runtime and package manager
- **PostgreSQL 17** - Relational database
- **Elasticsearch 8.11** - Search and analytics engine
- **Git** - Version control
- **Node.js 18+** (optional, for other tooling)

:::tip
You can check versions with: `bun --version`, `psql --version`, `curl -s http://localhost:9200 | grep version`
:::

## Installation by Operating System

### macOS (Homebrew)

Install Homebrew if you don't have it:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Install dependencies:

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Install PostgreSQL
brew install postgresql@17

# Install Elasticsearch via Homebrew (community-maintained)
# Or use Docker: docker run -d -p 9200:9200 -e "discovery.type=single-node" docker.elastic.co/elasticsearch/elasticsearch:8.11.0

# Verify installations
bun --version
psql --version
```

Start PostgreSQL (if installed via Homebrew):

```bash
brew services start postgresql@17
```

### Linux (Ubuntu/Debian)

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Install PostgreSQL
sudo apt update
sudo apt install postgresql-17

# Install Elasticsearch
wget -qO - https://artifacts.elastic.co/GPG-KEY-elasticsearch | sudo apt-key add -
echo "deb https://artifacts.elastic.co/packages/8.x/apt stable main" | sudo tee /etc/apt/sources.list.d/elastic-8.x.list
sudo apt update
sudo apt install elasticsearch

# Start services
sudo systemctl start postgresql
sudo systemctl start elasticsearch
```

### Windows (WSL2 Recommended)

For best development experience on Windows, use WSL2 with Ubuntu:

```bash
# In WSL2 Ubuntu terminal:

# Install Bun
curl -fsSL https://bun.sh/install | bash

# Install PostgreSQL
sudo apt update
sudo apt install postgresql-17

# Install Elasticsearch
wget -qO - https://artifacts.elastic.co/GPG-KEY-elasticsearch | sudo apt-key add -
echo "deb https://artifacts.elastic.co/packages/8.x/apt stable main" | sudo tee /etc/apt/sources.list.d/elastic-8.x.list
sudo apt update
sudo apt install elasticsearch

# Start services
sudo service postgresql start
sudo service elasticsearch start
```

## Repository Setup

Clone and initialize the project:

```bash
# Clone the repository
git clone https://github.com/your-org/echo-alexandria.git
cd echo-alexandria

# Install dependencies
bun install
```

## Database Setup

Initialize PostgreSQL:

```bash
# Create the development database
createdb echo_alexandria_dev

# Create the test database (for testing)
createdb echo_alexandria_test

# Navigate to the project and run migrations
cd src
bun db/migrate.ts

# Verify schema was created
psql echo_alexandria_dev -c "\dt"
```

You should see tables like: `authors`, `works`, `editions`, `author_works`, etc.

:::info
Check database status anytime with `psql echo_alexandria_dev -c "\dt"` to list all tables.
:::

## Elasticsearch Setup

Verify Elasticsearch is running:

```bash
curl -s http://localhost:9200 | jq '.version.number'
```

The initial indices will be created when you run the application or import command.

## Environment Configuration

Create your `.env` file from the example:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```bash
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgres://localhost/echo_alexandria_dev

# Elasticsearch
ELASTICSEARCH_HOST=http://localhost:9200

# Import (optional, for data imports)
OPENLIBRARY_BASE_URL=https://openlibrary.org
```

:::warning
Never commit `.env` to version control. It contains sensitive information.
:::

## Running the Development Server

Start the hot-reload development server:

```bash
bun --hot src/index.ts
```

The server will start on `http://localhost:3000`. With `--hot` flag enabled, changes to your code will automatically reload the server.

For a standard run without hot reload:

```bash
bun src/index.ts
```

## Verification Steps

Test that everything works:

1. **Check the server is running:**

```bash
curl http://localhost:3000/health
```

2. **Check database connectivity:**

```bash
psql echo_alexandria_dev -c "SELECT COUNT(*) FROM authors;"
```

3. **Check Elasticsearch connectivity:**

```bash
curl http://localhost:9200/_cluster/health
```

4. **View database with Drizzle Studio:**

```bash
bun db:studio
```

This opens a visual database browser at `http://localhost:4983`.

## IDE Setup

### VS Code (Recommended)

Install these extensions for optimal development:

1. **Bun** - Official Bun extension for debugging and language support
   - Search: `bun` in Extensions
   - Publisher: Oven

2. **Drizzle** - Database schema management
   - Search: `drizzle` in Extensions
   - Provides intellisense for schema definitions

3. **Prettier** - Code formatting
   - Search: `prettier` in Extensions
   - Auto-formats on save (configure in settings)

4. **ESLint** - Linting
   - Search: `eslint` in Extensions
   - Catches errors as you type

Configure VS Code settings (`.vscode/settings.json`):

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

### Other IDEs

- **WebStorm/IntelliJ** - Built-in TypeScript support, install Bun plugin
- **Neovim** - Configure LSP (lspconfig) with TypeScript tools
- **Sublime Text** - Use with TypeScript plugin

## Useful Development Commands

```bash
# Start development server with hot reload
bun --hot src/index.ts

# Run database migrations
bun db/migrate.ts

# Generate new migration after schema changes
bun db:generate

# Open Drizzle Studio (visual DB browser)
bun db:studio

# Import OpenLibrary data
bun src/jobs/refresh.ts          # Full import
bun src/import/authors.ts        # Authors only
bun src/import/works.ts          # Works only
bun src/import/editions.ts       # Editions only

# View application logs
# The dev server prints to stdout
```

## Troubleshooting

### Database Connection Error

**Error:** `connect ECONNREFUSED 127.0.0.1:5432`

**Solution:**
- Ensure PostgreSQL is running: `brew services list` (macOS) or `systemctl status postgresql` (Linux)
- Check DATABASE_URL in `.env` matches your setup
- Verify database exists: `psql -l | grep echo_alexandria_dev`

### Elasticsearch Connection Error

**Error:** `Connection refused - connect ECONNREFUSED 127.0.0.1:9200`

**Solution:**
- Check Elasticsearch is running: `curl http://localhost:9200`
- For Docker: `docker ps | grep elasticsearch`
- Restart if needed: `docker restart <container_id>`

### Port Already in Use

**Error:** `Error: listen EADDRINUSE :::3000`

**Solution:**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 bun --hot src/index.ts
```

### Bun Installation Issues

If Bun fails to install:

```bash
# Manual installation
curl -fsSL https://bun.sh/install | bash

# Add to PATH (add to ~/.bashrc or ~/.zshrc)
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# Reload shell
source ~/.bashrc  # or ~/.zshrc
```

### Migration Conflicts

If you encounter migration errors:

```bash
# Check migration status
bun db:generate

# View applied migrations
psql echo_alexandria_dev -c "SELECT * FROM __drizzle_migrations__;"

# Reset to clean state (development only!)
# WARNING: This deletes all data
psql echo_alexandria_dev -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
bun db/migrate.ts
```

## Next Steps

- Read [Project Structure](./project-structure.md) to understand the codebase
- Check [Bun Guide](./bun-guide.md) for runtime-specific information
- Review [Database Management](./database-management.md) for working with data
- Explore [API Documentation](/docs/api/overview) to understand endpoints

---

Need help? Open an issue on [GitHub](https://github.com/your-org/echo-alexandria/issues) or join our community discussions.
