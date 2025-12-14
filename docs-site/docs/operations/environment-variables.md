---
title: Environment Variables
sidebar_position: 2
---

# Environment Variables

Complete reference for all environment variables used by Echo Alexandria, with configuration examples for different environments.

## Overview

Echo Alexandria uses environment variables for configuration, stored in a `.env` file. Each variable controls a specific aspect of the application behavior.

```bash
# Copy example to create .env file
cp .env.example .env
```

## Environment Variables Reference

### POSTGRES_USER

**Type:** String
**Required:** Yes
**Default:** `postgres`
**Purpose:** PostgreSQL superuser username

Used by the PostgreSQL container during initialization.

```bash
POSTGRES_USER=postgres
```

:::note
This value is only used during initial PostgreSQL setup. Changing it in an existing deployment requires manual database restoration.
:::

### POSTGRES_PASSWORD

**Type:** String
**Required:** Yes
**Default:** `postgres` (example only)
**Purpose:** PostgreSQL superuser password

Used by the PostgreSQL container and by the API to connect to the database.

```bash
POSTGRES_PASSWORD=your-secure-password-here
```

:::danger Security Warning
- Change from default `postgres` immediately
- Use strong passwords with 16+ characters
- Include uppercase, lowercase, numbers, and symbols
- Store securely in production (use secrets manager)
- Never commit `.env` file to version control
:::

### POSTGRES_DB

**Type:** String
**Required:** Yes
**Default:** `echo_data_source`
**Purpose:** Initial PostgreSQL database name

Created automatically when PostgreSQL container first starts.

```bash
POSTGRES_DB=echo_data_source
```

:::info
To use a different database name:
1. Change `POSTGRES_DB` in `.env`
2. Update `DATABASE_URL` to match
3. Recreate the database: `docker-compose down -v && docker-compose up -d`
:::

### DATABASE_URL

**Type:** PostgreSQL Connection String
**Required:** Yes
**Default:** `postgresql://postgres:password@localhost:5433/echo_data_source`
**Purpose:** Complete PostgreSQL connection string for the API

Connection string format:
```
postgresql://[user]:[password]@[host]:[port]/[database]
```

**Docker Compose Example (internal):**
```bash
DATABASE_URL=postgresql://postgres:password@db:5432/echo_data_source
```

**Docker Compose Example (from host):**
```bash
DATABASE_URL=postgresql://postgres:password@localhost:5433/echo_data_source
```

**Production Example:**
```bash
DATABASE_URL=postgresql://echo_user:securePassword123!@db.example.com:5432/echo_data_source
```

:::warning Connection String Rules
- Use appropriate host (db for docker, localhost for host, domain for cloud)
- Port must match Docker port mapping or cloud database port
- Password must match POSTGRES_PASSWORD
- Database name must match POSTGRES_DB
- URL-encode special characters in password: `@` becomes `%40`
:::

### ELASTICSEARCH_URL

**Type:** Elasticsearch HTTP URL
**Required:** Yes
**Default:** `http://localhost:9200`
**Purpose:** Elasticsearch connection endpoint

**Docker Compose Example (internal):**
```bash
ELASTICSEARCH_URL=http://elasticsearch:9200
```

**Docker Compose Example (from host):**
```bash
ELASTICSEARCH_URL=http://localhost:9200
```

**Production with Authentication:**
```bash
ELASTICSEARCH_URL=https://elastic:password@elasticsearch.example.com:9200
```

**Production with TLS:**
```bash
ELASTICSEARCH_URL=https://elastic:password@elasticsearch.example.com:9200
```

:::info Elasticsearch Connection
- Must be reachable from API container/server
- Verify with: `curl $ELASTICSEARCH_URL`
- Include authentication credentials if X-Pack security enabled
- Use HTTPS in production
:::

### ADMIN_API_KEY

**Type:** String (Bearer Token)
**Required:** Yes
**Default:** `your-secure-api-key-here`
**Purpose:** API key for administrative endpoints (imports, management)

