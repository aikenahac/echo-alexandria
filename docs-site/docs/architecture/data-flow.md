---
title: Data Flow
---

# Data Flow

Complete documentation of request/response flows, data processing pipelines, and system interactions in Echo Alexandria.

## Request/Response Flows

### Search Request Flow

```mermaid
sequenceDiagram
    autonumber
    Client->>API: GET /search?q=database&limit=20
    Note over API: Parse query, validate params
    API->>Elasticsearch: Query editions index<br/>multi_match: title, authors, description
    Elasticsearch-->>API: Ranked results (IDs, scores)<br/>Max 1000 docs in 50ms
    Note over API: Extract top 20 edition keys
    API->>PostgreSQL: SELECT * FROM editions<br/>WHERE key = ANY($1)<br/>ORDER BY score DESC
    PostgreSQL-->>API: Full edition records<br/>Includes: title, authors,<br/>publishers, cover IDs
    Note over API: Combine ES scores + DB data
    API->>Client: JSON response<br/>{<br/>  results: [{<br/>    key, title, authors,<br/>    publishers, score, covers<br/>  }],<br/>  total: 5000,<br/>  took: 85ms<br/>}
```

**Performance Breakdown:**
- Query parsing: 1ms
- Elasticsearch query: 50ms (99th percentile)
- PostgreSQL fetch: 20ms
- JSON serialization: 5ms
- Total: 76ms (typical)

**Key Optimizations:**
1. Elasticsearch returns only IDs (small payload)
2. Limit PostgreSQL fetch to top 20 results
3. Connection pooling prevents connection overhead
4. Response caching at CDN layer

### Catalog Request Flow (Single Edition)

```mermaid
sequenceDiagram
    autonumber
    Client->>API: GET /editions/OL123M
    Note over API: Extract key parameter
    API->>PostgreSQL: SELECT * FROM editions<br/>WHERE key = $1
    PostgreSQL-->>API: Edition record (with arrays)
    Note over API: Extract author_keys array
    API->>PostgreSQL: SELECT * FROM authors<br/>WHERE key = ANY($1)<br/>ORDER BY name ASC
    PostgreSQL-->>API: Author records
    Note over API: Build response object
    API-->>Client: JSON response<br/>{<br/>  key, title, workKeys,<br/>  authorKeys, isbn13,<br/>  publishers, publishDate,<br/>  numberOfPages, languages,<br/>  authors: [{<br/>    key, name, birthDate,<br/>    bio, alternateNames<br/>  }]<br/>}
```

**Performance Characteristics:**
- Primary key lookup: < 1ms (B-tree index)
- Author array lookup: < 5ms (GIN index)
- Total: < 10ms (typical)

**Caching:**
- HTTP Cache-Control: max-age=3600 (1 hour)
- CDN edge caching: 24 hours
- Browser cache: User preference

### Author Discovery Flow

```mermaid
sequenceDiagram
    autonumber
    Client->>API: GET /authors/OL123A/editions
    Note over API: Extract author key
    API->>PostgreSQL: SELECT * FROM editions<br/>WHERE author_keys @> ARRAY[$1]<br/>ORDER BY publish_date DESC<br/>LIMIT 50
    PostgreSQL-->>API: Edition records<br/>(50 most recent)
    Note over API: Build response
    API-->>Client: JSON response<br/>{<br/>  author: { key, name, bio },<br/>  editions: [{<br/>    key, title, publishDate,<br/>    numberOfPages, cover<br/>  }],<br/>  total: 47<br/>}
```

**Performance:**
- Array containment query: 10-20ms (GIN index)
- Result set size: 50 editions
- Total: 25ms (typical)

## Import Pipeline Flows

### End-to-End Import Process

