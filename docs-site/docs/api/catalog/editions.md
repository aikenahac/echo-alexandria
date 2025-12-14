---
title: Catalog Editions
---

# Catalog Editions

Browse all book editions in the database with pagination and optional filtering.

## Endpoint

```
GET /api/catalog/editions
```

## Authentication

No authentication required. This is a public endpoint.

---

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | No | `1` | Page number for pagination |
| `pageSize` | integer | No | `50` | Number of results per page |
| `search` | string | No | - | Optional search filter for edition title |

### Page

Page number for pagination.

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

Optional search filter that matches against the edition `title` field using case-insensitive partial matching.

**Examples:**
```
?search=hobbit          # Find editions with "hobbit" in title
?search=first edition   # Find first editions
?page=1&pageSize=20&search=2024  # Find 2024 editions
```

---

## Response

### Success Response (200 OK)

```json
{
  "data": [
    {
      "key": "/books/OL7353617M",
      "title": "The Hobbit",
      "authorKeys": ["/authors/OL26320A"],
      "isbn10": ["0547928246"],
      "isbn13": ["9780547928241"],
      "publishers": ["Houghton Mifflin Harcourt"],
      "publishDate": "2012",
      "numberOfPages": 300,
      "covers": [6979861]
    },
    {
      "key": "/books/OL7884563M",
      "title": "Harry Potter and the Philosopher's Stone",
      "authorKeys": ["/authors/OL34184A"],
      "isbn10": ["0747532699"],
      "isbn13": ["9780747532699"],
      "publishers": ["Bloomsbury"],
      "publishDate": "1997",
      "numberOfPages": 223,
      "covers": [6975077]
    }
  ],
  "total": 8901,
  "page": 1,
  "pageSize": 50,
  "totalPages": 179
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `data` | object[] | Array of edition objects |
| `total` | number | Total number of editions (for all pages) |
| `page` | number | Current page number |
| `pageSize` | number | Number of results per page |
| `totalPages` | number | Total number of available pages |

### Edition Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `key` | string | OpenLibrary unique identifier (e.g., `/books/OL7353617M`) |
| `title` | string | Edition title |
| `authorKeys` | string[] | Array of author OpenLibrary keys |
| `isbn10` | string[] | Array of ISBN-10 identifiers |
| `isbn13` | string[] | Array of ISBN-13 identifiers |
| `publishers` | string[] | Array of publisher names |
| `publishDate` | string \| null | Publication date (format varies) |
| `numberOfPages` | number \| null | Number of pages in this edition |
| `covers` | number[] | Array of OpenLibrary cover IDs |

### Error Responses

**Server Error (500 Internal Server Error):**
```json
{
  "error": "Failed to list editions"
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
    curl "http://localhost:3001/api/catalog/editions"
    ```
  </TabItem>
  <TabItem value="javascript" label="JavaScript">
    ```javascript
    const response = await fetch('http://localhost:3001/api/catalog/editions');
    const result = await response.json();
    console.log(`Total editions: ${result.total}`);
    console.log(`Page 1 of ${result.totalPages}`);
    console.log(result.data);
    ```
  </TabItem>
  <TabItem value="python" label="Python">
    ```python
    import requests

    response = requests.get('http://localhost:3001/api/catalog/editions')
    result = response.json()
    print(f"Total editions: {result['total']}")
    print(f"Page 1 of {result['totalPages']}")
    print(result['data'])
    ```
  </TabItem>
</Tabs>

### Search for Editions

<Tabs>
  <TabItem value="curl" label="cURL" default>
    ```bash
    curl "http://localhost:3001/api/catalog/editions?search=hobbit&pageSize=10"
    ```
  </TabItem>
  <TabItem value="javascript" label="JavaScript">
    ```javascript
    const response = await fetch(
      'http://localhost:3001/api/catalog/editions?search=hobbit&pageSize=10'
    );
    const result = await response.json();
    result.data.forEach(edition => {
      console.log(`${edition.title} (${edition.key})`);
      console.log(`  ISBN: ${edition.isbn13[0] || edition.isbn10[0]}`);
    });
    ```
  </TabItem>
  <TabItem value="python" label="Python">
    ```python
    response = requests.get(
        'http://localhost:3001/api/catalog/editions',
        params={'search': 'hobbit', 'pageSize': 10}
    )
    result = response.json()
    for edition in result['data']:
        print(f"{edition['title']} ({edition['key']})")
        isbn = edition['isbn13'][0] if edition['isbn13'] else (edition['isbn10'][0] if edition['isbn10'] else 'N/A')
        print(f"  ISBN: {isbn}")
    ```
  </TabItem>
</Tabs>

### Paginate Through All Editions

<Tabs>
  <TabItem value="curl" label="cURL" default>
    ```bash
    # Get page 1
    curl "http://localhost:3001/api/catalog/editions?page=1&pageSize=50"

    # Get page 2
    curl "http://localhost:3001/api/catalog/editions?page=2&pageSize=50"
    ```
  </TabItem>
  <TabItem value="javascript" label="JavaScript">
    ```javascript
    async function getAllEditions(pageSize = 50) {
      let page = 1;
      let allEditions = [];
      let hasMore = true;

      while (hasMore) {
        const response = await fetch(
          `http://localhost:3001/api/catalog/editions?page=${page}&pageSize=${pageSize}`
        );
        const result = await response.json();

        allEditions = allEditions.concat(result.data);
        hasMore = page < result.totalPages;
        page++;
      }

      return allEditions;
    }

    const editions = await getAllEditions();
    console.log(`Loaded ${editions.length} editions`);
    ```
  </TabItem>
  <TabItem value="python" label="Python">
    ```python
    def get_all_editions(page_size=50):
        editions = []
        page = 1
        has_more = True

        while has_more:
            response = requests.get(
                'http://localhost:3001/api/catalog/editions',
                params={'page': page, 'pageSize': page_size}
            )
            result = response.json()
            editions.extend(result['data'])

            has_more = page < result['totalPages']
            page += 1

        return editions

    editions = get_all_editions()
    print(f"Loaded {len(editions)} editions")
    ```
  </TabItem>
</Tabs>

---

## Use Cases

### Find Editions by ISBN

```javascript
async function findEditionByISBN(isbn) {
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(
      `http://localhost:3001/api/catalog/editions?page=${page}&pageSize=100`
    );
    const result = await response.json();

    // Search for ISBN in results
    const found = result.data.find(edition =>
      edition.isbn10.includes(isbn) || edition.isbn13.includes(isbn)
    );

    if (found) return found;

    hasMore = page < result.totalPages;
    page++;
  }

  return null;
}

