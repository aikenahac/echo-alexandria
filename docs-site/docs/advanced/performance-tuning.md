---
sidebar_position: 1
title: Performance Tuning
---

# Performance Tuning

Comprehensive guide to optimizing Echo Alexandria for maximum performance across all layers of the stack.

## PostgreSQL Optimization

PostgreSQL performance is critical for handling large datasets and concurrent queries. Echo Alexandria uses several tuning parameters to optimize database behavior.

### Memory Configuration

PostgreSQL's memory settings have the most significant impact on performance:

#### shared_buffers

Controls the amount of memory PostgreSQL uses for caching data pages.

**Current Configuration:** `2GB` (from docker-compose.yaml)

**Calculation:** 25% of total system RAM (recommended)

```bash
# For a 16GB system
shared_buffers = 4GB

# For an 8GB system
shared_buffers = 2GB

# For a 32GB system
shared_buffers = 8GB
```

**Why it matters:** This is the primary cache for all data access. Increasing it reduces disk I/O and significantly improves query performance.

#### work_mem

Memory allocated to each individual query operation (sorting, hashing, etc.).

**Current Configuration:** `50MB` (default for all queries)

**Calculation:** Based on max_connections and system RAM

```
work_mem = (RAM - shared_buffers) / (max_connections * 2)

Example for 16GB RAM, max_connections=100:
work_mem = (16GB - 4GB) / (100 * 2) = 60MB
```

**Tuning recommendations:**
- Development: 50-100MB
- Production small: 50-100MB
- Production large: 100-200MB

```sql
-- Check current settings
SHOW shared_buffers;
SHOW work_mem;

-- Set per-session (temporary)
SET work_mem = '100MB';
```

#### maintenance_work_mem

Memory for maintenance operations like VACUUM, CREATE INDEX, ALTER TABLE.

**Current Configuration:** `1GB`

**Calculation:** 10% of system RAM (can be higher than work_mem)

```
maintenance_work_mem = RAM * 0.10

For 16GB system: 1.6GB
For 32GB system: 3.2GB
```

**Impact:** Larger values speed up index creation and VACUUM operations dramatically.

#### effective_cache_size

Informs the query planner about available cache (OS cache + shared_buffers).

**Recommended:** 50-75% of total system RAM

```bash
# For 16GB system
effective_cache_size = 8-12GB

# For 32GB system
effective_cache_size = 16-24GB
```

### Connection Pooling

Echo Alexandria's docker-compose configuration uses these connection parameters:

| Parameter | Current | Notes |
|-----------|---------|-------|
| pool_max | 20 | Maximum concurrent connections |
| idle_timeout | 20s | Drop idle connections after 20s |
| connect_timeout | 10s | Fail if can't connect in 10s |

**Optimization strategies:**

```bash
# For high concurrency (production)
DATABASE_URL=postgresql://user:pass@host/db?pool_max=50&pool_idle_timeout=30&connect_timeout=10

# For low concurrency (development)
DATABASE_URL=postgresql://user:pass@host/db?pool_max=10&pool_idle_timeout=60
```

**When to adjust:**
- Increase `pool_max` if seeing "connection pool exhausted" errors
- Decrease `pool_idle_timeout` to reduce idle connections on production
- Increase `connect_timeout` if network is unreliable

### Index Optimization

Echo Alexandria uses GIN (Generalized Inverted Index) for text search fields.

#### GIN Index Maintenance

```sql
-- Check index size
SELECT schemaname, tablename, indexname, pg_size_pretty(pg_relation_size(indexrelname::regclass))
FROM pg_indexes
WHERE tablename IN ('authors', 'works', 'editions');

-- Analyze index efficiency
VACUUM ANALYZE authors;

-- Reindex if fragmented
REINDEX INDEX CONCURRENTLY idx_editions_title;

-- Monitor index bloat
SELECT schemaname, tablename, indexname,
  ROUND(100 * (OTTA - CURRENT_OTTA) / OTTA) AS reindex_ratio
FROM pg_stat_user_indexes;
```

