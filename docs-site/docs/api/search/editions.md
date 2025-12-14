---
title: Search Editions
---

# Search Editions

Search for book editions using Elasticsearch-powered full-text search with intelligent relevance ranking.

## Endpoint

```
GET /api/search/editions
```

## Authentication

No authentication required. This is a public endpoint.

---

## Parameters

| Parameter | Type | Required | Default | Max | Description |
|-----------|------|----------|---------|-----|-------------|
| `q` | string | **Yes** | - | - | Search query (book title) |
| `limit` | integer | No | `20` | `100` | Number of results to return |
| `offset` | integer | No | `0` | - | Number of results to skip (for pagination) |

### Query (`q`)

The search query matches against book titles using multiple matching strategies with different relevance scores.

**Search behavior:**
- Case-insensitive
- Accent-insensitive
- Supports partial matching
- Ranks exact matches highest
- Supports multi-word queries

**Examples:**
```
?q=hobbit                    # Single word
?q=harry potter              # Multi-word phrase
?q=lord of the rings         # Full title
?q=lotr                      # Abbreviations may work
```

### Limit

Maximum number of results to return in a single request.

**Constraints:**
- Default: `20`
- Maximum: `100`
- Minimum: `1`

**Examples:**
```
?q=hobbit&limit=10           # Return 10 results
?q=hobbit&limit=50           # Return 50 results
```

### Offset

Number of results to skip, used for pagination.

**Example pagination:**
```bash
# Page 1 (results 1-20)
?q=hobbit&limit=20&offset=0

# Page 2 (results 21-40)
?q=hobbit&limit=20&offset=20

# Page 3 (results 41-60)
?q=hobbit&limit=20&offset=40
```

---

## Response

### Success Response (200 OK)

Returns an array of edition objects matching the query.

```json
[
  {
    "key": "/books/OL7353617M",
    "title": "The Hobbit",
    "authors": ["J. R. R. Tolkien"],
    "isbn10": ["0547928246"],
    "isbn13": ["9780547928241"],
    "publishDate": "2012",
    "numberOfPages": 300,
    "covers": [6979861],
    "publishers": ["Houghton Mifflin Harcourt"]
  }
]
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `key` | string | OpenLibrary unique identifier (e.g., `/books/OL7353617M`) |
| `title` | string | Book title |
| `authors` | string[] | Array of author names (denormalized for search) |
| `isbn10` | string[] | Array of ISBN-10 identifiers |
| `isbn13` | string[] | Array of ISBN-13 identifiers |
| `publishDate` | string \| null | Publication date (format varies) |
| `numberOfPages` | number \| null | Number of pages |
| `covers` | number[] | Array of OpenLibrary cover IDs |
| `publishers` | string[] | Array of publisher names |

### Empty Result

When no editions match the query:

```json
[]
```

### Error Responses

**Missing Query Parameter (400 Bad Request):**
```json
{
  "error": "Query parameter 'q' is required"
}
```

**Server Error (500 Internal Server Error):**
```json
{
  "error": "Search failed"
}
```

---

## Search Relevance

Editions are ranked using a multi-tier boosting strategy:

| Match Type | Boost | Description |
|------------|-------|-------------|
| Exact match | 100 | Title exactly matches query (case-insensitive) |
| Phrase match | 50 | Title contains the exact phrase |
| Prefix match | 10 | Title starts with the query |
| Standard match | 1 | Title contains query words (any order) |

**Example:** Searching for "the hobbit"

1. **Exact match** (boost: 100): "The Hobbit" ranked highest
2. **Phrase match** (boost: 50): "The Hobbit: An Unexpected Journey"
3. **Prefix match** (boost: 10): "The Hobbit or There and Back Again"
4. **Standard match** (boost: 1): "Hobbit Tales from The Shire"

---

## Examples

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

### Basic Search

<Tabs>
  <TabItem value="curl" label="cURL" default>
    ```bash
    curl "http://localhost:3001/api/search/editions?q=hobbit"
    ```
  </TabItem>
  <TabItem value="javascript" label="JavaScript">
    ```javascript
    const response = await fetch(
      'http://localhost:3001/api/search/editions?q=hobbit'
    );
    const editions = await response.json();
    console.log(editions);
    ```
  </TabItem>
  <TabItem value="python" label="Python">
    ```python
    import requests

    response = requests.get(
        'http://localhost:3001/api/search/editions',
        params={'q': 'hobbit'}
    )
    editions = response.json()
    print(editions)
    ```
  </TabItem>
</Tabs>

### Search with Pagination

<Tabs>
  <TabItem value="curl" label="cURL" default>
    ```bash
    # Get first 10 results
    curl "http://localhost:3001/api/search/editions?q=harry+potter&limit=10&offset=0"

    # Get next 10 results
    curl "http://localhost:3001/api/search/editions?q=harry+potter&limit=10&offset=10"
    ```
  </TabItem>
  <TabItem value="javascript" label="JavaScript">
    ```javascript
    async function searchWithPagination(query, page = 1, perPage = 10) {
      const offset = (page - 1) * perPage;
      const url = new URL('http://localhost:3001/api/search/editions');
      url.searchParams.set('q', query);
      url.searchParams.set('limit', perPage.toString());
      url.searchParams.set('offset', offset.toString());

      const response = await fetch(url);
      return response.json();
    }

    // Get page 1
    const page1 = await searchWithPagination('harry potter', 1, 10);

    // Get page 2
    const page2 = await searchWithPagination('harry potter', 2, 10);
    ```
  </TabItem>
  <TabItem value="python" label="Python">
    ```python
    def search_with_pagination(query, page=1, per_page=10):
        offset = (page - 1) * per_page
        return requests.get(
            'http://localhost:3001/api/search/editions',
            params={
                'q': query,
                'limit': per_page,
                'offset': offset
            }
        ).json()

    # Get page 1
    page1 = search_with_pagination('harry potter', page=1, per_page=10)

    # Get page 2
    page2 = search_with_pagination('harry potter', page=2, per_page=10)
    ```
  </TabItem>
</Tabs>

### Multi-word Search

<Tabs>
  <TabItem value="curl" label="cURL" default>
    ```bash
    # URL encode spaces as +
    curl "http://localhost:3001/api/search/editions?q=lord+of+the+rings&limit=5"

    # Or use %20 for spaces
    curl "http://localhost:3001/api/search/editions?q=lord%20of%20the%20rings&limit=5"
    ```
  </TabItem>
  <TabItem value="javascript" label="JavaScript">
    ```javascript
    // URLSearchParams handles encoding automatically
    const params = new URLSearchParams({
      q: 'lord of the rings',
      limit: '5'
    });

    const response = await fetch(
      `http://localhost:3001/api/search/editions?${params}`
    );
    const results = await response.json();
    ```
  </TabItem>
  <TabItem value="python" label="Python">
    ```python
    # requests handles encoding automatically
    response = requests.get(
        'http://localhost:3001/api/search/editions',
        params={
            'q': 'lord of the rings',
            'limit': 5
        }
    )
    results = response.json()
    ```
  </TabItem>
</Tabs>

---

## Use Cases

### Book Search in Applications

```javascript
// Real-time search as user types
async function handleSearchInput(query) {
  if (query.length < 3) return []; // Wait for 3 characters

  const results = await fetch(
    `http://localhost:3001/api/search/editions?q=${encodeURIComponent(query)}&limit=10`
  );

  return results.json();
}
```

### Finding Specific Editions

```python
def find_book_by_isbn(isbn):
    """Search for a book by ISBN"""
    # Note: Currently searches title, not ISBN
    # For ISBN search, use catalog endpoints
    results = requests.get(
        'http://localhost:3001/api/search/editions',
        params={'q': isbn, 'limit': 1}
    ).json()

    return results[0] if results else None