Used to protect sensitive administrative operations like triggering imports.

```bash
ADMIN_API_KEY=sk-echo-alexandria-secure-key-1234567890abcdef
```

:::warning API Key Security
- Generate strong random keys (32+ characters)
- Use format: `sk-` prefix for easy identification
- Change periodically in production
- Never expose in logs, error messages, or client-side code
- Rotate immediately if compromised
- Use secrets manager in production (AWS Secrets, Azure Key Vault, etc.)
:::

**Key Generation Examples:**

```bash
# Using openssl
openssl rand -hex 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using uuidgen (less secure, for development only)
uuidgen
```

### PORT

**Type:** Integer (1-65535)
**Required:** No
**Default:** `3000`
**Purpose:** API server listening port inside container

The port the API server binds to inside the Docker container. The actual external port is defined in `docker-compose.yaml`.

```bash
PORT=3000
```

:::note Port Mapping
- `PORT` env var: Internal container port (usually 3000)
- `docker-compose.yaml` ports: External host port (usually 3001)
- Example: `- 3001:3000` maps host 3001 to container 3000
:::

**Common Port Configurations:**

| Use Case | PORT | docker-compose port |
|----------|------|-------------------|
| Local development | 3000 | 3001:3000 |
| Container-only | 3000 | 3000:3000 |
| High port requirement | 8080 | 8080:8080 |

## Environment-Specific Examples

### Local Development

```bash
# .env for local development
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=echo_data_source
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/echo_data_source
ELASTICSEARCH_URL=http://localhost:9200
ADMIN_API_KEY=dev-key-only-for-local-testing
PORT=3000
```

:::tip Development Tips
- Use simple passwords locally
- Can use weak API keys for testing
- Use localhost for direct host access
- Commit `.env.example` but never `.env`
:::

### Testing/Staging

```bash
# .env for testing environment
POSTGRES_USER=echo_test
POSTGRES_PASSWORD=testPassword123!@#
POSTGRES_DB=echo_data_staging
DATABASE_URL=postgresql://echo_test:testPassword123!@#@staging-db.internal:5432/echo_data_staging
ELASTICSEARCH_URL=https://staging-es.internal:9200
ADMIN_API_KEY=sk-staging-test-key-abc123def456
PORT=3000
```

### Production

```bash
# .env for production (use secrets manager!)
POSTGRES_USER=echo_prod
POSTGRES_PASSWORD=CHANGE_ME_VERY_SECURE_PASSWORD_HERE
POSTGRES_DB=echo_data_production
DATABASE_URL=postgresql://echo_prod:SECURE_PASSWORD@prod-db.example.com:5432/echo_data_production
ELASTICSEARCH_URL=https://elastic:ES_PASSWORD@prod-es.example.com:9200
ADMIN_API_KEY=sk-prod-secure-api-key-long-random-string
PORT=3000
```

:::danger Production Requirements
- Never hardcode in `.env` file
- Use environment secrets management:
  - Docker Secrets for Docker Swarm
  - Kubernetes Secrets for Kubernetes
  - AWS Secrets Manager for AWS
  - Azure Key Vault for Azure
  - HashiCorp Vault for self-hosted
- Rotate credentials every 90 days
- Audit all secret access
- Use strong TLS/SSL everywhere
:::

## Configuration Validation

### Startup Validation

Echo Alexandria validates environment variables on startup:

```typescript
// Validation happens during server initialization
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

if (!process.env.ELASTICSEARCH_URL) {
  throw new Error("ELASTICSEARCH_URL is not set");
}

if (!process.env.ADMIN_API_KEY) {
  throw new Error("ADMIN_API_KEY is not set");
}
```

### Manual Validation

