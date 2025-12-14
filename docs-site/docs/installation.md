---
sidebar_position: 3
title: Installation
---

# Installation

Complete guide for installing and deploying Echo Alexandria in different environments.

## System Requirements

Before installing Echo Alexandria, ensure your system meets these requirements:

### Minimum Requirements

- **CPU**: 2 cores
- **RAM**: 8GB (16GB recommended for imports)
- **Disk**: 10GB free space (250GB+ for full OpenLibrary dataset)
- **OS**: Linux, macOS, or Windows with WSL2

### Required Software

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
  <TabItem value="docker" label="Docker (Recommended)" default>
    - **Docker**: Version 20.10 or later
    - **Docker Compose**: Version 2.0 or later

    Verify installation:
    ```bash
    docker --version
    docker-compose --version
    ```
  </TabItem>
  <TabItem value="manual" label="Manual Installation">
    - **Bun**: Latest version (runtime and package manager)
    - **PostgreSQL**: Version 17
    - **Elasticsearch**: Version 8.11.0
    - **Node.js**: Not required (using Bun)

    Verify installation:
    ```bash
    bun --version
    psql --version
    curl http://localhost:9200
    ```
  </TabItem>
</Tabs>

---

## Installation Methods

Choose the installation method that best fits your needs:

### Method 1: Docker Compose (Recommended)

The easiest and most reliable way to run Echo Alexandria.

#### Step 1: Clone Repository

```bash
git clone https://github.com/aikenahac/echo-data-source.git
cd echo-data-source
```

#### Step 2: Configure Environment

Create environment file from example:

```bash
cp .env.example .env
```

Edit `.env` if needed (optional for local development):

```bash
# Database connection
DATABASE_URL=postgresql://postgres:password@localhost:5433/echo_data_source

# Elasticsearch URL
ELASTICSEARCH_URL=http://localhost:9200

# Admin API key for protected endpoints
ADMIN_API_KEY=your-secure-api-key-here

# API server port
PORT=3000
```

:::warning Security Note
For production deployments, **always change** `ADMIN_API_KEY` to a secure random value.
:::

#### Step 3: Start Services

Start all services with a single command:

```bash
docker-compose up -d
```

This will start:
- **PostgreSQL** database on port 5433
- **Elasticsearch** search engine on ports 9200 and 9300
- **Echo Alexandria API** on port 3001

#### Step 4: Verify Installation

Check that all containers are running:

```bash
docker-compose ps
```

Expected output:
```
NAME                      IMAGE                                              STATUS
echo_data_api            ghcr.io/aikenahac/echo-alexandria:master           Up
echo_data_db             postgres:17                                         Up
echo_data_elasticsearch  docker.elastic.co/elasticsearch/elasticsearch:8.11.0  Up
```

Test the API health endpoint:

```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-12-13T10:30:00.000Z"
}
```

#### Step 5: Import Data (Optional)

Import sample data to get started:

```bash
# Import authors (~500MB, takes 5-15 minutes)
docker exec -it echo_data_api bun src/import/authors.ts
```

:::info
See [Data Import](operations/data-import) for more import options and the complete dataset.
:::

---

### Method 2: Manual Installation

For development or when you need more control over the environment.

#### Prerequisites

Install required software:

<Tabs>
  <TabItem value="macos" label="macOS">
    ```bash
    # Install Bun
    curl -fsSL https://bun.sh/install | bash

    # Install PostgreSQL 17
    brew install postgresql@17
    brew services start postgresql@17

    # Install Elasticsearch 8.11
    brew tap elastic/tap
    brew install elastic/tap/elasticsearch-full
    brew services start elasticsearch-full
    ```
  </TabItem>
  <TabItem value="linux" label="Linux (Ubuntu/Debian)">
    ```bash
    # Install Bun
    curl -fsSL https://bun.sh/install | bash

    # Install PostgreSQL 17
    sudo apt-get update
    sudo apt-get install postgresql-17

    # Install Elasticsearch 8.11
    wget -qO - https://artifacts.elastic.co/GPG-KEY-elasticsearch | sudo apt-key add -
    echo "deb https://artifacts.elastic.co/packages/8.x/apt stable main" | sudo tee /etc/apt/sources.list.d/elastic-8.x.list
    sudo apt-get update
    sudo apt-get install elasticsearch=8.11.0
    sudo systemctl start elasticsearch
    ```
  </TabItem>