```mermaid
graph TD
    A["Admin Triggers Import<br/>POST /import/authors"] -->|Validation| B["Create Job Record<br/>Status: pending"]
    B -->|Job ID| C["Start Background Task"]

    C -->|Phase 1-3| D["Fetch & Transform<br/>Batch: 1000 records"]
    D -->|Batches| E["Validate Records"]
    E -->|Valid| F["Upsert to PostgreSQL<br/>ON CONFLICT UPDATE"]
    F -->|Persisted| G["Job Progress: +1000"]

    G -->|More Data| H{More Records?}
    H -->|Yes| D
    H -->|No| I["All Data Persisted"]

    I -->|Phase 5-6| J["Query PostgreSQL<br/>All records"]
    J -->|Records| K["Transform to ES Docs"]
    K -->|Bulk 5000| L["Index to Elasticsearch<br/>Bulk API"]
    L -->|Indexed| M["Refresh Indices"]

    M -->|Phase 7-8| N["Update Job Status<br/>Status: completed"]
    N -->|Success| O["Response to Admin<br/>5000 records indexed<br/>4000 updated<br/>Duration: 2 minutes"]

    style A fill:#4A90E2
    style B fill:#7B68EE
    style D fill:#FF6B6B
    style F fill:#6BCF7F
    style L fill:#9D4EDD
    style O fill:#4ECDC4
```

### Batch Insertion Flow (PostgreSQL)

```mermaid
sequenceDiagram
    autonumber
    ImportPipeline->>Database: BEGIN TRANSACTION
    Note over Database: Lock transaction resources

    loop For each batch (1000 records)
        ImportPipeline->>ImportPipeline: Format batch INSERT/UPDATE
        ImportPipeline->>Database: INSERT INTO authors<br/>VALUES (...1000 rows)<br/>ON CONFLICT (key) DO UPDATE SET ...
        Database->>Database: Check constraints<br/>Apply indexes
        Database-->>ImportPipeline: Success (1000 records)
        Note over ImportPipeline: Track: +1000 processed<br/>+650 inserted<br/>+350 updated
    end

    ImportPipeline->>Database: COMMIT
    Note over Database: Flush to disk<br/>Generate WAL record
    Database-->>ImportPipeline: Transaction committed
    Note over ImportPipeline: Update job record<br/>Status: indexed
```

**Batch Upsert SQL:**
```sql
INSERT INTO authors (
  key, name, personal_name, bio, birth_date, death_date,
  alternate_names, photos, raw_data
) VALUES
  ($1, $2, $3, $4, $5, $6, $7, $8, $9),
  ($10, $11, $12, $13, $14, $15, $16, $17, $18),
  -- ... up to 1000 rows ...
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  personal_name = EXCLUDED.personal_name,
  bio = EXCLUDED.bio,
  birth_date = EXCLUDED.birth_date,
  death_date = EXCLUDED.death_date,
  alternate_names = EXCLUDED.alternate_names,
  photos = EXCLUDED.photos,
  raw_data = EXCLUDED.raw_data,
  last_imported = now();
```

**Performance:**
- Batch size: 1000 records
- Throughput: 20,000-50,000 records/second
- Network round-trips: 1 per batch
- Disk writes: Batched by PostgreSQL

### Elasticsearch Indexing Flow

```mermaid
sequenceDiagram
    autonumber
    ImportPipeline->>PostgreSQL: SELECT * FROM editions<br/>WHERE last_imported > threshold<br/>ORDER BY key
    PostgreSQL-->>ImportPipeline: Stream all records

    loop For each batch (5000 documents)
        ImportPipeline->>ImportPipeline: Transform to ES format<br/>Map fields, build actions
        ImportPipeline->>Elasticsearch: POST _bulk<br/>5000 index operations
        Elasticsearch->>Elasticsearch: Parse, analyze, tokenize<br/>Add to inverted index
        Elasticsearch-->>ImportPipeline: Success (5000 indexed)
        Note over ImportPipeline: Track: 5000 documents<br/>Batch complete
    end

    ImportPipeline->>Elasticsearch: POST /editions/_refresh
    Note over Elasticsearch: Force index refresh<br/>Make docs searchable
    Elasticsearch-->>ImportPipeline: Refresh complete
    ImportPipeline->>ImportPipeline: Update job record<br/>Status: completed
```

