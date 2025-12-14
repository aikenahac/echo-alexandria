---
title: Elasticsearch Indices
---

# Elasticsearch Indices

Complete documentation of Elasticsearch indices used for full-text search and relevance ranking in Echo Alexandria.

## Index Overview

Echo Alexandria maintains two primary search indices for different data domains:

| Index | Purpose | Document Type | Shard/Replica | Analyzer |
|-------|---------|---------------|--------------|----------|
| `editions` | Book edition search | Book records | 1/0 | title_analyzer |
| `authors` | Author search | Author records | 1/0 | name_analyzer |

## Editions Index

The `editions` index provides full-text search across book editions with support for ISBN lookups, publisher filtering, and language-based discovery.

### Index Settings

```json
{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 0,
    "analysis": {
      "analyzer": {
        "title_analyzer": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": ["lowercase", "asciifolding"]
        }
      }
    }
  }
}
```

**Settings Explanation:**

- **number_of_shards: 1** - Single shard optimal for single-node setup
  - Reduces overhead from shard coordination
  - Increases performance for small-to-medium datasets
  - Scales to multiple shards when data exceeds 50GB

- **number_of_replicas: 0** - No replication in development
  - Saves storage space (no duplicate data)
  - Faster indexing (no replica writes)
  - For production: set to 1-2 for redundancy

- **title_analyzer** - Custom analyzer for book titles
  - Tokenizer: `standard` (splits on whitespace and punctuation)
  - Filter chain: `lowercase`, `asciifolding`
  - Enables accent-insensitive search (é → e, ñ → n)

### Index Mappings

```json
{
  "mappings": {
    "properties": {
      "key": {
        "type": "keyword"
      },
      "title": {
        "type": "text",
        "analyzer": "title_analyzer",
        "fields": {
          "keyword": {
            "type": "keyword"
          },
          "exact": {
            "type": "text",
            "analyzer": "standard"
          }
        }
      },
      "workKeys": {
        "type": "keyword"
      },
      "authorKeys": {
        "type": "keyword"
      },
      "authors": {
        "type": "text",
        "fields": {
          "keyword": {
            "type": "keyword"
          }
        }
      },
      "isbn10": {
        "type": "keyword"
      },
      "isbn13": {
        "type": "keyword"
      },
      "publishers": {
        "type": "keyword"
      },
      "publishDate": {
        "type": "keyword"
      },
      "numberOfPages": {
        "type": "integer"
      },
      "covers": {
        "type": "integer"
      },
      "languages": {
        "type": "keyword"
      },
      "physicalFormat": {
        "type": "keyword"
      },
      "editionName": {
        "type": "text"
      }
    }
  }
}
```

### Field Mapping Details

#### key (keyword)

**Purpose:** Unique edition identifier from source system

**Type:** keyword (not analyzed, exact matching)

**Example Value:** `/books/OL123M`

**Use Cases:**
- Linking search results to detailed records
- Deduplication checks
- Foreign key relationships

#### title (text with sub-fields)

**Purpose:** Edition title - primary search field

**Type:** text with three variants:

1. **Main field** (text with title_analyzer)
   - Full-text search capability
   - Accent-insensitive matching
   - TF-IDF relevance scoring

2. **.keyword sub-field** (keyword)
   - Exact phrase matching
   - Aggregations (facets)
   - Sorting

3. **.exact sub-field** (text with standard analyzer)
   - Case-insensitive exact matching
   - No accent folding
   - Phrase queries with standard tokenization

**Query Examples:**

```json
{
  "query": {
    "multi_match": {
      "query": "stand",
      "fields": [
        "title^2",
        "title.keyword^3",
        "editionName"
      ]
    }
  }
}
```

**Matching Behavior:**
- Query: "stand" matches "The Stand", "Stand Alone", "grand Stand"
- Query: "the stand" matches exact phrase "The Stand"
- Query: "thé stand" matches "the stand" (accents ignored)

#### workKeys (keyword)

**Purpose:** Array of parent work identifiers

**Type:** keyword (array)

**Example:** `["/works/OL123W", "/works/OL124W"]`

**Use Cases:**
- Find all editions of a work
- Work-level aggregations
- Group related editions

**Query Example:**
```json
{
  "query": {
    "term": {
      "workKeys": "/works/OL123W"
    }
  }
}
```

#### authorKeys (keyword)

**Purpose:** Array of author identifiers

**Type:** keyword (array)

**Example:** `["/authors/OL123A", "/authors/OL124A"]`