</Tabs>

#### Installation Steps

1. **Clone and Install Dependencies**

```bash
git clone https://github.com/aikenahac/echo-data-source.git
cd echo-data-source
bun install
```

2. **Configure Environment**

Create `.env` file:

```bash
cp .env.example .env
```

Update with your local settings:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/echo_data_source
ELASTICSEARCH_URL=http://localhost:9200
ADMIN_API_KEY=your-development-key
PORT=3000
```

3. **Create Database**

```bash
# Create database
createdb echo_data_source

# Run migrations (automatic on first start)
bun run migrate
```

4. **Configure Elasticsearch**

Disable security for local development:

```yaml
# /etc/elasticsearch/elasticsearch.yml
xpack.security.enabled: false
discovery.type: single-node
```

Restart Elasticsearch after configuration changes.

5. **Start the Server**

```bash
# Development mode with hot reload
bun run dev

# Production mode
bun run start
```

6. **Verify Installation**

```bash
curl http://localhost:3000/health
```

---

### Method 3: Pre-built Docker Image

Use the pre-built Docker image directly:

```bash
# Pull the latest image
docker pull ghcr.io/aikenahac/echo-alexandria:master

# Run with external PostgreSQL and Elasticsearch
docker run -d \
  --name echo-alexandria \
  -p 3000:3000 \
  -e DATABASE_URL=postgresql://user:pass@postgres-host:5432/db \
  -e ELASTICSEARCH_URL=http://elasticsearch-host:9200 \
  -e ADMIN_API_KEY=your-api-key \
  ghcr.io/aikenahac/echo-alexandria:master
```

:::tip
This method requires existing PostgreSQL and Elasticsearch instances.
:::

---

## Post-Installation

### 1. Import Initial Data

Start with the authors dataset:

<Tabs>
  <TabItem value="docker" label="Docker">
    ```bash
    docker exec -it echo_data_api bun src/import/authors.ts
    ```
  </TabItem>
  <TabItem value="manual" label="Manual">
    ```bash
    bun run import:authors
    ```
  </TabItem>
</Tabs>

### 2. Test the API

Try searching for authors:

```bash
curl "http://localhost:3001/api/search/authors?q=tolkien&limit=5"
```

### 3. Access Database Tools

Open Drizzle Studio to browse the database:

<Tabs>
  <TabItem value="docker" label="Docker">
    ```bash
    docker exec -it echo_data_api bun run db:studio
    ```
  </TabItem>
  <TabItem value="manual" label="Manual">
    ```bash
    bun run db:studio
    ```
  </TabItem>
</Tabs>

Visit `http://localhost:4983` to explore your data.

---

## Troubleshooting

### Docker Compose Issues

**Services won't start:**
```bash
# View logs
docker-compose logs

# Restart services
docker-compose down
docker-compose up -d
```

**Port conflicts:**
```yaml
# Edit docker-compose.yaml to change ports
ports:
  - "5434:5432"  # Change 5433 to 5434
```

### Elasticsearch Connection Issues

**Can't connect to Elasticsearch:**
```bash
# Check Elasticsearch is running
curl http://localhost:9200

# View Elasticsearch logs
docker logs echo_data_elasticsearch

# Check Elasticsearch settings
docker exec echo_data_elasticsearch cat /usr/share/elasticsearch/config/elasticsearch.yml
```

### Database Migration Issues

**Migration fails:**
```bash
# Reset database (WARNING: destroys all data)
docker-compose down -v
docker-compose up -d

# Or manually run migrations
bun run migrate
```

For more troubleshooting help, see the [Troubleshooting Guide](operations/troubleshooting).

---

## Next Steps

Now that Echo Alexandria is installed:

1. **[Configure Environment Variables](./configuration.md)** - Fine-tune your configuration
2. **[Import Complete Dataset](operations/data-import)** - Import works and editions
3. **[Explore the API](api/overview)** - Learn about available endpoints
4. **[Set Up Monitoring](operations/monitoring)** - Monitor your deployment
