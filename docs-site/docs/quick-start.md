---
sidebar_position: 2
title: Quick Start
---

# Quick Start Guide

Get Echo Alexandria up and running in 5 minutes using Docker Compose.

## Prerequisites

Before you begin, ensure you have:

- **Docker** (version 20.10 or later)
- **Docker Compose** (version 2.0 or later)
- **8GB RAM** minimum (16GB recommended for imports)
- **10GB disk space** (250GB+ for full OpenLibrary import)

:::tip
Check your Docker installation:
```bash
docker --version
docker-compose --version
```
:::

## Step 1: Clone the Repository

```bash
git clone https://github.com/aikenahac/echo-data-source.git
cd echo-data-source
```

## Step 2: Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

The default configuration works for local development. Key variables:

```bash
DATABASE_URL=postgresql://postgres:postgres@db:5432/echo_data_source
ELASTICSEARCH_URL=http://elasticsearch:9200
ADMIN_API_KEY=your-secure-api-key-here
PORT=3000
```

:::warning
Change `ADMIN_API_KEY` to a secure value for production!
:::

## Step 3: Start Services

Start all services with Docker Compose:

```bash
docker-compose up -d
```

This starts:
- **PostgreSQL** (port 5433)
- **Elasticsearch** (port 9200)
- **API Server** (port 3001)

## Step 4: Verify Installation

Check that all services are running:

```bash
docker-compose ps
```

Test the health endpoint:

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

## Step 5: Import Sample Data (Optional)

Import authors data to test the system:

```bash
docker exec -it echo_data_api bun src/import/authors.ts
```

:::info
This will download and import all OpenLibrary authors (~500MB). It takes 5-15 minutes depending on your internet speed.
:::

## Step 6: Test the API

Once the import completes, try searching:

```bash
# Search for authors
curl "http://localhost:3001/api/search/authors?q=tolkien&limit=5"

# Search for editions (after importing editions)
curl "http://localhost:3001/api/search/editions?q=hobbit&limit=5"
```

## Quick Test Examples

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
  <TabItem value="curl" label="cURL">
    ```bash
    # Health check
    curl http://localhost:3001/health

    # Search authors
    curl "http://localhost:3001/api/search/authors?q=rowling"

    # Trigger import (requires API key)
    curl -X POST \
      -H "X-API-Key: your-secure-api-key-here" \
      http://localhost:3001/api/admin/import/authors
    ```
  </TabItem>
  <TabItem value="javascript" label="JavaScript">
    ```javascript
    // Health check
    const health = await fetch('http://localhost:3001/health');
    console.log(await health.json());

    // Search authors
    const authors = await fetch(
      'http://localhost:3001/api/search/authors?q=rowling'
    );
    console.log(await authors.json());

    // Trigger import
    const importResponse = await fetch(
      'http://localhost:3001/api/admin/import/authors',
      {
        method: 'POST',
        headers: { 'X-API-Key': 'your-secure-api-key-here' }
      }
    );
    ```
  </TabItem>
  <TabItem value="python" label="Python">
    ```python
    import requests

    # Health check
    health = requests.get('http://localhost:3001/health')
    print(health.json())

    # Search authors
    authors = requests.get(
        'http://localhost:3001/api/search/authors',
        params={'q': 'rowling'}
    )
    print(authors.json())

    # Trigger import
    import_resp = requests.post(
        'http://localhost:3001/api/admin/import/authors',
        headers={'X-API-Key': 'your-secure-api-key-here'}
    )
    ```
  </TabItem>
</Tabs>

## Full Import (Optional)

To import the complete OpenLibrary dataset:

```bash
# Import all data (Authors → Works → Editions)
docker exec -it echo_data_api bun src/jobs/refresh.ts
```

:::danger Large Data Warning
This downloads ~50GB of data and can take **several hours** to complete. Only run this if you need the complete dataset.
:::

## Next Steps

Now that Echo Alexandria is running:

- **[Explore the API](./api/overview.md)** - Learn about all available endpoints
- **[Understand Core Concepts](./concepts/overview.md)** - Learn the data model
- **[Set up for Development](./development/local-setup.md)** - Configure your dev environment
- **[Deploy to Production](./operations/deployment.md)** - Production deployment guide

## Troubleshooting

### Services won't start

```bash
# Check Docker logs
docker-compose logs

# Restart services
docker-compose down
docker-compose up -d
```

### Can't connect to Elasticsearch

```bash
# Check Elasticsearch is running
curl http://localhost:9200

# Check logs
docker logs echo_data_elasticsearch
```

### API returns errors

```bash
# Check API logs
docker logs echo_data_api

# Verify environment variables
docker exec echo_data_api env | grep -E 'DATABASE_URL|ELASTICSEARCH_URL'
```

For more detailed troubleshooting, see the [Troubleshooting Guide](./operations/troubleshooting.md).
