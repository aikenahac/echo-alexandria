---
sidebar_position: 4
title: Configuration
---

# Configuration

Comprehensive guide to configuring Echo Alexandria through environment variables.

## Environment Variables

Echo Alexandria is configured entirely through environment variables. All configuration is stored in a `.env` file in the project root.

### Quick Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `ELASTICSEARCH_URL` | Yes | - | Elasticsearch endpoint URL |
| `ADMIN_API_KEY` | Yes | - | API key for admin endpoints |
| `PORT` | No | `3000` | HTTP server port |
| `POSTGRES_USER` | Docker only | `postgres` | PostgreSQL username |
| `POSTGRES_PASSWORD` | Docker only | `postgres` | PostgreSQL password |
| `POSTGRES_DB` | Docker only | `echo_data_source` | PostgreSQL database name |

---

## Core Configuration

### DATABASE_URL

PostgreSQL database connection string.

**Format:**
```
postgresql://[user]:[password]@[host]:[port]/[database]
```

**Examples:**

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
  <TabItem value="docker" label="Docker Compose" default>
    ```bash
    # Connect to PostgreSQL container
    DATABASE_URL=postgresql://postgres:postgres@db:5432/echo_data_source
    ```

    Note: Use service name `db` as the host when running in Docker Compose.
  </TabItem>
  <TabItem value="local" label="Local Development">
    ```bash
    # Connect to local PostgreSQL
    DATABASE_URL=postgresql://postgres:password@localhost:5433/echo_data_source
    ```

    Port `5433` is used to avoid conflicts with local PostgreSQL (default 5432).
  </TabItem>
  <TabItem value="cloud" label="Cloud/Production">
    ```bash
    # Example with connection pooling
    DATABASE_URL=postgresql://user:pass@db.example.com:5432/echo_prod?sslmode=require&pool_max=20
    ```

    For production, use SSL and connection pooling.
  </TabItem>
</Tabs>

**Connection Parameters:**

- `sslmode=require` - Enforce SSL connections (recommended for production)
- `pool_max=20` - Maximum connection pool size
- `connect_timeout=10` - Connection timeout in seconds

:::warning
Never commit credentials to version control. Use secrets management in production.
:::

---

### ELASTICSEARCH_URL

Elasticsearch server endpoint URL.

**Format:**
```
http://[host]:[port]
```

**Examples:**

<Tabs>
  <TabItem value="docker" label="Docker Compose" default>
    ```bash
    # Connect to Elasticsearch container
    ELASTICSEARCH_URL=http://elasticsearch:9200
    ```
  </TabItem>
  <TabItem value="local" label="Local Development">
    ```bash
    # Connect to local Elasticsearch
    ELASTICSEARCH_URL=http://localhost:9200
    ```
  </TabItem>
  <TabItem value="cloud" label="Elastic Cloud">
    ```bash
    # Elastic Cloud with authentication
    ELASTICSEARCH_URL=https://my-deployment.es.us-central1.gcp.cloud.es.io:9243
    ```

    For Elastic Cloud, you'll need to add authentication headers in the code.
  </TabItem>
</Tabs>

**Notes:**

- Default port is `9200`
- Security (xpack.security) is disabled in local development
- For production, configure authentication and SSL

---

### ADMIN_API_KEY

Secret API key required for administrative endpoints.

**Format:**
```
[any-secure-random-string]
```

**Examples:**

<Tabs>
  <TabItem value="dev" label="Development" default>
    ```bash
    # Simple key for development
    ADMIN_API_KEY=dev-key-12345
    ```
  </TabItem>
  <TabItem value="prod" label="Production">
    ```bash
    # Generate secure random key (recommended)
    ADMIN_API_KEY=$(openssl rand -base64 32)

    # Example output:
    # ADMIN_API_KEY=xK8vN2pQ4mR7sT9uW3xY6zA1bC5dE8fG
    ```
  </TabItem>
</Tabs>

**Usage:**

Protected endpoints require the `X-API-Key` header:

```bash
curl -X POST \
  -H "X-API-Key: your-secure-api-key-here" \
  http://localhost:3001/api/admin/import/authors
```

**Protected Endpoints:**
- `POST /api/admin/import/:type` - Trigger imports
- All endpoints under `/api/admin/*`

:::danger Security Warning
**Always** change this from the default value in production. Use a cryptographically secure random string.
:::

---

### PORT

HTTP server port number.

**Default:** `3000`

**Examples:**

```bash
# Use default port
PORT=3000

# Use alternative port
PORT=8080

# Let system assign port
PORT=0
```

**Notes:**

- In Docker Compose, this is the **internal** container port
- The **external** port is mapped in `docker-compose.yaml`:
  ```yaml
  ports:
    - "3001:3000"  # external:internal
  ```

---

## Docker-Specific Variables

These variables are only used when running with Docker Compose. They configure the PostgreSQL container.

### POSTGRES_USER

PostgreSQL superuser name.

**Default:** `postgres`

**Example:**
```bash
POSTGRES_USER=echo_admin
```

This must match the user in `DATABASE_URL`.

---

### POSTGRES_PASSWORD

PostgreSQL superuser password.

**Default:** `postgres`

**Example:**
```bash
POSTGRES_PASSWORD=secure-password-here
```

:::warning
Change this for production deployments!
:::

---

### POSTGRES_DB

PostgreSQL database name to create on initialization.

**Default:** `echo_data_source`

**Example:**
```bash
POSTGRES_DB=echo_alexandria_prod
```

---

## Environment-Specific Examples

### Development (.env.development)

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/echo_data_source