```

### Infinite Scroll Implementation

```javascript
class EditionSearch {
  constructor(query) {
    this.query = query;
    this.offset = 0;
    this.limit = 20;
    this.hasMore = true;
  }

  async loadMore() {
    if (!this.hasMore) return [];

    const results = await fetch(
      `http://localhost:3001/api/search/editions?q=${encodeURIComponent(this.query)}&limit=${this.limit}&offset=${this.offset}`
    ).then(r => r.json());

    this.offset += this.limit;
    this.hasMore = results.length === this.limit;

    return results;
  }
}

// Usage
const search = new EditionSearch('fantasy');
const batch1 = await search.loadMore(); // First 20
const batch2 = await search.loadMore(); // Next 20
```

---

## Performance

**Typical Response Times:**
- Empty cache: 50-150ms
- Warm cache: 10-50ms
- Large result sets: 100-300ms

**Optimization Tips:**

1. **Use appropriate limit values:**
   ```bash
   # Good: Request only what you need
   ?q=harry+potter&limit=10

   # Bad: Requesting too many results
   ?q=harry+potter&limit=100
   ```

2. **Implement debouncing for real-time search:**
   ```javascript
   const debouncedSearch = debounce(async (query) => {
     const results = await searchEditions(query);
     displayResults(results);
   }, 300); // Wait 300ms after user stops typing
   ```

3. **Cache results on client-side:**
   ```javascript
   const searchCache = new Map();

   async function searchWithCache(query) {
     if (searchCache.has(query)) {
       return searchCache.get(query);
     }

     const results = await searchEditions(query);
     searchCache.set(query, results);
     return results;
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
const edition = results[0];
if (edition.covers.length > 0) {
  const coverUrl = getCoverUrl(edition.covers[0], 'L');
  console.log(coverUrl);
  // https://covers.openlibrary.org/b/id/6979861-L.jpg
}
```

---

## Limitations

1. **ISBN Search**: Currently searches title field only. For ISBN-based lookup, use catalog endpoints with filtering.

2. **Fuzzy Matching**: No fuzzy/typo-tolerant search. "hobitt" won't match "hobbit".

3. **Language**: No language filtering. Results include all languages.

4. **Date Filtering**: No ability to filter by publication date.

5. **Result Count**: No total count returned. To know total results, continue paginating until empty array.

---

## Related Endpoints

- **[Search Authors](./authors.md)** - Search for authors by name
- **[Catalog Editions](../catalog/editions.md)** - Browse all editions with filtering
- **[Core Concepts: Search Architecture](../../concepts/search-architecture.md)** - Learn about search implementation

---

## Troubleshooting

### No Results Returned

**Problem:** Search returns empty array

**Solutions:**
1. Try broader search terms: "hobbit" instead of "the hobbit illustrated edition"
2. Check spelling
3. Verify data has been imported (`GET /api/catalog/editions`)
4. Check Elasticsearch connection (`GET /health`)

### Slow Response Times

**Problem:** Search takes >1 second

**Solutions:**
1. Reduce `limit` value
2. Check Elasticsearch health: `curl http://localhost:9200/_cluster/health`
3. Review Elasticsearch logs for errors
4. Ensure adequate memory allocation (2GB+ for Elasticsearch)

### Unexpected Results

**Problem:** Results don't seem relevant

**Explanation:** The search uses multiple matching strategies. Lower-scored matches may appear. Results are ordered by relevance score (highest first).

**Solution:** Use more specific queries or implement client-side filtering.
