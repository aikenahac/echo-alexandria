---
title: Search Authors
---

# Search Authors

Search for authors by name using Elasticsearch-powered full-text search with intelligent relevance ranking.

## Endpoint

```
GET /api/search/authors
```

## Authentication

No authentication required. This is a public endpoint.

---

## Parameters

| Parameter | Type | Required | Default | Max | Description |
|-----------|------|----------|---------|-----|-------------|
| `q` | string | **Yes** | - | - | Search query (author name) |
| `limit` | integer | No | `20` | `100` | Number of results to return |
| `offset` | integer | No | `0` | - | Number of results to skip (for pagination) |

### Query (`q`)

The search query matches against author names using multiple matching strategies with different relevance scores.

**Search behavior:**
- Case-insensitive
- Accent-insensitive
- Supports partial matching
- Ranks exact matches highest
- Supports multi-word queries (first + last name)

**Examples:**
```
?q=tolkien                   # Last name only
?q=j r r tolkien             # Full name with initials
?q=rowling                   # Single name
?q=william shakespeare       # First and last name
```

### Parameters

Same as [Search Editions](./editions.md#parameters):
- `limit` - Default: 20, Max: 100
- `offset` - For pagination

---

## Response

### Success Response (200 OK)

Returns an array of author objects matching the query.

```json
[
  {
    "key": "/authors/OL26320A",
    "name": "J. R. R. Tolkien",
    "birthDate": "3 January 1892",
    "deathDate": "2 September 1973",
    "photos": [6917219]
  }
]
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `key` | string | OpenLibrary unique identifier (e.g., `/authors/OL26320A`) |
| `name` | string | Author's full name |
| `birthDate` | string \| null | Birth date (format varies) |
| `deathDate` | string \| null | Death date (format varies), `null` if living |
| `photos` | number[] | Array of OpenLibrary photo IDs |

### Empty Result

When no authors match the query:

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

Authors are ranked using a multi-tier boosting strategy:

| Match Type | Boost | Description |
|------------|-------|-------------|
| Exact match | 100 | Name exactly matches query (case-insensitive) |
| Phrase match | 50 | Name contains the exact phrase |
| Prefix match | 10 | Name starts with the query |
| Standard match | 1 | Name contains query words (any order) |

**Example:** Searching for "tolkien"

1. **Exact match** (boost: 100): "Tolkien" (if full name is just "Tolkien")
2. **Phrase match** (boost: 50): "J. R. R. Tolkien"
3. **Prefix match** (boost: 10): "Tolkien, John Ronald Reuel"
4. **Standard match** (boost: 1): "Ronald Tolkien Smith"

---

## Examples

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

### Basic Search

<Tabs>
  <TabItem value="curl" label="cURL" default>
    ```bash
    curl "http://localhost:3001/api/search/authors?q=tolkien"
    ```
  </TabItem>
  <TabItem value="javascript" label="JavaScript">
    ```javascript
    const response = await fetch(
      'http://localhost:3001/api/search/authors?q=tolkien'
    );
    const authors = await response.json();
    console.log(authors);
    ```
  </TabItem>
  <TabItem value="python" label="Python">
    ```python
    import requests

    response = requests.get(
        'http://localhost:3001/api/search/authors',
        params={'q': 'tolkien'}
    )
    authors = response.json()
    print(authors)
    ```
  </TabItem>
</Tabs>

### Search with Pagination

<Tabs>
  <TabItem value="curl" label="cURL" default>
    ```bash
    # Get first 10 results
    curl "http://localhost:3001/api/search/authors?q=smith&limit=10&offset=0"

    # Get next 10 results
    curl "http://localhost:3001/api/search/authors?q=smith&limit=10&offset=10"
    ```
  </TabItem>
  <TabItem value="javascript" label="JavaScript">
    ```javascript
    async function searchAuthors(query, page = 1, perPage = 10) {
      const offset = (page - 1) * perPage;
      const url = new URL('http://localhost:3001/api/search/authors');
      url.searchParams.set('q', query);
      url.searchParams.set('limit', perPage.toString());
      url.searchParams.set('offset', offset.toString());

      const response = await fetch(url);
      return response.json();
    }

    const page1 = await searchAuthors('rowling', 1, 10);
    const page2 = await searchAuthors('rowling', 2, 10);
    ```
  </TabItem>
  <TabItem value="python" label="Python">
    ```python
    def search_authors(query, page=1, per_page=10):
        offset = (page - 1) * per_page
        return requests.get(
            'http://localhost:3001/api/search/authors',
            params={
                'q': query,
                'limit': per_page,
                'offset': offset
            }
        ).json()

    page1 = search_authors('rowling', page=1)
    page2 = search_authors('rowling', page=2)
    ```
  </TabItem>
</Tabs>

### Full Name Search

<Tabs>
  <TabItem value="curl" label="cURL" default>
    ```bash
    curl "http://localhost:3001/api/search/authors?q=j+r+r+tolkien&limit=5"
    ```
  </TabItem>
  <TabItem value="javascript" label="JavaScript">
    ```javascript
    const params = new URLSearchParams({
      q: 'j r r tolkien',
      limit: '5'
    });

    const response = await fetch(
      `http://localhost:3001/api/search/authors?${params}`
    );
    const results = await response.json();
    ```
  </TabItem>
  <TabItem value="python" label="Python">
    ```python
    response = requests.get(
        'http://localhost:3001/api/search/authors',
        params={'q': 'j r r tolkien', 'limit': 5}
    )
    results = response.json()
    ```
  </TabItem>
</Tabs>

---

## Use Cases

### Author Autocomplete

```javascript
// Real-time search for author input fields
async function autocompleteAuthors(query) {
  if (query.length < 2) return [];

  const response = await fetch(
    `http://localhost:3001/api/search/authors?q=${encodeURIComponent(query)}&limit=10`
  );

  return response.json();
}

// Usage in search box
searchInput.addEventListener('input', async (e) => {
  const suggestions = await autocompleteAuthors(e.target.value);
  displaySuggestions(suggestions);
});
```

### Find Author Details

```python
def get_author_by_name(name):
    """Get author details by exact or partial name match"""
    results = requests.get(
        'http://localhost:3001/api/search/authors',
        params={'q': name, 'limit': 1}
    ).json()

    return results[0] if results else None

# Usage
author = get_author_by_name('j k rowling')
if author:
    print(f"Found: {author['name']}")
    print(f"OpenLibrary ID: {author['key']}")
```

### Author Selection UI

```javascript
class AuthorSelector {
  async search(query) {
    const response = await fetch(
      `http://localhost:3001/api/search/authors?q=${encodeURIComponent(query)}&limit=20`
    );
    return response.json();
  }

  renderResults(authors) {
    return authors.map(author => `
      <div class="author-result" data-key="${author.key}">
        <h3>${author.name}</h3>
        ${author.birthDate ? `<p>Born: ${author.birthDate}</p>` : ''}
        ${author.deathDate ? `<p>Died: ${author.deathDate}</p>` : ''}
      </div>
    `).join('');
  }
}
```

---

## Author Photos

The `photos` field contains OpenLibrary photo IDs. To display author photos:

```javascript
function getAuthorPhotoUrl(photoId, size = 'M') {
  // size: S (small), M (medium), L (large)
  return `https://covers.openlibrary.org/a/id/${photoId}-${size}.jpg`;
}

// Usage
const author = results[0];
if (author.photos.length > 0) {
  const photoUrl = getAuthorPhotoUrl(author.photos[0], 'L');
  console.log(photoUrl);
  // https://covers.openlibrary.org/a/id/6917219-L.jpg
}
```

**Default/Placeholder:**

If `photos` is empty, use a default avatar:
```javascript
const photoUrl = author.photos.length > 0
  ? getAuthorPhotoUrl(author.photos[0], 'M')
  : '/default-author-avatar.png';
```

---

## Date Formats

Birth and death dates come from OpenLibrary in various formats:

**Common formats:**
- `"3 January 1892"` - Full date with month name
- `"1892"` - Year only
- `"January 1892"` - Month and year
- `"1892-01-03"` - ISO format
- `null` - Unknown

**Parsing dates:**

```javascript
function parseAuthorDate(dateStr) {
  if (!dateStr) return null;

  // Try parsing as-is
  const date = new Date(dateStr);
  if (!isNaN(date)) return date;

  // Extract year if format is "3 January 1892"
  const yearMatch = dateStr.match(/\d{4}/);
  if (yearMatch) {
    return new Date(yearMatch[0]);
  }

  return null;
}

// Usage
const birthYear = parseAuthorDate(author.birthDate)?.getFullYear();
```

---

## Performance

**Typical Response Times:**
- Empty cache: 50-150ms
- Warm cache: 10-50ms
- Common queries (cached): under 50ms

**Optimization Tips:**

Same as [Search Editions](./editions.md#performance):
- Use appropriate `limit` values
- Implement client-side caching
- Debounce real-time search inputs

---

## Limitations

1. **Disambiguation**: Multiple authors with same name will all be returned. Use dates or other context to distinguish.

2. **Fuzzy Matching**: No typo-tolerant search. "Tolkein" won't match "Tolkien".

3. **Aliases**: Author pen names or aliases may not be searchable if not in OpenLibrary data.

4. **Sorting**: Results are sorted by relevance only. No option to sort by birth date, popularity, etc.

5. **Result Count**: No total count returned. Continue paginating until empty array.

---

## Related Endpoints

- **[Search Editions](./editions.md)** - Search for books by title
- **[Catalog Authors](../catalog/authors.md)** - Browse all authors with filtering
- **[Core Concepts: Data Model](../../concepts/data-model.md)** - Learn about author data structure

---

## Troubleshooting

### No Results for Known Author

**Problem:** Search returns empty array for well-known author

**Solutions:**
1. Try variations: "rowling" vs "j k rowling" vs "joanne rowling"
2. Try last name only
3. Check if author is in database: `GET /api/catalog/authors?search=rowling`
4. Verify authors have been imported

### Too Many Results

**Problem:** Common names return too many results

**Solution:** Use more specific queries:
```bash
# Generic
?q=smith

# More specific
?q=adam+smith

# Even more specific
?q=adam+smith+economist
```

### Date Format Issues

**Problem:** Birth/death dates in inconsistent formats

**Explanation:** OpenLibrary data has varying date formats. This is normal.

**Solution:** Implement robust date parsing or display dates as-is from the API.
