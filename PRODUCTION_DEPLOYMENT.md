# Production Deployment Guide - Elasticsearch Search Optimization

## Quick Deploy Steps

```bash
# 1. Pull latest code
git pull origin master

# 2. Install dependencies (if needed)
bun install

# 3. Run database migration (adds reindex_jobs table)
bun db:push

# 4. Restart API server
pm2 restart echo-data-api
# or: docker compose restart api

# 5. Trigger reindex via API (or admin panel)
curl -X POST http://localhost:3000/api/admin/reindex \
  -H "X-API-Key: $ADMIN_API_KEY"

# 6. Monitor progress
curl http://localhost:3000/api/admin/reindex/status \
  -H "X-API-Key: $ADMIN_API_KEY"
```

## What's New

### Backend Changes

1. **Fixed Database Query Issue** (`src/elasticsearch/reindex-from-db.ts`)
   - Fixed Drizzle ORM count query that was causing crashes
   - Changed from `db.execute(sql\`SELECT COUNT...\`)` to `db.select({ count: count() })`

2. **New Reindex Job Tracking** (`src/db/schema.ts`)
   - Added `reindex_jobs` table to track re-index progress
   - Similar to `import_jobs` but for Elasticsearch operations
   - Stores: jobId, status, progress, phase, timing, errors

3. **Reindex with Progress Tracking** (`src/elasticsearch/reindex-with-tracking.ts`)
   - New version that updates job status in real-time
   - Updates database every 1000 records
   - Tracks current phase (recreating indices, indexing authors, indexing editions, refreshing)
   - CLI-friendly with job ID tracking

4. **Admin API Endpoints** (`src/api/server.ts`)
   - `POST /api/admin/reindex` - Trigger re-index (protected by API key)
   - `GET /api/admin/reindex/status` - Get current job status with progress %

### Frontend Integration

See `ADMIN_PANEL_INTEGRATION.md` for complete React component to add to your admin panel.

Key features:
- Real-time progress tracking (polls every 5 seconds)
- Shows current phase and progress percentage
- Displays indexed counts for authors and editions
- Trigger button to start new reindex
- Error display if reindex fails

## Deployment Checklist

### Pre-Deployment

- [ ] Review changes in this PR
- [ ] Test locally with `bun es:reindex`
- [ ] Verify database migration works: `bun db:push`
- [ ] Test API endpoints with curl commands
- [ ] Review admin panel integration guide

### Production Deployment

- [ ] **Step 1**: Deploy backend code
  ```bash
  git pull origin master
  bun install
  ```

- [ ] **Step 2**: Run database migration
  ```bash
  bun db:push
  ```

- [ ] **Step 3**: Restart API server
  ```bash
  pm2 restart echo-data-api
  # or
  docker compose restart api
  ```

- [ ] **Step 4**: Verify API is running
  ```bash
  curl http://localhost:3000/health
  ```

- [ ] **Step 5**: Trigger reindex (choose one method)

  **Method A: Via API**
  ```bash
  curl -X POST http://localhost:3000/api/admin/reindex \
    -H "X-API-Key: $ADMIN_API_KEY"
  ```

  **Method B: Via CLI**
  ```bash
  bun es:reindex
  ```

- [ ] **Step 6**: Monitor progress
  ```bash
  # Check status every minute
  watch -n 60 'curl -s http://localhost:3000/api/admin/reindex/status \
    -H "X-API-Key: $ADMIN_API_KEY" | jq'
  ```

### Post-Deployment

- [ ] Wait for reindex to complete (~2-4 hours)
- [ ] Verify search improvements:
  ```bash
  # Test multi-field search
  curl 'http://localhost:3000/api/search/editions?q=harry+potter'

  # Test author search
  curl 'http://localhost:3000/api/search/editions?q=jk+rowling'
  ```

- [ ] Check reindex job status in database:
  ```sql
  SELECT * FROM reindex_jobs ORDER BY started_at DESC LIMIT 1;
  ```

- [ ] Update admin panel frontend (see ADMIN_PANEL_INTEGRATION.md)

## Rollback Plan