**Bulk API Format:**
```json
POST _bulk
{ "index": { "_index": "editions", "_id": "/books/OL1M" } }
{ "key": "/books/OL1M", "title": "The Stand", "authors": ["Stephen King"], "isbn13": ["978-0385333832"] }
{ "index": { "_index": "editions", "_id": "/books/OL2M" } }
{ "key": "/books/OL2M", "title": "It", "authors": ["Stephen King"], "isbn13": ["978-0451169174"] }
```

**Performance:**
- Bulk batch size: 5,000 documents
- Throughput: 50,000-100,000 docs/sec
- Latency: 100-200ms per batch
- Total indexing time: 5-10 minutes for 1M documents

## Admin Import Trigger Flow

```mermaid
sequenceDiagram
    autonumber
    Admin->>API: POST /import/authors<br/>{}<br/>Authorization: admin_token

    API->>API: Validate authorization
    Note over API: Check admin token

    API->>PostgreSQL: INSERT INTO import_jobs<br/>id, type: 'authors',<br/>status: 'pending'
    PostgreSQL-->>API: Job record created

    API-->>Admin: 202 Accepted<br/>{<br/>  jobId: 'job-20250115-001',<br/>  status: 'pending',<br/>  type: 'authors',<br/>  startedAt: '2025-01-15T10:00:00Z'<br/>}

    Note over API: Return immediately (async)

    API->>ImportPipeline: Start background task<br/>jobId: job-20250115-001

    ImportPipeline->>DataSource: Fetch authors from Open Library
    DataSource-->>ImportPipeline: Stream author records

    ImportPipeline->>PostgreSQL: Batch upsert authors
    ImportPipeline->>Elasticsearch: Bulk index authors

    ImportPipeline->>PostgreSQL: UPDATE import_jobs<br/>WHERE id = jobId<br/>SET status = 'completed',<br/>completed_at = now(),<br/>records_processed = 5000,<br/>records_inserted = 3000,<br/>records_updated = 2000

    Note over Admin: Admin can poll /import/{jobId}<br/>for status updates
```

**Job Status Polling:**
```
GET /import/job-20250115-001

Response:
{
  id: "job-20250115-001",
  type: "authors",
  status: "running",
  recordsProcessed: 3500,
  recordsInserted: 2100,
  recordsUpdated: 1400,
  startedAt: "2025-01-15T10:00:00Z",
  completedAt: null,
  error: null
}
```

## Health Check Flow

```mermaid
sequenceDiagram
    autonumber
    Monitor->>API: GET /health/ready

    par PostgreSQL Check
        API->>PostgreSQL: SELECT 1
        PostgreSQL-->>API: 1
    and Elasticsearch Check
        API->>Elasticsearch: GET /
        Elasticsearch-->>API: { version, cluster_name }
    end

    API->>API: All checks passed?

    alt All Ready
        API-->>Monitor: 200 OK<br/>{<br/>  ready: true,<br/>  postgres: 'ok',<br/>  elasticsearch: 'ok'<br/>}
    else One Failed
        API-->>Monitor: 503 Service Unavailable<br/>{<br/>  ready: false,<br/>  postgres: 'ok',<br/>  elasticsearch: 'connection_error'<br/>}
    end
```

## Database Connection Lifecycle

```mermaid
graph LR
    A["Client Request"] -->|GET /search| B["API Handler"]
    B -->|Pool.query| C["Connection Pool"]
    C -->|Available?| D{Pool State}

    D -->|Yes| E["Get from pool<br/>Reuse existing"]
    D -->|No| F["Create new<br/>if under limit"]
    D -->|Limit hit| G["Wait in queue<br/>timeout: 5s"]

    E -->|Execute| H["PostgreSQL<br/>Execute Query"]
    F -->|Connect| H
    G -->|Acquire| H

    H -->|Result| I["Return result<br/>to handler"]
    I -->|Process| B
    B -->|Return connection<br/>to pool| C

    C -->|Mark available<br/>for reuse| J["Pool Ready"]
    J -->|Next request| C
```

