---
sidebar_position: 3
title: Custom Search
---

# Custom Search

Comprehensive guide to customizing Elasticsearch analyzers, relevance scoring, and search behavior in Echo Alexandria.

## Understanding Elasticsearch Analyzers

Analyzers control how text is processed for searching. Echo Alexandria uses custom analyzers for case-insensitive, accent-insensitive search.

### Analyzer Components

An analyzer consists of three types of components:

1. **Tokenizer** - Splits text into tokens
2. **Token Filters** - Modify tokens (lowercase, remove accents, etc.)
3. **Character Filters** - Pre-process text before tokenization

### Available Tokenizers

| Tokenizer | Use Case | Example |
|-----------|----------|---------|
| standard | Default, splits on whitespace/punctuation | "The Quick Brown Fox" → ["The", "Quick", "Brown", "Fox"] |
| keyword | Treats entire input as single token | "Harry Potter" → ["Harry Potter"] |
| whitespace | Splits only on whitespace | "The-Quick-Fox" → ["The-Quick-Fox"] |
| ngram | Creates substrings for prefix matching | "harry" → ["h", "ha", "har", "harr", "harry"] |
| edge_ngram | Prefix-only n-grams (better for autocomplete) | "harry" → ["h", "ha", "har", "harr", "harry"] |

### Available Token Filters

| Filter | Purpose | Example |
|--------|---------|---------|
| lowercase | Converts to lowercase | "HARRY" → "harry" |
| asciifolding | Removes accents | "Café" → "Cafe" |
| stemmer | Reduces words to root form | "running" → "run" |
| stop | Removes common words | Removes: a, an, the, is, etc. |
| synonym | Expands search terms | "quick" matches "fast" |
| length | Filters by token length | Removes tokens < 2 chars |

### Current Analyzers

Echo Alexandria includes two custom analyzers:

**title_analyzer (for book titles):**
```json
{
  "type": "custom",
  "tokenizer": "standard",
  "filter": ["lowercase", "asciifolding"]
}
```

**name_analyzer (for author names):**
```json
{
  "type": "custom",
  "tokenizer": "standard",
  "filter": ["lowercase", "asciifolding"]
}
```

**Why this choice:**
- Standard tokenizer handles punctuation properly
- Lowercase: "HARRY" = "harry"
- Asciifolding: "Müller" = "Muller"

## Modifying Existing Analyzers

### Adding Synonym Filter

Expand search to include synonyms:

```json
PUT /editions/_settings
{
  "settings": {
    "analysis": {
      "filter": {
        "my_synonym_filter": {
          "type": "synonym",
          "synonyms": [
            "quick,fast,swift",
            "jumps,leaps,hops",
            "fantasy,magical",
            "science fiction,sci-fi,scifi"
          ]
        }
      },
      "analyzer": {
        "title_analyzer_with_synonyms": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": ["lowercase", "asciifolding", "my_synonym_filter"]
        }
      }
    }
  }
}

# Update index mapping
PUT /editions/_mapping
{
  "properties": {
    "title": {
      "type": "text",
      "analyzer": "title_analyzer_with_synonyms"
    }
  }
}
```

**Result:** Searching for "fast" will also match "quick"

### Adding Stemming for Multiple Languages

Reduce word variations to root form:

```json
PUT /editions/_settings
{
  "settings": {
    "analysis": {
      "filter": {
        "english_stemmer": {
          "type": "stemmer",
          "language": "english"
        },
        "spanish_stemmer": {
          "type": "stemmer",
          "language": "spanish"
        }
      },
      "analyzer": {
        "multilingual_analyzer": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": ["lowercase", "asciifolding", "english_stemmer"]
        }
      }
    }
  }
}
```

**Result:**
- "running" = "run" = "runs" (all match)
- "habla" = "habl" = "hablan" (Spanish)

### Custom Stop Words

Remove common words from search:

```json
PUT /editions/_settings
{
  "settings": {
    "analysis": {
      "filter": {
        "custom_stop": {
          "type": "stop",
          "stopwords": ["the", "a", "an", "and", "or", "is", "of", "to", "in"]
        }
      },
      "analyzer": {
        "title_no_stop": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": ["lowercase", "asciifolding", "custom_stop"]
        }
      }
    }
  }
}
```

### Edge N-grams for Autocomplete

Enable prefix matching in search suggestions:

```json
PUT /editions/_settings
{
  "settings": {
    "analysis": {
      "tokenizer": {
        "autocomplete_tokenizer": {
          "type": "edge_ngram",
          "min_gram": 2,
          "max_gram": 20,
          "token_chars": ["letter", "digit"]
        }
      },
      "analyzer": {
        "autocomplete_analyzer": {
          "type": "custom",
          "tokenizer": "autocomplete_tokenizer",
          "filter": ["lowercase", "asciifolding"]
        }
      }
    }
  }
}

# Add to mapping
PUT /editions/_mapping
{
  "properties": {
    "title": {
      "type": "text",
      "fields": {
        "autocomplete": {
          "type": "text",
          "analyzer": "autocomplete_analyzer"
        }
      }
    }
  }
}

# Search with autocomplete
GET /editions/_search
{
  "query": {
    "match": {
      "title.autocomplete": "harr"  # Matches "harry", "harper", etc.
    }
  }
}
```

## Creating New Analyzers

### Step-by-Step Guide

**1. Plan the analyzer:**

```
Name: isbn_analyzer
Purpose: Match ISBN numbers (13 or 10 digits)
Rules:
  - Treat as single token (don't split)
  - Remove hyphens and spaces
  - Allow numeric matching
```

**2. Define in settings:**

```json
PUT /editions/_settings
{
  "settings": {
    "analysis": {
      "char_filter": {
        "isbn_char_filter": {
          "type": "mapping",
          "mappings": ["-=>", " =>"]  # Remove hyphens and spaces
        }
      },
      "analyzer": {
        "isbn_analyzer": {
          "type": "custom",
          "char_filter": ["isbn_char_filter"],
          "tokenizer": "keyword",  # Keep as single token
          "filter": []
        }
      }
    }
  }
}
```

**3. Test with _analyze API:**

```bash
POST /editions/_analyze
{
  "analyzer": "isbn_analyzer",
  "text": "978-0-13-110362-7"
}

# Returns: ["9780131103627"] (hyphens removed, single token)
```

**4. Update mapping:**

```json
PUT /editions/_mapping
{
  "properties": {
    "isbn13": {
      "type": "keyword",
      "analyzer": "isbn_analyzer"
    }
  }
}
```

## Adjusting Relevance Scoring

Echo Alexandria uses 4-tier boosting for relevance. Customize to your needs.

### Current Boost Values

```typescript
// From src/elasticsearch/search.ts
const boosts = {
  exact: 100,           // Keyword match (exact field)
  phrase: 50,           // Phrase match
  prefix: 10,           // Prefix match (title start)
  standard: 1           // Standard match (anywhere)
};
```

### Changing Boost Values

Adjust to prioritize different match types:

```typescript
// Option 1: Increase exact match importance
const boosts = {
  exact: 200,           // Much higher
  phrase: 50,
  prefix: 10,
  standard: 1
};

// Option 2: Reduce exact match strictness
const boosts = {
  exact: 50,            // Lower
  phrase: 30,
  prefix: 20,
  standard: 1
};
```

### Field Boosting

Different boost for title vs description:

```typescript
const response = await es.search({
  index: INDICES.EDITIONS,
  body: {
    query: {
      multi_match: {
        query: searchTerm,
        fields: [
          "title^3",        // Title: 3x boost
          "authors^2",      // Authors: 2x boost
          "description^1",  // Description: normal
          "subjects"        // Subjects: normal
        ],
        type: "best_fields"
      }
    }
  }
});
```

### Function Score for Advanced Ranking

Incorporate recency and popularity:

```json
GET /editions/_search
{
  "query": {
    "function_score": {
      "query": {
        "multi_match": {
          "query": "harry potter",
          "fields": ["title^2", "authors"]
        }
      },
      "functions": [
        {
          "filter": { "range": { "last_imported": { "gte": "now-1y" } } },
          "weight": 1.2  # Recent books get 20% boost
        },
        {
          "field_value_factor": {
            "field": "view_count",
            "factor": 1.2,
            "max_value": 100
          }
        }
      ],
      "boost_mode": "multiply",
      "max_boost": 42
    }
  }
}
```

### Script Scoring

Custom scoring logic:

```json
GET /editions/_search
{
  "query": {
    "script_score": {
      "query": {
        "multi_match": {
          "query": "python",
          "fields": ["title", "subjects"]
        }
      },
      "script": {
        "source": "_score * params.factor * Math.log(2 + doc['numberOfPages'].value)",
        "params": {
          "factor": 1.2
        }
      }
    }
  }
}
```