**Best practices:**
- Run VACUUM ANALYZE weekly on production
- REINDEX during low-traffic windows
- Monitor index bloat monthly
- Archive old data to keep indexes lean

### Query Plan Analysis

Use EXPLAIN ANALYZE to optimize slow queries:

```sql
-- Basic explain
EXPLAIN SELECT * FROM editions WHERE title LIKE '%harry%' LIMIT 10;

-- With actual execution metrics
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT * FROM editions WHERE title LIKE '%harry%' LIMIT 10;

-- Output analysis shows:
-- - Sequential Scan vs Index Scan
-- - Actual rows vs estimated rows
-- - Buffer hits/misses
```

**Query optimization checklist:**
- Ensure WHERE columns have indexes
- Use LIMIT to reduce result sets
- Avoid SELECT * (specify needed columns)
- Use BETWEEN instead of comparison operators
- Consider partial indexes for filtered queries

### Index-Only Scans

Maximize index-only scan usage to avoid table lookups:

```sql
-- Create index with additional columns for covering
CREATE INDEX idx_editions_search_covering
ON editions(title, isbn13, key)
INCLUDE (authors, publishers);

-- Query that can use index-only scan
EXPLAIN (ANALYZE)
SELECT key, title, isbn13 FROM editions
WHERE title ILIKE '%python%' LIMIT 20;
```

## Elasticsearch Tuning

Elasticsearch is the search engine powering Echo Alexandria's full-text search capabilities.

### JVM Heap Sizing

The most critical Elasticsearch setting is JVM heap allocation.

**Current Configuration:** `-Xms2g -Xmx2g` (2GB heap)

**Recommended calculation:**
```
Heap = min(system_ram * 0.50, 32GB)

For 16GB system: 8GB
For 32GB system: 16GB (capped at 32GB)
For 4GB system: 2GB
```

**Key rules:**
1. Never exceed 32GB (JVM compressed oops limitation)
2. Never exceed 50% of system RAM (OS needs memory too)
3. Minimum 2GB for production
4. Set Xms = Xmx (avoid heap resizing)

```yaml
# docker-compose.yaml configuration
environment:
  - "ES_JAVA_OPTS=-Xms8g -Xmx8g"  # For 16GB+ system
  - "ES_JAVA_OPTS=-Xms4g -Xmx4g"  # For 8GB system
```

### Node Roles and Configuration

Current setup uses a single-node cluster for development. For production:

```yaml
# Multi-node production setup
elasticsearch:
  environment:
    - "ES_JAVA_OPTS=-Xms8g -Xmx8g"
    - discovery.type=multi-node
    - discovery.seed_hosts=es-node1,es-node2,es-node3
    - cluster.initial_master_nodes=es-node1,es-node2,es-node3
    - node.roles=[master,data]  # Dedicated master nodes
```

| Node Role | Purpose | Count |
|-----------|---------|-------|
| master | Cluster state management | 3+ (odd number) |
| data | Data storage and search | 3+ |
| coordinating | Query routing | 1+ |
| ingest | Pipeline processing | 1+ |

### Shard and Replica Strategy

**Current Configuration (Development):**
- Shards: 1
- Replicas: 0

**Recommended (Production):**

```json
{
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 1,
    "index.refresh_interval": "30s"
  }
}
```

**Shard sizing guidelines:**
- Ideal shard size: 20-50GB
- Monitor with: `GET _cat/shards?v`
- Calculate shards: `ceil(total_data_size / 30GB)`

**Replica strategy:**
```
Development: 0 replicas (single node)
Small production: 1 replica (2-3 nodes)
Large production: 2 replicas (5+ nodes)
```

### Refresh Interval Tuning

Controls how often Elasticsearch makes new documents visible.

**Default:** 1 second (reasonable for most use cases)

**For bulk imports:**
```json
PUT /editions/_settings
{
  "index.refresh_interval": "5m"  // During bulk import
}

// Then restore after import
PUT /editions/_settings
{
  "index.refresh_interval": "1s"
}
```