**Connection Pool Configuration:**
- Min connections: 2
- Max connections: 10
- Idle timeout: 30 seconds
- Query timeout: 30 seconds

## Elasticsearch Query Lifecycle

```mermaid
sequenceDiagram
    autonumber
    Client->>API: GET /search?q=database

    API->>API: Parse query
    Note over API: Extract search term<br/>Validate parameters

    API->>Elasticsearch: GET /editions/_search<br/>{<br/>  "query": {<br/>    "multi_match": {<br/>      "query": "database",<br/>      "fields": ["title", "authors"]<br/>    }<br/>  }<br/>}

    Elasticsearch->>Elasticsearch: Parse query DSL
    Elasticsearch->>Elasticsearch: Apply query_analyzer<br/>Tokenize: ["database"]<br/>Lowercase: ["database"]<br/>Asciifolding: ["database"]

    Elasticsearch->>Elasticsearch: Search inverted index<br/>1. Find "database" in title field
    Elasticsearch->>Elasticsearch: 2. Find "database" in authors field

    Elasticsearch->>Elasticsearch: Collect matching docs
    Elasticsearch->>Elasticsearch: Score using BM25<br/>Calculate TF, IDF, field length norm

    Elasticsearch->>Elasticsearch: Sort by score (descending)
    Elasticsearch->>Elasticsearch: Apply limit: 20 results

    Elasticsearch-->>API: Results<br/>[<br/>  { _id: "/books/1", _score: 8.5 },<br/>  { _id: "/books/2", _score: 7.2 },<br/>  ...<br/>]

    API->>API: Extract IDs from results
    API->>PostgreSQL: Fetch full documents
    PostgreSQL-->>API: Complete edition objects
    API-->>Client: JSON response
```

## Batch Processing Flow

```mermaid
sequenceDiagram
    autonumber
    ImportPipeline->>ImportPipeline: Initialize batch[]
    ImportPipeline->>ImportPipeline: batchSize = 1000
    ImportPipeline->>ImportPipeline: processed = 0

    loop DataSource Stream
        ImportPipeline->>DataSource: Read next record
        DataSource-->>ImportPipeline: Record

        ImportPipeline->>ImportPipeline: Transform record
        ImportPipeline->>batch: Push transformed record
        ImportPipeline->>ImportPipeline: processed++

        alt batch.size() >= batchSize
            ImportPipeline->>PostgreSQL: INSERT/UPDATE batch
            PostgreSQL-->>ImportPipeline: Success

            ImportPipeline->>ImportPipeline: Clear batch
            ImportPipeline->>ImportPipeline: Track progress
            ImportPipeline->>ImportPipeline: Log: 'Processed 1000/50000'
        end
    end

    alt batch has remaining records
        ImportPipeline->>PostgreSQL: INSERT/UPDATE final batch
        PostgreSQL-->>ImportPipeline: Success
    end

    ImportPipeline->>ImportPipeline: Return results<br/>{ totalProcessed, inserted, updated }
```

**Pseudo-code:**
```typescript
let batch = [];
let processed = 0;

for await (const record of dataSource) {
  const transformed = transformRecord(record);
  batch.push(transformed);
  processed++;

  if (batch.length >= 1000) {
    await db.upsertBatch(batch);
    batch = [];
    logProgress({ processed, total: estimate });
  }
}

// Final partial batch
if (batch.length > 0) {
  await db.upsertBatch(batch);
}

return {
  totalProcessed: processed,
  totalInserted: inserted,
  totalUpdated: updated
};
```

## Upsert Conflict Resolution Flow

