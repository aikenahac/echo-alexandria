---
title: Catalog Works
---

# Catalog Works

Browse all literary works in the database with pagination and optional filtering.

## Endpoint

```
GET /api/catalog/works
```

## Authentication

No authentication required. This is a public endpoint.

---

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | No | `1` | Page number for pagination |
| `pageSize` | integer | No | `50` | Number of results per page |
| `search` | string | No | - | Optional search filter for work title |

### Page

Page number for pagination.

**Examples:**
```
?page=1                 # First page (default)
?page=2                 # Second page
?page=5                 # Fifth page
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

Optional search filter that matches against the work `title` field using case-insensitive partial matching.

**Examples:**
```
?search=hobbit          # Find works with "hobbit" in title
?search=harry potter    # Find works with "harry potter" in title
?page=1&pageSize=20&search=lord+rings  # Combine with pagination
```

---

## Response

### Success Response (200 OK)

```json
{
  "data": [
    {
      "key": "/works/OL45883W",
      "title": "The Hobbit",
      "authorKeys": ["/authors/OL26320A"],
      "subjects": ["Fantasy", "Adventure", "Dragons"],
      "firstPublishDate": "1937",
      "covers": [6979861]
    },
    {
      "key": "/works/OL2913154W",
      "title": "Harry Potter and the Philosopher's Stone",
      "authorKeys": ["/authors/OL34184A"],
      "subjects": ["Fantasy", "Magic", "Wizards", "Schools"],
      "firstPublishDate": "1998",
      "covers": [6975077]
    }
  ],
  "total": 5678,
  "page": 1,
  "pageSize": 50,
  "totalPages": 114
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `data` | object[] | Array of work objects |
| `total` | number | Total number of works (for all pages) |
| `page` | number | Current page number |
| `pageSize` | number | Number of results per page |
| `totalPages` | number | Total number of available pages |

### Work Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `key` | string | OpenLibrary unique identifier (e.g., `/works/OL45883W`) |
| `title` | string | Work title |
| `authorKeys` | string[] | Array of author OpenLibrary keys |
| `subjects` | string[] | Array of subject/genre tags |
| `firstPublishDate` | string \| null | Date of first publication |
| `covers` | number[] | Array of OpenLibrary cover IDs |

### Error Responses

**Server Error (500 Internal Server Error):**
```json
{
  "error": "Failed to list works"
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
    curl "http://localhost:3001/api/catalog/works"
    ```
  </TabItem>
  <TabItem value="javascript" label="JavaScript">
    ```javascript
    const response = await fetch('http://localhost:3001/api/catalog/works');
    const result = await response.json();
    console.log(`Total works: ${result.total}`);
    console.log(`Page 1 of ${result.totalPages}`);
    console.log(result.data);
    ```
  </TabItem>
  <TabItem value="python" label="Python">
    ```python
    import requests

    response = requests.get('http://localhost:3001/api/catalog/works')
    result = response.json()
    print(f"Total works: {result['total']}")
    print(f"Page 1 of {result['totalPages']}")
    print(result['data'])
    ```
  </TabItem>
</Tabs>

### Search for Works

<Tabs>
  <TabItem value="curl" label="cURL" default>
    ```bash
    curl "http://localhost:3001/api/catalog/works?search=hobbit&pageSize=10"
    ```
  </TabItem>
  <TabItem value="javascript" label="JavaScript">
    ```javascript
    const response = await fetch(
      'http://localhost:3001/api/catalog/works?search=hobbit&pageSize=10'
    );
    const result = await response.json();
    result.data.forEach(work => {
      console.log(`${work.title} (${work.key})`);
    });
    ```
  </TabItem>
  <TabItem value="python" label="Python">
    ```python
    response = requests.get(
        'http://localhost:3001/api/catalog/works',
        params={'search': 'hobbit', 'pageSize': 10}
    )
    result = response.json()
    for work in result['data']:
        print(f"{work['title']} ({work['key']})")
    ```
  </TabItem>
</Tabs>

### Iterate Through All Works

<Tabs>
  <TabItem value="curl" label="cURL" default>
    ```bash
    # Get first page
    curl "http://localhost:3001/api/catalog/works?page=1&pageSize=50"

    # Get second page
    curl "http://localhost:3001/api/catalog/works?page=2&pageSize=50"
    ```
  </TabItem>
  <TabItem value="javascript" label="JavaScript">
    ```javascript
    async function getAllWorks(pageSize = 50) {
      let page = 1;
      let allWorks = [];
      let hasMore = true;

      while (hasMore) {
        const response = await fetch(
          `http://localhost:3001/api/catalog/works?page=${page}&pageSize=${pageSize}`
        );
        const result = await response.json();

        allWorks = allWorks.concat(result.data);
        hasMore = page < result.totalPages;
        page++;
      }

      return allWorks;
    }

    const works = await getAllWorks();
    console.log(`Loaded ${works.length} works`);
    ```
  </TabItem>
  <TabItem value="python" label="Python">
    ```python
    def get_all_works(page_size=50):
        works = []
        page = 1
        has_more = True

        while has_more:
            response = requests.get(
                'http://localhost:3001/api/catalog/works',
                params={'page': page, 'pageSize': page_size}
            )
            result = response.json()
            works.extend(result['data'])

            has_more = page < result['totalPages']
            page += 1

        return works

    works = get_all_works()
    print(f"Loaded {len(works)} works")
    ```
  </TabItem>
</Tabs>

---

## Use Cases

### Works by Subject Filter

```javascript
async function getWorksBySubject(subject) {
  let page = 1;
  let results = [];
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(
      `http://localhost:3001/api/catalog/works?page=${page}&pageSize=100`
    );
    const result = await response.json();

    // Filter by subject on client side
    const filtered = result.data.filter(work =>
      work.subjects.some(s => s.toLowerCase().includes(subject.toLowerCase()))
    );

    results = results.concat(filtered);
    hasMore = page < result.totalPages;
    page++;
  }

  return results;
}

// Find all fantasy works
const fantasyWorks = await getWorksBySubject('fantasy');
```

### Generate Works Index

```javascript
async function generateWorksIndex() {
  let page = 1;
  const index = {};

  while (page <= 10) { // Limit to first 10 pages for example
    const response = await fetch(
      `http://localhost:3001/api/catalog/works?page=${page}&pageSize=100`
    );
    const result = await response.json();

    result.data.forEach(work => {
      index[work.key] = {
        title: work.title,
        authors: work.authorKeys,
        published: work.firstPublishDate
      };
    });

    page++;
  }

  return index;
}
```

---

## Related Endpoints

- **[Catalog Authors](./authors.md)** - Browse authors with pagination
- **[Catalog Editions](./editions.md)** - Browse editions with pagination
