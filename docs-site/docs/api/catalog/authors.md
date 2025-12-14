---
title: Catalog Authors
---

# Catalog Authors

Browse all authors in the database with pagination and optional filtering.

## Endpoint

```
GET /api/catalog/authors
```

## Authentication

No authentication required. This is a public endpoint.

---

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | No | `1` | Page number for pagination |
| `pageSize` | integer | No | `50` | Number of results per page |
| `search` | string | No | - | Optional search filter for author name or personal name |

### Page

Zero-based pagination page number.

**Examples:**
```
?page=1                 # First page (default)
?page=2                 # Second page
?page=10                # Tenth page
```

### Page Size

Number of results to return per page. Default is 50, typically used for admin interfaces.

**Examples:**
```
?pageSize=10            # 10 results per page
?pageSize=50            # 50 results per page (default)
?pageSize=100           # 100 results per page
```

### Search

Optional search filter that matches against both author `name` and `personalName` fields using case-insensitive partial matching.

**Examples:**
```
?search=tolkien         # Find authors with "tolkien" in name
?search=rowling         # Find authors with "rowling" in name
?page=1&pageSize=20&search=smith  # Combine with pagination
```

---

## Response

### Success Response (200 OK)

```json
{
  "data": [
    {
      "key": "/authors/OL26320A",
      "name": "J. R. R. Tolkien",
      "personalName": "John Ronald Reuel Tolkien",
      "birthDate": "3 January 1892",
      "deathDate": "2 September 1973",
      "photos": [6917219]
    },
    {
      "key": "/authors/OL34184A",
      "name": "J. K. Rowling",
      "personalName": "Joanne Murray",
      "birthDate": "31 July 1965",
      "deathDate": null,
      "photos": []
    }
  ],
  "total": 1234,
  "page": 1,
  "pageSize": 50,
  "totalPages": 25
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `data` | object[] | Array of author objects |
| `total` | number | Total number of authors (for all pages) |
| `page` | number | Current page number |
| `pageSize` | number | Number of results per page |
| `totalPages` | number | Total number of available pages |

### Author Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `key` | string | OpenLibrary unique identifier (e.g., `/authors/OL26320A`) |
| `name` | string | Author's display name |
| `personalName` | string \| null | Author's full personal name (if different from display name) |
| `birthDate` | string \| null | Birth date in OpenLibrary format |
| `deathDate` | string \| null | Death date in OpenLibrary format, `null` if living |
| `photos` | number[] | Array of OpenLibrary photo IDs |

### Error Responses

**Invalid Page (400 Bad Request):**
```json
{
  "error": "Failed to list authors"
}
```

**Server Error (500 Internal Server Error):**
```json
{
  "error": "Failed to list authors"
}
```

---

## Examples

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

### Get First Page

<Tabs>
  <TabItem value="curl" label="cURL" default>
    ```bash
    curl "http://localhost:3001/api/catalog/authors"
    ```
  </TabItem>
  <TabItem value="javascript" label="JavaScript">
    ```javascript
    const response = await fetch('http://localhost:3001/api/catalog/authors');
    const result = await response.json();
    console.log(`Total authors: ${result.total}`);
    console.log(`Page 1 of ${result.totalPages}`);
    console.log(result.data);
    ```
  </TabItem>
  <TabItem value="python" label="Python">
    ```python
    import requests

    response = requests.get('http://localhost:3001/api/catalog/authors')
    result = response.json()
    print(f"Total authors: {result['total']}")
    print(f"Page 1 of {result['totalPages']}")
    print(result['data'])
    ```
  </TabItem>
</Tabs>

### Search for Authors

<Tabs>
  <TabItem value="curl" label="cURL" default>
    ```bash
    curl "http://localhost:3001/api/catalog/authors?search=tolkien&pageSize=10"
    ```
  </TabItem>
  <TabItem value="javascript" label="JavaScript">
    ```javascript
    const response = await fetch(
      'http://localhost:3001/api/catalog/authors?search=tolkien&pageSize=10'
    );
    const result = await response.json();
    result.data.forEach(author => {
      console.log(`${author.name} (${author.key})`);
    });
    ```
  </TabItem>
  <TabItem value="python" label="Python">
    ```python
    response = requests.get(
        'http://localhost:3001/api/catalog/authors',
        params={'search': 'tolkien', 'pageSize': 10}
    )
    result = response.json()
    for author in result['data']:
        print(f"{author['name']} ({author['key']})")
    ```
  </TabItem>
</Tabs>

### Pagination Through Results

<Tabs>
  <TabItem value="curl" label="cURL" default>
    ```bash
    # Get page 1
    curl "http://localhost:3001/api/catalog/authors?page=1&pageSize=20"

    # Get page 2
    curl "http://localhost:3001/api/catalog/authors?page=2&pageSize=20"

    # Get page 3
    curl "http://localhost:3001/api/catalog/authors?page=3&pageSize=20"
    ```
  </TabItem>
  <TabItem value="javascript" label="JavaScript">
    ```javascript
    async function getAllAuthors(pageSize = 50) {
      let page = 1;
      let allAuthors = [];
      let hasMore = true;

      while (hasMore) {
        const response = await fetch(
          `http://localhost:3001/api/catalog/authors?page=${page}&pageSize=${pageSize}`
        );
        const result = await response.json();

        allAuthors = allAuthors.concat(result.data);
        hasMore = page < result.totalPages;
        page++;
      }

      return allAuthors;
    }

    const authors = await getAllAuthors();
    console.log(`Loaded ${authors.length} authors`);
    ```
  </TabItem>
  <TabItem value="python" label="Python">
    ```python
    def get_all_authors(page_size=50):
        authors = []
        page = 1
        has_more = True

        while has_more:
            response = requests.get(
                'http://localhost:3001/api/catalog/authors',
                params={'page': page, 'pageSize': page_size}
            )
            result = response.json()
            authors.extend(result['data'])

            has_more = page < result['totalPages']
            page += 1

        return authors

    authors = get_all_authors()
    print(f"Loaded {len(authors)} authors")
    ```
  </TabItem>
</Tabs>

---

## Use Cases

### Admin Dashboard Author Management

```javascript
async function loadAuthorTable(page = 1, searchTerm = '') {
  const params = {
    page,
    pageSize: 25,
    ...(searchTerm && { search: searchTerm })
  };

  const queryString = new URLSearchParams(params).toString();
  const response = await fetch(`http://localhost:3001/api/catalog/authors?${queryString}`);
  const result = await response.json();

  return {
    rows: result.data,
    pagination: {
      current: result.page,
      total: result.totalPages,
      perPage: result.pageSize,
      totalRecords: result.total
    }
  };
}
```

### Export Authors to CSV

```javascript
async function exportAuthorsToCSV() {
  let page = 1;
  const pageSize = 100;
  let hasMore = true;
  const csvRows = [];

  while (hasMore) {
    const response = await fetch(
      `http://localhost:3001/api/catalog/authors?page=${page}&pageSize=${pageSize}`
    );
    const result = await response.json();

    result.data.forEach(author => {
      csvRows.push([
        author.key,
        author.name,
        author.personalName || '',
        author.birthDate || '',
        author.deathDate || ''
      ]);
    });

    hasMore = page < result.totalPages;
    page++;
  }

  return csvRows;
}
```

---

## Related Endpoints

- **[Search Authors](../search/authors.md)** - Full-text search for authors by name
- **[Catalog Works](./works.md)** - Browse works with pagination
- **[Catalog Editions](./editions.md)** - Browse editions with pagination
