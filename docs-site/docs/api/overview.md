---
title: API Overview
---

# API Reference

Complete REST API documentation for Echo Alexandria.

## Overview

Echo Alexandria provides a RESTful API for searching and browsing book data from OpenLibrary. The API is built with Hono and optimized for performance with Elasticsearch-powered search.

### Base URL

```
http://localhost:3001
```

For production deployments, replace with your actual domain.

### Response Format

All responses are JSON with consistent structure:

**Success Response:**
```json
{
  "data": [...],
  "total": 1000,
  "page": 1
}
```

**Error Response:**
```json
{
  "error": "Error message description"
}
```

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| `200` | OK | Request succeeded |
| `400` | Bad Request | Invalid parameters or missing required fields |
| `401` | Unauthorized | Invalid or missing API key |
| `500` | Internal Server Error | Server error occurred |

---

## API Endpoints

### Search Endpoints

Fast full-text search powered by Elasticsearch with relevance ranking.

| Endpoint | Method | Description |
|----------|--------|-------------|
| [`/api/search/editions`](./search/editions.md) | `GET` | Search for book editions by title |
| [`/api/search/authors`](./search/authors.md) | `GET` | Search for authors by name |

**Features:**
- Multi-tier relevance scoring (exact, phrase, prefix, standard)
- Pagination support
- Case-insensitive, accent-insensitive matching
- Fast response times (typically under 100ms)

---

### Catalog Endpoints

Browse complete catalogs with server-side pagination and filtering.

| Endpoint | Method | Description |
|----------|--------|-------------|
| [`/api/catalog/authors`](./catalog/authors.md) | `GET` | List all authors with pagination |
| [`/api/catalog/works`](./catalog/works.md) | `GET` | List all works with pagination |
| [`/api/catalog/editions`](./catalog/editions.md) | `GET` | List all editions with pagination |

**Features:**
- Server-side pagination
- Optional search filtering
- Optimized database queries with indexes
- Configurable page sizes

---

### Admin Endpoints

Protected administrative endpoints for managing imports.

:::warning Authentication Required
All admin endpoints require the `X-API-Key` header with a valid API key.
:::

| Endpoint | Method | Description |
|----------|--------|-------------|
| [`/api/admin/import/:type`](./admin/import-trigger.md) | `POST` | Trigger data import (authors, works, editions) |
| [`/api/admin/import/status/:type`](./admin/import-status.md) | `GET` | Get import job status and progress |

**Authentication:**
```bash
curl -H "X-API-Key: your-api-key" http://localhost:3001/api/admin/...
```

---

### Health Check

| Endpoint | Method | Description |
|----------|--------|-------------|
| [`/health`](./health.md) | `GET` | Service health check |

---

## Authentication

### Public Endpoints

These endpoints are **publicly accessible** without authentication:

- All search endpoints (`/api/search/*`)
- All catalog endpoints (`/api/catalog/*`)
- Health check (`/health`)

### Protected Endpoints

These endpoints require **API key authentication**:

- Admin import trigger (`/api/admin/import/:type`)
- Import status (`/api/admin/import/status/:type`)

**Authentication Method:**

Include the `X-API-Key` header in your requests:

```bash
curl -X POST \
  -H "X-API-Key: your-secure-api-key-here" \
  http://localhost:3001/api/admin/import/authors
```

The API key is configured via the `ADMIN_API_KEY` environment variable. See [Configuration](../configuration.md) for details.

**Security Best Practices:**

- Never expose your API key in client-side code
- Rotate API keys periodically
- Use HTTPS in production
- Store API keys in secrets management systems

---

## CORS Policy

Echo Alexandria enables CORS for all origins to support browser-based applications:

```typescript
// All endpoints accept cross-origin requests
Access-Control-Allow-Origin: *
```

For production, consider restricting CORS to specific domains.

---

## Rate Limiting

:::info
Rate limiting is **not currently implemented**. For production deployments, consider adding rate limiting via a reverse proxy (nginx, Cloudflare, etc.).
:::

---

## Pagination

Both **search** and **catalog** endpoints support pagination, but with different parameter styles.

### Search Endpoints Pagination

Search endpoints use **offset-based** pagination:

**Parameters:**
- `limit` - Number of results per page (default: 20, max: 100)
- `offset` - Number of results to skip (default: 0)

**Example:**
```bash
# Get first page (results 1-20)
GET /api/search/editions?q=harry+potter&limit=20&offset=0

# Get second page (results 21-40)
GET /api/search/editions?q=harry+potter&limit=20&offset=20

# Get third page (results 41-60)
GET /api/search/editions?q=harry+potter&limit=20&offset=40
```

