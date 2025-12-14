# Elasticsearch Re-indexing Guide

## Quick Start (Production)

To apply the new search improvements to your production environment **without re-importing from OpenLibrary dumps**:

```bash
# Re-index from existing PostgreSQL data
bun es:reindex
```

This will:
1. ✅ Recreate Elasticsearch indices with new mappings
2. ✅ Re-index all authors and editions from PostgreSQL
3. ✅ Compute quality fields for all editions
4. ✅ Takes ~2-4 hours (vs 4 days for full import)

## What Changed

### New Search Features
- **Multi-field search**: Now searches title + authors + edition name (was title-only)
- **Author search**: `"jk rowling"` now returns all books by J.K. Rowling (was broken)
- **Quality ranking**: Books with covers, ISBNs, and authors rank higher than bootlegs
- **Exact match**: Case-insensitive exact title matching (was case-sensitive)
- **Typo handling**: Fuzzy matching handles common typos (was exact-only)
- **English stemming**: "running" matches "run", stop words removed ("the", "and")

### Performance
- Query time: ~100-150ms (was ~20-30ms, but relevance is dramatically better)
- Index size: +~500MB for quality fields (+1% increase)
- Re-index time: ~2-4 hours from PostgreSQL (vs 4 days from OpenLibrary dumps)

## Commands

```bash
# Re-index from PostgreSQL (recommended for production updates)
bun es:reindex

# Test search with sample data
bun es:test

# Full import from OpenLibrary dumps (use for initial setup or monthly refresh)
bun import:all
```

## Production Deployment Steps

### Option 1: Zero-Downtime (Recommended)

If you need zero downtime, use Elasticsearch aliases:

```bash
# 1. Create new index with timestamp
# Edit src/elasticsearch/indices.ts and change index names to:
#   editions_20231214  (instead of editions)
#   authors_20231214   (instead of authors)

# 2. Run re-index to populate new index
bun es:reindex

# 3. Create aliases pointing to new index
curl -X POST "localhost:9200/_aliases" -H 'Content-Type: application/json' -d'
{
  "actions": [
    { "add": { "index": "editions_20231214", "alias": "editions" } },
    { "add": { "index": "authors_20231214", "alias": "authors" } }
  ]
}
'

# 4. Delete old indices (after verifying new ones work)
curl -X DELETE "localhost:9200/editions_20231213"
curl -X DELETE "localhost:9200/authors_20231213"
```

### Option 2: Simple (Brief Downtime)

If you can tolerate ~2-4 hours of degraded search:

```bash
# 1. Run re-index script
bun es:reindex

# 2. Verify search works
bun es:test

# 3. Restart API server
bun dev
```

## Verification

After re-indexing, test these queries:

```bash
# Test 1: Multi-field search
curl 'http://localhost:3000/api/search/editions?q=harry+potter&limit=5'

# Test 2: Author search (was broken before)
curl 'http://localhost:3000/api/search/editions?q=jk+rowling&limit=5'

# Test 3: Exact title match
curl 'http://localhost:3000/api/search/editions?q=harry+potter+and+the+order+of+the+phoenix&limit=5'

# Test 4: Typo handling
curl 'http://localhost:3000/api/search/editions?q=harri+poter&limit=5'
```

Expected results:
- ✅ Legitimate editions with covers/ISBNs rank first
- ✅ Author searches return all books by that author
- ✅ Exact titles appear as first result
- ✅ Typos still find relevant books

## Estimated Times (55M editions + 15M authors)

| Task | Time | Notes |
|------|------|-------|
| Re-index from PostgreSQL | 2-4 hours | Recommended for updates |
| Full import from dumps | 4 days | Only needed monthly or initial setup |
| Index creation | <1 minute | Happens automatically |

## Troubleshooting

### Re-index is slow
- Check PostgreSQL connection pool size
- Increase batch size in `src/elasticsearch/reindex-from-db.ts` (default: 1000)
- Check Elasticsearch heap size (`ES_JAVA_OPTS=-Xms2g -Xmx2g`)

### Out of memory
- Reduce batch size to 500 or 250
- Increase Elasticsearch heap: `ES_JAVA_OPTS=-Xms4g -Xmx4g`

### Connection errors
- Ensure Elasticsearch is running: `docker compose up -d elasticsearch`
- Check connection: `curl http://localhost:9200`
- Verify DATABASE_URL and ELASTICSEARCH_URL in `.env`

## Files Modified

- `src/elasticsearch/indices.ts` - New analyzers and mappings
- `src/elasticsearch/indexing.ts` - Quality field computation
- `src/elasticsearch/search.ts` - 7-tier query with function_score
- `src/elasticsearch/reindex-from-db.ts` - **New** re-indexing script
- `src/elasticsearch/test-search.ts` - **New** test script
- `package.json` - Added `es:reindex` and `es:test` scripts

## Rollback

If you need to rollback:

```bash
# 1. Checkout previous version
git checkout <previous-commit>

# 2. Reinstall dependencies
bun install

# 3. Re-index with old mappings
bun es:reindex
```

## Questions?

- Check test results: `bun es:test`
- View Elasticsearch indices: `curl http://localhost:9200/_cat/indices?v`
- Check index mappings: `curl http://localhost:9200/editions/_mapping?pretty`
- Monitor re-index progress: Watch console output (updates every 10 seconds)