**Impact on throughput:**
- 1s refresh: Lower throughput, real-time search
- 5s refresh: 30% higher throughput, 5s search delay
- 30s refresh: 2x higher throughput, 30s search delay

### Segment Merging

Optimize merge behavior for mixed workloads:

```json
PUT /editions/_settings
{
  "index.merge.policy.type": "tiered",
  "index.merge.policy.segments_per_tier": 10,
  "index.merge.scheduler.max_thread_count": 4
}
```

**Parameters:**
- `segments_per_tier`: Higher = fewer merges, higher search cost
- `max_thread_count`: Match CPU count for optimal throughput

### Field Data Cache

Used for sorting and aggregations on text fields.

```json
PUT /editions/_settings
{
  "index.queries.cache.enabled": true,
  "indices.queries.cache.size": "30%"
}
```

**Monitoring:**
```bash
GET /_stats/fielddata?pretty
GET /_nodes/stats/indices/fielddata?pretty
```

## Application-Level Optimization

### Connection Pool Configuration

Drizzle ORM (used by Echo Alexandria) manages PostgreSQL connections:

```typescript
// Optimal configuration
const db = new Database({
  connectionString: process.env.DATABASE_URL,
  // Connection pool settings
  max_connections: 20,      // Matches docker-compose
  idle_timeout: 20000,      // ms
  connect_timeout: 10000,   // ms
  statement_cache_size: 50
});
```

### Batch Size Optimization

Echo Alexandria uses 1000-record batches for imports. Test alternative sizes:

| Batch Size | Memory Usage | Throughput | Network Latency |
|-----------|--------------|-----------|-----------------|
| 500 | ~2.5MB | 50k rec/s | 10ms |
| 1000 | ~5MB | 100k rec/s | 15ms |
| 2000 | ~10MB | 150k rec/s | 20ms |
| 5000 | ~25MB | 140k rec/s | 50ms |

**Testing methodology:**

```typescript
const batchSizes = [500, 1000, 2000, 5000];
for (const size of batchSizes) {
  const inserter = new BatchInserter(size, upsertAuthorsBatch);
  const start = Date.now();
  // Run import
  const duration = Date.now() - start;
  const throughput = totalRecords / (duration / 1000);
  console.log(`Size ${size}: ${throughput.toFixed(0)} rec/s`);
}
```

**Recommendation:** 1000 records provides best balance of throughput and memory.

### API Response Pagination

Limit result sets to prevent memory exhaustion:

```typescript
// Current implementation
const results = await searchEditions(query, 20, offset);  // limit: 20

// Enforce maximum limits
const maxLimit = Math.min(limit || 20, 100);  // Cap at 100
const offset = Math.max(0, Math.min(offset || 0, totalResults - maxLimit));

// Return pagination metadata
return {
  results: data,
  pagination: {
    limit: maxLimit,
    offset: offset,
    total: totalResults
  }
};
```

### Result Caching Strategies

Implement caching for frequently searched queries:

**In-Memory Cache (Development):**
```typescript
import { LRUCache } from 'lru-cache';

const searchCache = new LRUCache({
  max: 1000,        // Cache 1000 queries
  ttl: 1000 * 60 * 5,  // 5 minute TTL
  updateAgeOnGet: true
});

export async function cachedSearch(query: string) {
  const cached = searchCache.get(query);
  if (cached) return cached;

  const results = await searchEditions(query);
  searchCache.set(query, results);
  return results;
}
```

**Redis Cache (Production):**
```typescript
const redis = new Redis(process.env.REDIS_URL);
const CACHE_TTL = 300;  // 5 minutes

export async function cachedSearch(query: string) {
  const cached = await redis.get(`search:${query}`);
  if (cached) return JSON.parse(cached);

  const results = await searchEditions(query);
  await redis.setex(`search:${query}`, CACHE_TTL, JSON.stringify(results));
  return results;
}
```

## Monitoring Performance

### PostgreSQL Statistics

Monitor query performance with pg_stat_statements:

```sql
-- Enable extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Top 10 slowest queries
SELECT query, calls, mean_exec_time, max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Queries with most cache misses
SELECT query, heap_blks_read, heap_blks_hit,
  ROUND(100 * heap_blks_hit / (heap_blks_hit + heap_blks_read)::float, 2) AS cache_hit_ratio
FROM pg_stat_user_tables
ORDER BY heap_blks_read DESC;
```

### Elasticsearch Metrics

Monitor cluster health and performance:

```bash
# Cluster health
curl -s localhost:9200/_cluster/health | jq '.'

# Node statistics
curl -s localhost:9200/_cat/nodes?v

# Index statistics
curl -s localhost:9200/_cat/indices?v=true&s=store.size:desc

# Top indices by size
curl -s "localhost:9200/_cat/indices?h=index,store.size" | sort -k2 -h
```

### APM and Observability

Integrate APM for production monitoring:

```typescript
// With Elastic APM
import apm from 'elastic-apm-node';

apm.start({
  serviceName: 'echo-alexandria',
  serverUrl: process.env.APM_SERVER_URL,
  environment: process.env.NODE_ENV
});

// Transactions are tracked automatically
const span = apm.startSpan('search-editions');
const results = await searchEditions(query);
span?.end();
```

## Benchmarking Methodology

Establish performance baselines with consistent testing:

```bash
# 1. Clear caches
psql -c "SELECT pg_stat_statements_reset();"

# 2. Run warmup queries
for i in {1..100}; do
  curl "http://localhost:3000/api/search/editions?q=harry&limit=10"
done

# 3. Measure throughput
ab -n 1000 -c 10 "http://localhost:3000/api/search/editions?q=harry&limit=10"

# 4. Analyze results
# Document: requests/sec, response times, 95th percentile
```

## Performance Testing Tools

### Recommended Tools

| Tool | Purpose | Installation |
|------|---------|--------------|
| Apache Bench (ab) | HTTP load testing | Pre-installed on macOS |
| wrk | High-performance benchmarking | `brew install wrk` |
| pgBench | PostgreSQL benchmarking | `apt-get install postgresql-contrib` |
| pgAdmin | Query analysis UI | Docker image available |

### Example Benchmark Script

```bash
#!/bin/bash

echo "Echo Alexandria Performance Benchmark"
echo "======================================"

# Test 1: Search performance
echo "Test 1: Search Throughput"
ab -n 1000 -c 10 -t 60 "http://localhost:3000/api/search/editions?q=python"

# Test 2: Concurrent authors search
echo "Test 2: Concurrent Author Search"
wrk -t4 -c100 -d60s "http://localhost:3000/api/search/authors?q=smith"

# Test 3: Large result pagination
echo "Test 3: Pagination Under Load"
ab -n 500 -c 20 "http://localhost:3000/api/search/editions?q=the&limit=50&offset=0"

# Test 4: Health check response
echo "Test 4: Health Check Latency"
ab -n 5000 -c 50 "http://localhost:3000/health"
```

## Performance Tuning Checklist

- [ ] PostgreSQL shared_buffers = 25% of RAM
- [ ] work_mem = appropriate for connection count
- [ ] maintenance_work_mem = 10% of RAM
- [ ] effective_cache_size = 50-75% of RAM
- [ ] Connection pool max = 20-50 (production)
- [ ] Elasticsearch heap = 50% of RAM (max 32GB)
- [ ] Index shards = total_data_size / 30GB (production)
- [ ] Index refresh_interval = 5m during bulk import, 1s normal
- [ ] VACUUM ANALYZE scheduled weekly
- [ ] Query plans analyzed and optimized
- [ ] Batch size tested and tuned
- [ ] Caching configured for frequently searched queries
- [ ] APM/monitoring tools deployed
- [ ] Performance baselines documented
- [ ] Load testing completed before production

---

## Related Topics

- **[Scaling Guide](./scaling.md)** - Horizontal scaling strategies
- **[Custom Search](./custom-search.md)** - Optimize search relevance
- **[Batch Processing](./batch-processing.md)** - Deep dive into data imports