If something goes wrong:

```bash
# 1. Stop any running reindex
# (Find the process and kill it, or wait for it to fail)

# 2. Revert code
git checkout <previous-commit>

# 3. Restart API
pm2 restart echo-data-api

# 4. Optional: Revert database migration
# (Only if the migration caused issues)
# Manually drop the reindex_jobs table if needed
```

## Monitoring

### Check Reindex Progress

```bash
# Via API (formatted with jq)
curl -s http://localhost:3000/api/admin/reindex/status \
  -H "X-API-Key: $ADMIN_API_KEY" | jq

# Via database
docker compose exec db psql -U postgres -d echo_data -c \
  "SELECT id, status, current_phase, authors_indexed, total_authors,
   editions_indexed, total_editions, started_at
   FROM reindex_jobs ORDER BY started_at DESC LIMIT 1;"
```

### Check Elasticsearch Health

```bash
# Check if Elasticsearch is running
curl http://localhost:9200

# Check index stats
curl http://localhost:9200/_cat/indices?v

# Check specific index
curl http://localhost:9200/editions/_stats?pretty
```

### Check API Logs

```bash
# If using PM2
pm2 logs echo-data-api --lines 100

# If using Docker
docker compose logs -f api
```

## Performance Expectations

With your dataset (15M authors, 55M editions):

| Metric | Expected Value |
|--------|---------------|
| Total time | 2-4 hours |
| Indexing rate | 5,000-10,000 docs/sec |
| Peak memory (ES) | ~4GB |
| Peak memory (API) | ~500MB |
| Disk usage increase | ~500MB |

## Troubleshooting

### Issue: "TypeError: undefined is not an object"

**Fixed!** This was the count query issue. Make sure you deployed the latest code.

### Issue: Reindex hangs at 0%

**Solution:**
- Check Elasticsearch is running: `curl http://localhost:9200`
- Check PostgreSQL connection: `bun db:studio`
- Check API logs for errors: `pm2 logs echo-data-api`

### Issue: Out of memory

**Solution:**
- Increase Elasticsearch heap: `ES_JAVA_OPTS=-Xms4g -Xmx4g`
- Reduce batch size in `reindex-with-tracking.ts` (change 1000 to 500)

### Issue: API endpoint returns 401

**Solution:**
- Verify `X-API-Key` header matches `ADMIN_API_KEY` in `.env`
- Check API key in request: `echo $ADMIN_API_KEY`

## Files Changed

### Backend
- `src/db/schema.ts` - Added reindex_jobs table
- `src/elasticsearch/reindex-from-db.ts` - Fixed count query
- `src/elasticsearch/reindex-with-tracking.ts` - New job tracking version
- `src/api/server.ts` - Added reindex endpoints
- `package.json` - Updated es:reindex script
- `drizzle/0001_bizarre_living_tribunal.sql` - Migration file (generated)

### Documentation
- `ELASTICSEARCH_REINDEX_GUIDE.md` - User guide
- `ADMIN_PANEL_INTEGRATION.md` - Frontend integration guide
- `PRODUCTION_DEPLOYMENT.md` - This file

## Support

If you encounter issues:

1. Check logs: `pm2 logs echo-data-api`
2. Check database: `bun db:studio`
3. Check Elasticsearch: `curl http://localhost:9200/_cluster/health?pretty`
4. Review error in `reindex_jobs` table
5. Try running CLI version: `bun es:reindex`

## Next Steps

After deployment:

1. ✅ Monitor reindex progress in admin panel
2. ✅ Wait for completion (~2-4 hours)
3. ✅ Test search improvements
4. ✅ Update admin panel with reindex UI component
5. ✅ Document new search features for users
6. ✅ Consider adding search analytics to track improvement

## Success Criteria

Search is working correctly when:

- ✅ "harry potter" returns Harry Potter books first
- ✅ "jk rowling" returns all J.K. Rowling books
- ✅ Exact titles appear as first result
- ✅ Books with covers/ISBNs rank higher than incomplete editions
- ✅ Typos still find relevant results ("harri poter" → Harry Potter)

Test these after reindex completes!