const edition = await findEditionByISBN('9780547928241');
if (edition) {
  console.log(`Found: ${edition.title}`);
}
```

### Build Publisher Index

```javascript
async function buildPublisherIndex() {
  const index = {};
  let page = 1;

  while (page <= 20) { // Sample first 20 pages
    const response = await fetch(
      `http://localhost:3001/api/catalog/editions?page=${page}&pageSize=100`
    );
    const result = await response.json();

    result.data.forEach(edition => {
      edition.publishers.forEach(publisher => {
        if (!index[publisher]) {
          index[publisher] = [];
        }
        index[publisher].push({
          title: edition.title,
          year: edition.publishDate
        });
      });
    });

    page++;
  }

  return index;
}
```

---

## Cover Images

The `covers` field contains OpenLibrary cover IDs. To display cover images:

```javascript
function getCoverUrl(coverId, size = 'M') {
  // size: S (small), M (medium), L (large)
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
}

// Usage
const edition = result.data[0];
if (edition.covers.length > 0) {
  const coverUrl = getCoverUrl(edition.covers[0], 'L');
  console.log(coverUrl);
  // https://covers.openlibrary.org/b/id/6979861-L.jpg
}
```

---

## Related Endpoints

- **[Search Editions](../search/editions.md)** - Full-text search for editions by title
- **[Catalog Authors](./authors.md)** - Browse authors with pagination
- **[Catalog Works](./works.md)** - Browse works with pagination