**Use Cases:**
- Filter editions by author
- Author-level faceting
- Co-author discovery

**Query Example:**
```json
{
  "query": {
    "terms": {
      "authorKeys": ["/authors/OL123A", "/authors/OL124A"]
    }
  }
}
```

#### authors (text with keyword sub-field)

**Purpose:** Denormalized author names for relevance

**Type:** text (searchable) + keyword (faceting)

**Example:** `["Stephen King", "Peter Straub"]`

**Use Cases:**
- Author name search alongside title search
- Author name facets for UI
- Relevance boost for author matches

**Query Example:**
```json
{
  "query": {
    "bool": {
      "should": [
        {
          "match": {
            "title": {
              "query": "pet sematary",
              "boost": 2
            }
          }
        },
        {
          "match": {
            "authors": {
              "query": "stephen king",
              "boost": 1.5
            }
          }
        }
      ]
    }
  }
}
```

#### isbn10 / isbn13 (keyword)

**Purpose:** ISBN identifiers for edition lookup

**Type:** keyword (array)

**Example:**
- isbn10: `["0385333838", "0385333844"]`
- isbn13: `["978-0385333832"]`

**Use Cases:**
- ISBN-based product lookup
- Deduplication across data sources
- Library system integration

**Query Example:**
```json
{
  "query": {
    "term": {
      "isbn13": "978-0385333832"
    }
  }
}
```

#### publishers (keyword)

**Purpose:** Publishing company names

**Type:** keyword (array)

**Example:** `["Doubleday", "Signet"]`

**Use Cases:**
- Filter by publisher
- Publisher-based facets
- Publisher statistics

#### publishDate (keyword)

**Purpose:** Publication date

**Type:** keyword (flexible format)

**Example:** `"1978-10-03"` or `"1978"`

**Use Cases:**
- Publication date filtering
- Sort by publication date
- Historical analysis

#### numberOfPages (integer)

**Purpose:** Page count metadata

**Type:** integer

**Example:** `823`

**Use Cases:**
- Filter by book length
- Integer range queries
- Statistics (avg pages, etc.)

**Query Example:**
```json
{
  "query": {
    "range": {
      "numberOfPages": {
        "gte": 500,
        "lte": 1000
      }
    }
  }
}
```

#### covers (integer)

**Purpose:** Cover image identifiers

**Type:** integer (array)

**Example:** `[1234567, 7654321]`

**Use Cases:**
- Presence/absence checks
- Image lookup
- Visual search preparation

#### languages (keyword)

**Purpose:** Language codes in ISO 639-1 format

**Type:** keyword (array)

**Example:** `["eng", "fra", "ger"]`

**Use Cases:**
- Language-based filtering
- Multilingual edition discovery
- Language preference facets

**Query Example:**
```json
{
  "query": {
    "term": {
      "languages": "eng"
    }
  }
}
```

#### physicalFormat (keyword)

**Purpose:** Physical format description

**Type:** keyword

**Example:** `"Hardcover"`, `"Paperback"`, `"Audiobook"`, `"eBook"`

**Use Cases:**
- Format-based filtering
- Format availability checking
- Format preferences

#### editionName (text)

**Purpose:** Edition descriptor

**Type:** text

**Example:** `"First Edition"`, `"Anniversary Edition"`, `"Collector's Edition"`

**Use Cases:**
- Edition type searching
- Descriptive information
- Anniversary/special edition discovery

## Authors Index

The `authors` index enables full-text search across author profiles, including name variations and biographical information.

### Index Settings

```json
{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 0,
    "analysis": {
      "analyzer": {
        "name_analyzer": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": ["lowercase", "asciifolding"]
        }
      }
    }
  }
}
```

### Index Mappings

```json
{
  "mappings": {
    "properties": {
      "key": {
        "type": "keyword"
      },
      "name": {
        "type": "text",
        "analyzer": "name_analyzer",
        "fields": {
          "keyword": {
            "type": "keyword"
          },
          "exact": {
            "type": "text",
            "analyzer": "standard"
          }
        }
      },
      "personalName": {
        "type": "text"
      },
      "birthDate": {
        "type": "keyword"
      },
      "deathDate": {
        "type": "keyword"
      },
      "bio": {
        "type": "text"
      },
      "alternateNames": {
        "type": "text"
      },
      "photos": {
        "type": "integer"
      }
    }
  }
}
```

### Field Mapping Details

#### key (keyword)

**Purpose:** Unique author identifier

**Type:** keyword