```bash
# Verify all variables are set
env | grep -E 'POSTGRES|DATABASE|ELASTICSEARCH|ADMIN_API|PORT'

# Test database connection
docker exec -it echo_data_api \
  psql "$DATABASE_URL" -c "SELECT NOW();"

# Test Elasticsearch connection
curl -s "$ELASTICSEARCH_URL" | jq .
```

## Managing Secrets in Production

### Using Docker Compose with Secrets File

```yaml
services:
  api:
    environment:
      DATABASE_URL_FILE: /run/secrets/database_url
      ADMIN_API_KEY_FILE: /run/secrets/admin_api_key

secrets:
  database_url:
    file: ./secrets/database_url.txt
  admin_api_key:
    file: ./secrets/admin_api_key.txt
```

### Using External Configuration

Instead of `.env` file, use cloud provider secrets:

**AWS Secrets Manager:**
```bash
aws secretsmanager get-secret-value --secret-id echo-alexandria/prod | jq '.SecretString' > .env
```

**Docker Compose Override for Production:**
```bash
# docker-compose.yml - development
services:
  api:
    env_file: .env

# docker-compose.prod.yml - production
services:
  api:
    environment:
      DATABASE_URL: ${DATABASE_URL}
      ELASTICSEARCH_URL: ${ELASTICSEARCH_URL}
      ADMIN_API_KEY: ${ADMIN_API_KEY}
```

## Environment Variable Changes

### Applying Changes

After modifying `.env`:

```bash
# Restart services to apply changes
docker-compose down
docker-compose up -d

# Verify changes
docker exec echo_data_api env | grep DATABASE_URL
```

### Safe Credential Rotation

```bash
# 1. Update .env with new credentials
# 2. Update database/Elasticsearch with new passwords
# 3. Restart containers
# 4. Verify services are healthy
# 5. Monitor logs for connection errors
```

:::warning Critical Changes
Never change:
- `POSTGRES_DB` after initial setup without data migration
- `DATABASE_URL` host without updating PostgreSQL
- Database credentials without updating PostgreSQL first

Safe to change anytime:
- `ADMIN_API_KEY`
- `PORT` (with docker-compose.yaml update)
:::

## Debugging Configuration Issues

### Database Connection Fails

```bash
# Check DATABASE_URL format
docker exec echo_data_api bash -c 'echo $DATABASE_URL'

# Test connection
docker exec echo_data_api \
  psql "$DATABASE_URL" -c "SELECT 1;"

# Check PostgreSQL logs
docker logs echo_data_db | grep ERROR
```

### Elasticsearch Connection Fails

```bash
# Verify ELASTICSEARCH_URL is set
docker exec echo_data_api bash -c 'echo $ELASTICSEARCH_URL'

# Test connection
curl -v "$(docker exec echo_data_api bash -c 'echo $ELASTICSEARCH_URL')"

# Check Elasticsearch logs
docker logs echo_data_elasticsearch | grep ERROR
```

### API Key Not Recognized

```bash
# Verify ADMIN_API_KEY is set
docker exec echo_data_api bash -c 'echo $ADMIN_API_KEY'

# Test API key in request
curl -H "X-API-Key: $(docker exec echo_data_api bash -c 'echo $ADMIN_API_KEY')" \
  http://localhost:3001/api/admin/health
```

## Quick Reference Table

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| POSTGRES_USER | Yes | postgres | Superuser name |
| POSTGRES_PASSWORD | Yes | secure-pwd | Change immediately |
| POSTGRES_DB | Yes | echo_data_source | Database name |
| DATABASE_URL | Yes | postgresql://... | Full connection string |
| ELASTICSEARCH_URL | Yes | http://localhost:9200 | Elasticsearch endpoint |
| ADMIN_API_KEY | Yes | sk-xxx... | Protect this value |
| PORT | No | 3000 | Internal container port |

## Next Steps

- Set up [Docker](./docker-setup.md) with your configuration
- Run [Database Migrations](./database-migrations.md)
- Configure [Data Imports](./data-import.md)
- Review [Deployment](./deployment.md) best practices