# Elasticsearch
ELASTICSEARCH_URL=http://localhost:9200

# Admin API
ADMIN_API_KEY=dev-key-not-secure

# Server
PORT=3000

# Docker PostgreSQL
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=echo_data_source
```

---

### Production (.env.production)

```bash
# Database with SSL and connection pooling
DATABASE_URL=postgresql://echo_user:${DB_PASSWORD}@prod-db.example.com:5432/echo_prod?sslmode=require&pool_max=50

# Elasticsearch with HTTPS
ELASTICSEARCH_URL=https://prod-es.example.com:9200

# Secure admin API key (generate with: openssl rand -base64 32)
ADMIN_API_KEY=${ADMIN_API_KEY_SECRET}

# Server port
PORT=3000
```

**Production Checklist:**

- [ ] Use strong, unique `ADMIN_API_KEY`
- [ ] Enable SSL for database (`sslmode=require`)
- [ ] Use secrets management (AWS Secrets Manager, Vault, etc.)
- [ ] Never commit `.env.production` to version control
- [ ] Configure database connection pooling
- [ ] Enable Elasticsearch authentication
- [ ] Use HTTPS for all connections

---

### Testing (.env.test)

```bash
# Use test database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/echo_test

# Local Elasticsearch
ELASTICSEARCH_URL=http://localhost:9200

# Test API key
ADMIN_API_KEY=test-key

# Random port
PORT=0
```

---

## Advanced Configuration

### Database Tuning

Optimize PostgreSQL performance by configuring connection strings:

```bash
DATABASE_URL=postgresql://user:pass@host:5432/db?\
  pool_max=20&\
  pool_idle_timeout=30&\
  connect_timeout=10&\
  application_name=echo-alexandria
```

**Parameters:**
- `pool_max` - Maximum connections (default: 10)
- `pool_idle_timeout` - Idle connection timeout in seconds
- `connect_timeout` - Connection timeout in seconds
- `application_name` - Identifier in PostgreSQL logs

---

### Elasticsearch Configuration

For production Elasticsearch with authentication:

```bash
# In code, you would configure:
# - Authentication (API key or username/password)
# - SSL/TLS certificates
# - Request timeouts
# - Retry logic

ELASTICSEARCH_URL=https://prod-es:9200
```

The Echo Alexandria codebase currently uses basic Elasticsearch configuration. For production with authentication, you'll need to modify `src/elasticsearch/client.ts`.

---

## Configuration Validation

Echo Alexandria validates configuration on startup:

**Startup Checks:**
1. ✅ `DATABASE_URL` format is valid
2. ✅ Can connect to PostgreSQL
3. ✅ Can connect to Elasticsearch
4. ✅ `ADMIN_API_KEY` is set
5. ✅ PORT is available

**Example startup output:**
```
[INFO] Starting Echo Alexandria API Server
[INFO] PostgreSQL: Connected to echo_data_source
[INFO] Elasticsearch: Connected to http://elasticsearch:9200
[INFO] Server listening on http://0.0.0.0:3000
```

**Common errors:**
```bash
# Missing DATABASE_URL
Error: DATABASE_URL environment variable is required

# Can't connect to PostgreSQL
Error: Connection refused at localhost:5432

# Can't connect to Elasticsearch
Error: Elasticsearch connection failed
```

---

## Configuration Best Practices

### 1. Use .env Files

Never hardcode configuration in your code:

```bash
# ✅ Good - Use .env
DATABASE_URL=postgresql://...

# ❌ Bad - Hardcoded
const dbUrl = "postgresql://postgres:password@localhost:5432/db"
```

### 2. Template for New Environments

Create `.env.example` with placeholder values:

```bash
DATABASE_URL=postgresql://user:password@host:port/database
ELASTICSEARCH_URL=http://localhost:9200
ADMIN_API_KEY=change-me-in-production
PORT=3000
```

### 3. Secrets Management

For production, use secrets management:

```bash
# Use AWS Secrets Manager
export DATABASE_URL=$(aws secretsmanager get-secret-value \
  --secret-id echo-db-url --query SecretString --output text)

# Use environment variable substitution
DATABASE_URL=postgresql://user:${DB_PASSWORD}@host/db
```

### 4. Document Custom Variables

If you add custom environment variables, document them:

```markdown
### MY_CUSTOM_VAR
Description of what this variable does.
Default: `default-value`
Required: Yes/No
```

---

## Troubleshooting

### Configuration Not Loading

**Problem:** Environment variables not being read

**Solution:**
1. Ensure `.env` file is in project root
2. Bun automatically loads `.env` - no `dotenv` needed
3. Check file permissions: `chmod 600 .env`
4. Verify no syntax errors in `.env`

### Connection Refused

**Problem:** Can't connect to PostgreSQL or Elasticsearch

**Solution:**
```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5433

# Check Elasticsearch is running
curl http://localhost:9200

# Verify host in DATABASE_URL
# Docker: use service name (db, elasticsearch)
# Local: use localhost or 127.0.0.1
```

### Permission Denied

**Problem:** Database permission errors

**Solution:**
```bash
# Grant permissions to database user
psql -c "GRANT ALL PRIVILEGES ON DATABASE echo_data_source TO postgres;"
```

---

## Next Steps

Now that configuration is set up:

1. **[Import Data](operations/data-import)** - Start importing OpenLibrary data
2. **[Monitor Your System](operations/monitoring)** - Set up health checks
3. **[Explore the API](api/overview)** - Start using the API
4. **[Deploy to Production](operations/deployment)** - Production deployment guide