**Example:** `/authors/OL123A`

#### name (text with sub-fields)

**Purpose:** Primary author name

**Type:** text (full-text) with keyword and exact variants

**Example:** `"Stephen King"`

**Name Matching Examples:**
- Query "King" matches: "Stephen King", "B.B. King", "King, Stephen"
- Query "Stephen K" matches: "Stephen King", "Stephen Kimberly King"

#### personalName (text)

**Purpose:** Alternative name format (typically formal)

**Type:** text

**Example:** `"King, Stephen"`

#### birthDate / deathDate (keyword)

**Purpose:** Birth and death dates

**Type:** keyword (flexible format)

**Example:** `"1947-09-21"`

**Use Cases:**
- Author biography timelines
- Contemporary author filtering

#### bio (text)

**Purpose:** Biographical information

**Type:** text (full-text searchable)

**Example:** `"American author of horror fiction. Known for The Shining, It, and The Stand."`

**Use Cases:**
- Biographical search
- Author background discovery

#### alternateNames (text)

**Purpose:** Pseudonyms and alternative names

**Type:** text (array)

**Example:** `["Stephen Edwin King", "Richard Bachman"]`

**Use Cases:**
- Pseudonym-based search
- Author identity resolution

#### photos (integer)

**Purpose:** Photo image identifiers

**Type:** integer (array)

**Example:** `[111, 222, 333]`

## Custom Analyzers Breakdown

### title_analyzer (for Editions)

```json
{
  "type": "custom",
  "tokenizer": "standard",
  "filter": ["lowercase", "asciifolding"]
}
```

**Tokenizer: standard**
- Splits on whitespace and punctuation
- Removes punctuation from tokens
- Example: "The Stand: Complete & Uncut" → ["The", "Stand", "Complete", "Uncut"]

**Filters:**

1. **lowercase**
   - Converts all characters to lowercase
   - Example: "The Stand" → "the stand"

2. **asciifolding**
   - Converts accented characters to ASCII equivalents
   - Example: "Café" → "cafe"
   - Example: "Über" → "uber"
   - Example: "Señor" → "senor"

**Complete Flow Example:**
```
Input:    "The Café Discothèque"
↓ tokenizer
["The", "Café", "Discothèque"]
↓ lowercase
["the", "café", "discothèque"]
↓ asciifolding
["the", "cafe", "discotheque"]
```

### name_analyzer (for Authors)

Identical to title_analyzer:

```json
{
  "type": "custom",
  "tokenizer": "standard",
  "filter": ["lowercase", "asciifolding"]
}
```

**Flow Example:**
```
Input:    "José García"
↓ tokenizer
["José", "García"]
↓ lowercase
["josé", "garcía"]
↓ asciifolding
["jose", "garcia"]
```

## Index Creation and Management

### Creating Indices

Indices are created automatically by the import pipeline:

```typescript
// From src/elasticsearch/indices.ts
export async function createIndices() {
  // Create editions index with settings and mappings
  await es.indices.create({
    index: INDICES.EDITIONS,
    body: {
      settings: { /* ... */ },
      mappings: { /* ... */ }
    }
  });

  // Create authors index with settings and mappings
  await es.indices.create({
    index: INDICES.AUTHORS,
    body: {
      settings: { /* ... */ },
      mappings: { /* ... */ }
    }
  });
}
```

### Recreating Indices

For fresh imports or schema updates:

```typescript
export async function recreateIndices() {
  // Delete existing indices
  await es.indices.delete({ index: INDICES.EDITIONS });
  await es.indices.delete({ index: INDICES.AUTHORS });

  // Create fresh indices
  await createIndices();
}
```

## Querying Patterns

### Simple Full-Text Search

```json
{
  "query": {
    "match": {
      "title": {
        "query": "science fiction",
        "operator": "or"
      }
    }
  }
}
```

**Behavior:** Returns documents where title contains "science" OR "fiction"

### Phrase Search

```json
{
  "query": {
    "match_phrase": {
      "title": "science fiction"
    }
  }
}
```

**Behavior:** Returns documents with exact phrase "science fiction"

### Multi-Field Search

```json
{
  "query": {
    "multi_match": {
      "query": "stephen king",
      "fields": [
        "title^2",
        "authors",
        "editionName"
      ]
    }
  }
}
```

**Behavior:** Searches multiple fields with relevance boost on title

### Boolean Query with Filters