```mermaid
graph TD
    A["Upsert Record<br/>key: /books/OL123M<br/>title: The Stand"] -->|INSERT| B{Key Exists?}

    B -->|No| C["Insert New Record<br/>INSERT INTO editions ..."]
    C -->|Success| D["Track: +1 inserted<br/>created_at: NOW<br/>last_imported: NOW"]

    B -->|Yes| E["Update Existing<br/>ON CONFLICT DO UPDATE<br/>UPDATE SET title = ...,<br/>last_imported = NOW"]
    E -->|Success| F["Track: +1 updated<br/>created_at: unchanged<br/>last_imported: NOW"]

    D -->|Return| G["Conflict Resolution<br/>Complete"]
    F -->|Return| G

    G -->|Success| H["Continue to<br/>next batch"]

    style C fill:#6BCF7F
    style E fill:#FFD93D
    style H fill:#4A90E2
```

## Error Handling Flows

### Database Connection Failure

```mermaid
graph TD
    A["Query Execution<br/>ERROR: Connection refused"] -->|Catch| B["Increment retry counter"]
    B -->|attempt < 3| C["Exponential Backoff<br/>wait: 100ms * 2^attempt"]
    C -->|After delay| D["Retry Query"]
    D -->|Success| E["Return result"]
    D -->|Failure| F{Retry limit?}

    F -->|No| B
    F -->|Yes| G["Return Error<br/>HTTP 503 Service Unavailable"]

    E -->|Reset retry| H["Continue"]
    G -->|Circuit open| I["Fail-fast on<br/>next request"]

    style G fill:#FF6B6B
    style E fill:#6BCF7F
```

### Import Job Error Recovery

```mermaid
graph TD
    A["Import Job<br/>Processing Batch 5"] -->|Error| B["Network timeout<br/>Open Library API"]
    B -->|Catch| C["Log error details"]
    C -->|Update DB| D["UPDATE import_jobs<br/>status: running<br/>error: null"]

    D -->|Exponential backoff| E["Wait 5 seconds"]
    E -->|Retry| F{Retry count < 5?}

    F -->|Yes| G["Retry current batch"]
    G -->|Success| H["Continue to batch 6"]
    G -->|Failure| I["Backoff again"]
    I -->|Increment attempts| F

    F -->|No| J["Update DB with error<br/>status: failed<br/>error: 'Max retries exceeded'"]
    J -->|Notify admin| K["Alert: Import failed"]

    H -->|Continue| L["Complete job"]
    L -->|Success| M["Update status: completed"]

    style J fill:#FF6B6B
    style M fill:#6BCF7F
```

## Performance Characteristics

### Search Response Time Distribution

```
Query: /search?q=database

P50:   75ms (median)
P95:   120ms (95th percentile)
P99:   180ms (99th percentile)
P99.9: 250ms (tail)

Breakdown:
- Elasticsearch: 50ms (P99)
- PostgreSQL: 20ms (P99)
- JSON: 5ms
- Network: 5ms
```

### Import Throughput

```
Dataset: 50,000 authors

Single-threaded batch processing:
- Fetch: 5-10 seconds
- Transform: 2-5 seconds
- PostgreSQL upsert: 15-25 seconds (25 batches)
- ES index: 10-15 seconds
- Total: 40-60 seconds

Throughput: 1,000 records/second average
```

### Index Size Estimates

```
PostgreSQL:
- 1M editions: ~500MB
- 100K authors: ~50MB
- 500K works: ~200MB
- Total + indexes: ~2GB

Elasticsearch:
- 1M editions index: ~800MB
- 100K authors index: ~50MB
- Total: ~1GB
```

---

**See Also:**
- [System Design](/docs/architecture/system-design) - High-level architecture
- [Database Schema](/docs/architecture/database-schema) - PostgreSQL structure
- [Elasticsearch Indices](/docs/architecture/elasticsearch-indices) - Search configuration
- [Technology Stack](/docs/architecture/technology-stack) - Dependency details