## Adding New Search Fields

### Step 1: Update Elasticsearch Mapping

Add new field to index mapping:

```json
PUT /editions/_mapping
{
  "properties": {
    "isbn_checksum": {
      "type": "keyword"
    },
    "publication_year": {
      "type": "integer"
    },
    "language_code": {
      "type": "keyword"
    }
  }
}
```

### Step 2: Reindex Data

Populate the new field:

```bash
# For simple data already present
POST /editions/_update_by_query
{
  "script": {
    "source": "ctx._source.publication_year = doc['publishDate'].value.year()"
  }
}

# For complex transformations, use bulk reindex
POST _reindex
{
  "source": {
    "index": "editions"
  },
  "dest": {
    "index": "editions"
  },
  "script": {
    "source": """
    if (ctx._source.isbn13 != null && ctx._source.isbn13.length > 0) {
      ctx._source.isbn_checksum = ctx._source.isbn13[0].substring(0, 12);
    }
    """
  }
}
```

### Step 3: Update Search Queries

Include new field in search:

```typescript
export async function searchEditionsWithYear(
  query: string,
  yearFrom: number,
  yearTo: number,
  limit = 20,
  offset = 0
) {
  const response = await es.search({
    index: INDICES.EDITIONS,
    body: {
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query: query,
                fields: ["title^2", "authors", "subjects"]
              }
            }
          ],
          filter: [
            {
              range: {
                publication_year: {
                  gte: yearFrom,
                  lte: yearTo
                }
              }
            }
          ]
        }
      },
      from: offset,
      size: limit
    }
  });

  return response.hits.hits.map((hit: any) => ({
    key: hit._source.key,
    title: hit._source.title,
    publishYear: hit._source.publication_year,
    authors: hit._source.authors || []
  }));
}
```

## Advanced Query Patterns

### Fuzzy Matching (Typo Tolerance)

Handle misspellings automatically:

```typescript
const response = await es.search({
  index: INDICES.EDITIONS,
  body: {
    query: {
      multi_match: {
        query: "haryr pottr",  // Misspelled
        fields: ["title", "authors"],
        fuzziness: "AUTO",     // Auto-detect fuzziness
        prefix_length: 0,      // Allow fuzzy from start
        max_expansions: 50     // Limit expansion
      }
    }
  }
});
```

### Wildcard Queries

Match patterns with * and ?:

```json
GET /editions/_search
{
  "query": {
    "wildcard": {
      "title": {
        "value": "*potter*",
        "boost": 1.0
      }
    }
  }
}
```

### Regular Expression Queries

Complex pattern matching:

```json
GET /editions/_search
{
  "query": {
    "regexp": {
      "title": {
        "value": "[Hh]arry.*[Pp]otter",
        "flags": "ALL"
      }
    }
  }
}
```

### Multi-Match with Different Strategies

Different matching approaches per field:

```json
GET /editions/_search
{
  "query": {
    "multi_match": {
      "query": "harry potter",
      "fields": ["title^2", "authors^1"],
      "type": "phrase_prefix"  # All fields must match as phrase prefix
    }
  }
}
```

**Match types:**
- `best_fields`: Best matching field wins
- `most_fields`: More matching fields wins
- `cross_fields`: Treat fields as one big field
- `phrase`: Match as phrase
- `phrase_prefix`: Match as phrase prefix

## Highlighting Search Results

Show where matches occur in results:

```typescript
const response = await es.search({
  index: INDICES.EDITIONS,
  body: {
    query: {
      multi_match: {
        query: searchTerm,
        fields: ["title", "description"]
      }
    },
    highlight: {
      pre_tags: ["<mark>"],
      post_tags: ["</mark>"],
      fields: {
        title: {
          fragment_size: 150,
          number_of_fragments: 3
        },
        description: {
          fragment_size: 150,
          number_of_fragments: 3
        }
      }
    }
  }
});

// Returns highlighted snippets
return response.hits.hits.map((hit: any) => ({
  key: hit._source.key,
  title: hit._source.title,
  highlight: hit.highlight.title?.[0] || hit._source.title
}));
```

## Aggregations for Faceted Search

Categorize results by dimensions:

```json
GET /editions/_search
{
  "query": {
    "multi_match": {
      "query": "fiction",
      "fields": ["title", "subjects"]
    }
  },
  "aggs": {
    "by_language": {
      "terms": {
        "field": "languages",
        "size": 10
      }
    },
    "by_year": {
      "date_histogram": {
        "field": "publishDate",
        "calendar_interval": "year"
      }
    },
    "by_publisher": {
      "terms": {
        "field": "publishers",
        "size": 20
      }
    }
  }
}
```

## Search Suggestions (Completion Suggester)

Autocomplete with prefix matching:

```json
# Add completion field to mapping
PUT /editions/_mapping
{
  "properties": {
    "title_suggest": {
      "type": "completion"
    }
  }
}

# Search suggestions
GET /editions/_search
{
  "suggest": {
    "title_suggestions": {
      "prefix": "harr",
      "completion": {
        "field": "title_suggest",
        "size": 10,
        "skip_duplicates": true
      }
    }
  }
}

# Returns top 10 suggestions starting with "harr"
```

## Creating New Search Endpoints

### Example 1: Search by ISBN

```typescript
export async function searchEditionsByISBN(
  isbn: string
): Promise<EditionSearchResult[]> {
  const cleanISBN = isbn.replace(/[^0-9X]/g, '');

  const response = await es.search({
    index: INDICES.EDITIONS,
    body: {
      query: {
        bool: {
          should: [
            {
              term: {
                "isbn13.keyword": {
                  value: cleanISBN,
                  boost: 100
                }
              }
            },
            {
              term: {
                "isbn10.keyword": {
                  value: cleanISBN,
                  boost: 100
                }
              }
            },
            {
              wildcard: {
                "isbn13.keyword": `*${cleanISBN}*`
              }
            }
          ]
        }
      },
      size: 20
    }
  });

  return response.hits.hits.map((hit: any) => ({
    key: hit._source.key,
    title: hit._source.title,
    isbn13: hit._source.isbn13,
    isbn10: hit._source.isbn10,
    authors: hit._source.authors || []
  }));
}
```

### Example 2: Search by Publication Year Range

```typescript
export async function searchEditionsByYear(
  yearFrom: number,
  yearTo: number,
  limit = 100
): Promise<EditionSearchResult[]> {
  const response = await es.search({
    index: INDICES.EDITIONS,
    body: {
      query: {
        range: {
          publishDate: {
            gte: `${yearFrom}-01-01`,
            lte: `${yearTo}-12-31`,
            format: "yyyy-MM-dd"
          }
        }
      },
      sort: [
        { publishDate: { order: "desc" } }
      ],
      size: limit
    }
  });

  return response.hits.hits.map((hit: any) => ({
    key: hit._source.key,
    title: hit._source.title,
    publishDate: hit._source.publishDate,
    authors: hit._source.authors || []
  }));
}
```

### Example 3: Autocomplete Endpoint

```typescript
export async function autocompleteEditions(
  prefix: string,
  limit = 10
): Promise<{ key: string; title: string; match: string }[]> {
  const response = await es.search({
    index: INDICES.EDITIONS,
    body: {
      query: {
        match_phrase_prefix: {
          title: {
            query: prefix,
            boost: 10
          }
        }
      },
      size: limit,
      _source: ["key", "title"]
    }
  });

  return response.hits.hits.map((hit: any) => ({
    key: hit._source.key,
    title: hit._source.title,
    match: highlightMatch(hit._source.title, prefix)
  }));
}

function highlightMatch(title: string, prefix: string): string {
  const index = title.toLowerCase().indexOf(prefix.toLowerCase());
  if (index === -1) return title;
  return title.substring(0, index + prefix.length);
}
```

---

## Search Customization Checklist

- [ ] Reviewed current analyzers (title_analyzer, name_analyzer)
- [ ] Tested with _analyze API for your use cases
- [ ] Added synonyms if needed
- [ ] Configured stemming for relevant languages
- [ ] Added custom stop words
- [ ] Set up edge n-grams for autocomplete
- [ ] Adjusted boost values for your domain
- [ ] Added field-specific boosting
- [ ] Implemented highlighting for results
- [ ] Added faceted search aggregations
- [ ] Created completion suggester for autocomplete
- [ ] Developed new search endpoints
- [ ] Tested fuzzy matching for typo tolerance
- [ ] Validated search performance with benchmarks

---

## Related Topics

- **[Performance Tuning](./performance-tuning.md)** - Optimize search performance
- **[Batch Processing](./batch-processing.md)** - Efficient data imports
- **[Scaling](./scaling.md)** - Multi-node Elasticsearch setups