### Catalog Endpoints Pagination

Catalog endpoints use **page-based** pagination:

**Parameters:**
- `pageSize` - Number of results per page (default: 50, max: 100)
- `page` - Page number (default: 1)

**Example:**
```bash
# Get first page
GET /api/catalog/authors?page=1&pageSize=50

# Get second page
GET /api/catalog/authors?page=2&pageSize=50
```

**Response includes pagination metadata:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "totalPages": 200,
    "totalCount": 10000
  }
}
```

---

## Error Handling

### Error Response Format

```json
{
  "error": "Error message describing what went wrong"
}
```

### Common Errors

**Missing Required Parameter:**
```bash
GET /api/search/editions

Response: 400 Bad Request
{
  "error": "Query parameter 'q' is required"
}
```

**Invalid API Key:**
```bash
POST /api/admin/import/authors
X-API-Key: wrong-key

Response: 401 Unauthorized
{
  "error": "Unauthorized"
}
```

**Invalid Import Type:**
```bash
POST /api/admin/import/invalid-type

Response: 400 Bad Request
{
  "error": "Invalid import type"
}
```

**Server Error:**
```bash
Response: 500 Internal Server Error
{
  "error": "Search failed"
}
```

Server errors are logged and should be investigated. Check application logs for details.

---

## API Examples

### Quick Start Examples

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
  <TabItem value="curl" label="cURL" default>
    ```bash
    # Health check
    curl http://localhost:3001/health

    # Search editions
    curl "http://localhost:3001/api/search/editions?q=hobbit&limit=5"

    # Search authors
    curl "http://localhost:3001/api/search/authors?q=tolkien&limit=5"

    # List authors with pagination
    curl "http://localhost:3001/api/catalog/authors?page=1&pageSize=20"

    # Trigger import (requires API key)
    curl -X POST \
      -H "X-API-Key: your-api-key" \
      http://localhost:3001/api/admin/import/authors

    # Check import status
    curl -H "X-API-Key: your-api-key" \
      http://localhost:3001/api/admin/import/status/authors
    ```
  </TabItem>
  <TabItem value="javascript" label="JavaScript/TypeScript">
    ```javascript
    // Health check
    const health = await fetch('http://localhost:3001/health');
    console.log(await health.json());

    // Search editions
    const editions = await fetch(
      'http://localhost:3001/api/search/editions?q=hobbit&limit=5'
    );
    console.log(await editions.json());

    // Search authors
    const authors = await fetch(
      'http://localhost:3001/api/search/authors?q=tolkien&limit=5'
    );
    console.log(await authors.json());

    // Trigger import with API key
    const importResp = await fetch(
      'http://localhost:3001/api/admin/import/authors',
      {
        method: 'POST',
        headers: { 'X-API-Key': 'your-api-key' }
      }
    );
    console.log(await importResp.json());
    ```
  </TabItem>
  <TabItem value="python" label="Python">
    ```python
    import requests

    # Health check
    health = requests.get('http://localhost:3001/health')
    print(health.json())

    # Search editions
    editions = requests.get(
        'http://localhost:3001/api/search/editions',
        params={'q': 'hobbit', 'limit': 5}
    )
    print(editions.json())

    # Search authors
    authors = requests.get(
        'http://localhost:3001/api/search/authors',
        params={'q': 'tolkien', 'limit': 5}
    )
    print(authors.json())

    # Trigger import with API key
    import_resp = requests.post(
        'http://localhost:3001/api/admin/import/authors',
        headers={'X-API-Key': 'your-api-key'}
    )
    print(import_resp.json())
    ```
  </TabItem>
</Tabs>

---

## Client Libraries

Echo Alexandria is a standard REST API that works with any HTTP client.

**Recommended Libraries:**

- **JavaScript/TypeScript**: `fetch` (built-in), `axios`
- **Python**: `requests`, `httpx`
- **Go**: `net/http`, `resty`
- **Ruby**: `httparty`, `faraday`
- **Java**: `OkHttp`, `Apache HttpClient`

---

## Next Steps

Explore specific endpoint documentation:

- **[Search Editions](./search/editions.md)** - Search for books by title
- **[Search Authors](./search/authors.md)** - Search for authors by name
- **[Catalog Endpoints](./catalog/authors.md)** - Browse complete catalogs
- **[Admin Endpoints](./admin/import-trigger.md)** - Manage data imports
- **[Health Check](./health.md)** - Monitor service health