```json
{
  "query": {
    "bool": {
      "must": [
        {
          "match": {
            "title": "database"
          }
        }
      ],
      "filter": [
        {
          "term": {
            "languages": "eng"
          }
        },
        {
          "range": {
            "numberOfPages": {
              "gte": 100
            }
          }
        }
      ]
    }
  }
}
```

**Behavior:** Must match title AND filter by language and page count

### Fuzzy Search (Typo Tolerance)

```json
{
  "query": {
    "match": {
      "title": {
        "query": "shaekspear",
        "fuzziness": "AUTO"
      }
    }
  }
}
```

**Behavior:** Matches "shakespeare" despite typo

### Aggregations (Facets)

```json
{
  "query": { "match_all": {} },
  "aggs": {
    "languages": {
      "terms": {
        "field": "languages",
        "size": 10
      }
    },
    "publishers": {
      "terms": {
        "field": "publishers.keyword",
        "size": 20
      }
    }
  }
}
```

**Behavior:** Returns count of documents by language and publisher

## Performance Considerations

### Shard and Replica Strategy

**Single Node (Development):**
```json
"number_of_shards": 1,
"number_of_replicas": 0
```

**Multi-Node Cluster (Production):**
```json
"number_of_shards": 3,
"number_of_replicas": 2
```

**Benefits of Multiple Shards:**
- Parallel query execution across nodes
- Better throughput for high query volume
- Easier load distribution

**Benefits of Replicas:**
- High availability (survive node failures)
- Additional read capacity
- Better query distribution

### Index Refresh Interval

**Default (1s):** Good for real-time search

**For Better Indexing Performance:**
```json
{
  "settings": {
    "refresh_interval": "30s"
  }
}
```

**Trade-off:** New documents take up to 30s to appear in search

### Batch Indexing

Bulk API is significantly faster than individual indexing:

```json
POST _bulk
{ "index": { "_index": "editions", "_id": "1" } }
{ "key": "/books/OL1M", "title": "The Stand", ... }
{ "index": { "_index": "editions", "_id": "2" } }
{ "key": "/books/OL2M", "title": "It", ... }
```

**Performance:**
- Bulk: 10,000-100,000 docs/sec
- Individual: 100-1,000 docs/sec

## Scaling Elasticsearch

### Phase 1: Current Setup
- Single node (development)
- 1 shard, 0 replicas
- Suitable for: < 10M documents

### Phase 2: Small Production Cluster
```json
{
  "number_of_shards": 3,
  "number_of_replicas": 1
}
```
- 3-5 nodes
- Suitable for: 10M - 100M documents
- High availability: Yes

### Phase 3: Large Cluster
```json
{
  "number_of_shards": 5,
  "number_of_replicas": 2
}
```
- 10+ nodes
- Separate index per content type (editions, authors)
- Suitable for: 100M+ documents
- Warm/Cold tier architecture

### Phase 4: Multi-Region
- Multiple clusters
- Cross-cluster replication
- Suitable for: Global distribution
- Latency: < 100ms from any region

## Index Lifecycle Management

### Creation
- Automatic on first import
- Verify shard/replica settings match deployment

### Growth Monitoring
```json
GET editions/_stats
```

Check:
- `store.size_in_bytes` (total index size)
- `docs.count` (document count)
- `docs.deleted` (efficiency metric)

### Maintenance
```json
POST editions/_optimize?max_num_segments=1
```

Merges segments, reduces query latency and memory usage

### Reindexing (Major Changes)

```json
POST _reindex
{
  "source": { "index": "editions" },
  "dest": { "index": "editions_v2" }
}
```

Useful for schema changes, new analyzers, etc.

## Troubleshooting

### Query Too Slow

**Check:**
1. Query complexity (avoid nested queries)
2. Field cardinality (use keyword for high-cardinality)
3. Index size (`_stats`)

**Optimize:**
- Add replicas for read scaling
- Increase refresh_interval
- Use filter queries (cached by Elasticsearch)

### Index Won't Grow

**Check:**
- Bulk ingestion rate
- Network bandwidth
- Disk I/O

**Increase:**
- Bulk batch size (e.g., 5,000 docs)
- Number of bulk threads
- Heap size (if bottleneck is memory)

### Memory Pressure

**Reduce:**
- Field data cache (use keyword instead of text)
- Shard count (consolidate)
- Refresh interval (batch updates)

---

**See Also:**
- [System Design](/docs/architecture/system-design) - Architecture overview
- [Database Schema](/docs/architecture/database-schema) - PostgreSQL tables
- [Data Flow](/docs/architecture/data-flow) - Indexing pipeline
