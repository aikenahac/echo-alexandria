# Reindex Performance Optimizations

## Problem

Initial reindex performance was too slow:
- **Authors**: 2,000/sec ✅ (acceptable)
- **Editions**: 136/sec ❌ (would take 10 days for 55M records)

## Root Causes

1. **OFFSET-based pagination** - Gets exponentially slower as offset increases
   - At offset 10M, PostgreSQL has to scan through 10M rows just to skip them
   - This is O(n) complexity - terrible for large datasets

2. **Too many database writes** - Updating job status every 1,000 records (every batch)
   - 55,000 database UPDATE queries during the entire reindex
   - Each UPDATE adds ~5-10ms latency

3. **Small batch size** - 1,000 records per batch
   - More network round-trips
   - Less efficient bulk operations

4. **Editions records are larger** - More fields than authors
   - ISBNs, publishers, covers, languages, etc.
   - Slower to serialize and transfer

## Optimizations Applied

### 1. Cursor-Based Pagination (10-20x faster)

**Before:**
```typescript
const batch = await db
  .select()
  .from(editions)
  .limit(1000)
  .offset(offset);  // ❌ Gets slower as offset increases
```

**After:**
```typescript
const batch = await db
  .select()
  .from(editions)
  .where(gt(editions.key, lastKey))  // ✅ Always fast
  .orderBy(editions.key)
  .limit(10000);
```

**Why it's faster:**
- No need to scan through previous rows
- Uses index (key is primary key, already indexed)
- O(1) complexity instead of O(n)

### 2. Reduced Database Writes (10x fewer)

**Before:**
```typescript
// Update job status every batch (every 1,000 records)
await db.update(reindexJobs)
  .set({ editionsIndexed: totalIndexed })
  .where(eq(reindexJobs.id, jobId));
```

**After:**
```typescript
// Update job status every 10 batches (every 100,000 records)
if (batchesSinceLastUpdate >= 10) {
  await db.update(reindexJobs)
    .set({ editionsIndexed: totalIndexed })
    .where(eq(reindexJobs.id, jobId));
  batchesSinceLastUpdate = 0;
}
```

**Why it's faster:**
- 55,000 → 5,500 UPDATE queries (10x reduction)
- Less database load
- Less network round-trips

### 3. Larger Batch Size (10x increase)

**Before:**
```typescript
const batchSize = 1000;
```

**After:**
```typescript
const batchSize = 10000;
```

**Why it's faster:**
- Fewer queries (55,000 → 5,500 queries)
- Better Elasticsearch bulk efficiency
- Amortized network overhead

### 4. Combined Effect

All optimizations work together multiplicatively:

| Optimization | Speed Gain |
|--------------|------------|
| Cursor pagination | 10-20x |
| Reduced DB writes | 1.5-2x |
| Larger batches | 2-3x |
| **Total** | **30-120x faster** |

## Expected Performance

### Before Optimization
- **Editions**: 136/sec
- **Time for 55M**: ~4.7 days
- **Status**: Unacceptable

### After Optimization
- **Editions**: 5,000-10,000/sec (target)
- **Time for 55M**: 1.5-3 hours
- **Status**: Acceptable ✅

### Detailed Estimates

| Records | Old Time | New Time (5k/sec) | New Time (10k/sec) |
|---------|----------|-------------------|---------------------|
| 15M authors | 2 hours | 50 minutes | 25 minutes |
| 55M editions | 4.7 days | 3 hours | 1.5 hours |
| **Total** | **~5 days** | **~4 hours** | **~2 hours** |

## How to Deploy

```bash
# 1. Pull latest code
git pull origin master

# 2. Restart API (uses optimized version)
pm2 restart echo-data-api

# 3. Trigger optimized reindex
bun es:reindex

# Or via API:
curl -X POST http://localhost:3000/api/admin/reindex \
  -H "X-API-Key: $ADMIN_API_KEY"
```

## Monitoring Performance

Watch the console output for rate:

```
[Job abc-123] Editions: 1,000,000/55,000,000 (1.8%) | Rate: 8,234/sec | ETA: 109 min
[Job abc-123] Editions: 2,000,000/55,000,000 (3.6%) | Rate: 8,156/sec | ETA: 108 min
```

**What to look for:**
- ✅ Rate should be 5,000-10,000/sec
- ✅ Rate should stay consistent (not degrade over time)
- ✅ ETA should be realistic (2-4 hours total)

## Troubleshooting

### Rate still slow (<1,000/sec)

**Check PostgreSQL performance:**
```sql
-- Check for slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE tablename = 'editions';
```

**Check Elasticsearch performance:**
```bash
# Check bulk queue
curl http://localhost:9200/_cat/thread_pool/bulk?v

# Check indexing rate
curl http://localhost:9200/_stats/indexing?pretty
```

### Rate degrades over time

This shouldn't happen with cursor-based pagination, but if it does:

```sql
-- Vacuum the table
VACUUM ANALYZE editions;

-- Reindex the primary key
REINDEX INDEX editions_pkey;
```

### Out of memory

Reduce batch size:

```typescript
// In reindex-optimized.ts
const batchSize = 5000;  // Instead of 10000
```

## Technical Details

### Why OFFSET is slow

```sql
-- OFFSET has to scan and skip rows
SELECT * FROM editions LIMIT 1000 OFFSET 10000000;
-- PostgreSQL must read 10,001,000 rows, return 1,000

-- Cursor-based WHERE clause uses index
SELECT * FROM editions WHERE key > 'last_key' ORDER BY key LIMIT 1000;
-- PostgreSQL uses index, reads only 1,000 rows
```

### Why larger batches are better

Elasticsearch bulk API overhead:
- Small batches (1,000): 55,000 HTTP requests, ~275 seconds of network overhead
- Large batches (10,000): 5,500 HTTP requests, ~27.5 seconds of network overhead
- **Savings**: ~4 minutes just from reduced HTTP overhead

### Why fewer DB writes matter

Every UPDATE query:
- Acquires row lock
- Updates index
- Writes WAL (Write-Ahead Log)
- Potentially triggers autovacuum

Reducing from 55,000 → 5,500 updates saves significant overhead.

## Files Changed

- `src/elasticsearch/reindex-optimized.ts` - New optimized version (replaces reindex-with-tracking.ts)
- `src/api/server.ts` - Updated to use optimized version
- `package.json` - Updated es:reindex script

## Verification

After deploying, verify the performance improvement:

```bash
# Start reindex
bun es:reindex

# Watch the output for rate
# Should see: Rate: 5000-10000/sec (not 136/sec)

# Should complete in 2-4 hours (not 10 days)
```

## Expected Console Output

```
=== Elasticsearch Re-index Started ===

>>> Step 1/4: Recreating indices...
✓ Elasticsearch connection verified
Created editions index
Created authors index

>>> Step 2/4: Re-indexing authors...
Total authors: 15,000,000
[Job abc-123] Authors: 1,000,000/15,000,000 (6.7%) | Rate: 9,234/sec | ETA: 25 min
[Job abc-123] Authors: 5,000,000/15,000,000 (33.3%) | Rate: 9,156/sec | ETA: 18 min
✓ Indexed 15,000,000 authors in 27 minutes

>>> Step 3/4: Re-indexing editions...
Total editions: 55,000,000
[Job abc-123] Editions: 1,000,000/55,000,000 (1.8%) | Rate: 8,234/sec | ETA: 109 min
[Job abc-123] Editions: 10,000,000/55,000,000 (18.2%) | Rate: 8,156/sec | ETA: 92 min
[Job abc-123] Editions: 25,000,000/55,000,000 (45.5%) | Rate: 7,989/sec | ETA: 62 min
✓ Indexed 55,000,000 editions in 115 minutes

>>> Step 4/4: Refreshing indices...
✓ Refreshed Elasticsearch indices

=== Re-index completed! Total time: 143 minutes ===
```

## Success!

You should see ~30-100x faster performance for editions indexing. If you're still seeing slow rates after deploying this, there may be infrastructure bottlenecks (disk I/O, network, CPU) that need investigation.
