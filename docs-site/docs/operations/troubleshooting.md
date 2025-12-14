---
title: Troubleshooting
sidebar_position: 7
---

# Troubleshooting

Common issues encountered running Echo Alexandria and their solutions.

## Service Startup Issues

### Elasticsearch Connection Fails

**Error:** `Failed to connect to Elasticsearch`

**Causes:**
- Elasticsearch container not running
- Elasticsearch not yet ready after startup
- Incorrect `ELASTICSEARCH_URL`

**Solutions:**

```bash
# 1. Check if Elasticsearch is running
docker-compose ps elasticsearch

# 2. Check Elasticsearch logs
docker logs echo_data_elasticsearch

# 3. Wait for Elasticsearch to be ready (can take 30+ seconds)
curl -I http://localhost:9200
# Should return 200, not connection refused

# 4. Verify ELASTICSEARCH_URL environment variable
docker exec echo_data_api bash -c 'echo $ELASTICSEARCH_URL'

# 5. Test connection from API container
docker exec echo_data_api curl -v $ELASTICSEARCH_URL

# 6. Restart Elasticsearch
docker-compose restart elasticsearch
# Wait 30 seconds, then restart API
sleep 30
docker-compose restart api
```

:::tip
Elasticsearch can take 30-60 seconds to fully start. Use health checks in docker-compose to ensure startup order.
:::

### Database Connection Fails

**Error:** `FATAL: Ident authentication failed for user "postgres"`

**Causes:**
- PostgreSQL not running
- Wrong credentials in `DATABASE_URL`
- PostgreSQL not yet ready

**Solutions:**

```bash
# 1. Check if PostgreSQL is running
docker-compose ps db

# 2. Verify DATABASE_URL format
docker exec echo_data_api bash -c 'echo $DATABASE_URL'
# Should be: postgresql://user:password@db:5432/database

# 3. Check PostgreSQL logs
docker logs echo_data_db

# 4. Test connection directly
docker exec echo_data_db \
  psql -U postgres -c "SELECT NOW();"

# 5. Verify credentials match .env
grep POSTGRES_ .env
grep DATABASE_URL .env

# 6. If credentials wrong, recreate database
docker-compose down -v  # WARNING: Destructive!
# Edit .env with correct credentials
docker-compose up -d
```

### Services Won't Start

**Error:** `Error response from daemon: Conflict`

**Causes:**
- Container already running with same name
- Port already in use
- Volume conflicts

**Solutions:**

```bash
# 1. Check for existing containers
docker ps -a | grep echo

# 2. Remove conflicting containers
docker rm -f echo_data_api echo_data_db echo_data_elasticsearch

# 3. Check for port conflicts
lsof -i :5433  # PostgreSQL
lsof -i :9200  # Elasticsearch
lsof -i :3001  # API

# 4. Kill process on port
kill -9 <PID>

# 5. Try starting again
docker-compose up -d

# 6. Check logs
docker-compose logs
```

## Out of Memory Errors

### PostgreSQL Memory Errors

**Error:** `PostgreSQL killed due to OOM`

**Causes:**
- `shared_buffers` too large for available RAM
- Large query requires more memory than available
- Memory leak in application

**Solutions:**

```bash
# 1. Check available memory
free -h
docker stats

# 2. Reduce shared_buffers in docker-compose.yaml
# Change from shared_buffers=2GB to shared_buffers=1GB
docker-compose down
# Edit docker-compose.yaml
docker-compose up -d

# 3. Reduce work_mem
# In docker-compose.yaml, change work_mem=50MB to work_mem=25MB

# 4. Monitor memory during queries
watch -n 1 'docker stats echo_data_db --no-stream'

# 5. Check for long-running queries
docker exec echo_data_db \
  psql -U postgres -c "
    SELECT pid, usename, query, query_start
    FROM pg_stat_activity
    WHERE query NOT LIKE '%pg_stat_activity%'
    ORDER BY query_start DESC;"

# 6. Increase server RAM (permanent solution)
# Scale up Docker memory allocation or upgrade server
```

### Elasticsearch Memory Errors

**Error:** `OutOfMemoryError: heap space` in Elasticsearch logs

**Causes:**
- ES_JAVA_OPTS heap too large for available RAM
- Large index consuming excessive memory
- Too many shards

**Solutions:**

```bash
# 1. Check current heap allocation
docker logs echo_data_elasticsearch | grep "Xmx"

# 2. Check available memory
docker stats echo_data_elasticsearch --no-stream

# 3. Reduce heap size in docker-compose.yaml
# Change from: ES_JAVA_OPTS=-Xms2g -Xmx2g
# To: ES_JAVA_OPTS=-Xms1g -Xmx1g

docker-compose down
docker-compose up -d

# 4. Monitor memory usage
watch -n 5 'curl -s http://localhost:9200/_nodes/stats | jq ".nodes[].jvm.mem"'

# 5. Check index sizes
curl http://localhost:9200/_cat/indices?v&bytes=b

# 6. Delete unused indexes if necessary
curl -X DELETE http://localhost:9200/index_name
```

:::danger
Never set Elasticsearch heap > 31GB (compressed object pointer limit) or > 50% available RAM.
:::

### API Memory Errors

**Error:** `JavaScript heap out of memory`

**Solutions:**

```bash
# 1. Increase Node.js heap limit (before Bun runtime)
# In docker-compose.yaml, add to api service:
environment:
  NODE_OPTIONS: "--max-old-space-size=2048"

# 2. Or set in .env
NODE_OPTIONS=--max-old-space-size=2048

# 3. Restart API
docker-compose restart api

# 4. Monitor memory during import
docker stats echo_data_api --no-stream --interval 5
```

## Elasticsearch Index Problems

### Index Not Created

**Error:** `Index 'editions' not found` in search responses

**Causes:**
- Data not imported yet
- Import failed silently
- Index creation failed

**Solutions:**

```bash
# 1. Check if data exists in database
docker exec echo_data_db \
  psql -U postgres -d echo_data_source -c "SELECT COUNT(*) FROM editions;"

# 2. Check if Elasticsearch indexes exist
curl http://localhost:9200/_cat/indices?v

# 3. If data exists but no index, manually reindex
docker exec echo_data_api \
  bun src/scripts/reindex.ts

# 4. Check for indexing errors
curl http://localhost:9200/editions/_stats | jq '.indices.editions'

# 5. Clear and recreate index
curl -X DELETE http://localhost:9200/editions
docker exec -it echo_data_api bun src/jobs/refresh.ts

# 6. Verify index creation
curl http://localhost:9200/editions/_mapping | jq .
```

### Search Returns No Results

**Error:** API returns 0 results for valid queries

**Causes:**
- Index not created
- Query syntax error
- Data doesn't match search terms
- Elasticsearch down

**Solutions:**

```bash
# 1. Check Elasticsearch health
curl http://localhost:9200/_cluster/health

# 2. Verify index exists and has data
curl http://localhost:9200/editions/_count

# 3. Check index mapping
curl http://localhost:9200/editions/_mapping | jq .

# 4. Test search with simple query
curl -X GET "localhost:9200/editions/_search" \
  -H 'Content-Type: application/json' \
  -d '{"query": {"match_all": {}}}'

# 5. Check query analyzer
curl -X GET "localhost:9200/editions/_analyze" \
  -H 'Content-Type: application/json' \
  -d '{
    "analyzer": "standard",
    "text": "harry potter"
  }'

# 6. Verify import completed successfully
docker logs echo_data_api | tail -50 | grep -i "complete\|error\|index"
```

## Import Failures

### Import Stops Midway

**Error:** Import process hangs or fails at specific record count

**Causes:**
- Network timeout during large file download
- Database connection lost
- Insufficient disk space
- Memory exhaustion

**Solutions:**

```bash
# 1. Check available disk space
docker exec echo_data_api df -h /app/data

# 2. Check database connection
docker exec echo_data_db pg_isready -U postgres

# 3. Check logs for specific error
docker logs echo_data_api | tail -100

# 4. Check Elasticsearch is still running
curl http://localhost:9200

# 5. If disk full, clear space
docker system prune -a  # WARNING: Removes all unused images/containers

# 6. Retry import from the beginning
docker exec -it echo_data_api bun src/jobs/refresh.ts
```

### Author Import Completes But Works Import Fails

**Error:** `Foreign key violation` in works import

**Causes:**
- Authors table incomplete or corrupted
- Import order not followed

**Solutions:**

```bash
# 1. Verify authors imported successfully
docker exec echo_data_db \
  psql -U postgres -d echo_data_source \
  -c "SELECT COUNT(*) FROM authors;"

# 2. Check for NULL or invalid author IDs
docker exec echo_data_db \
  psql -U postgres -d echo_data_source \
  -c "SELECT COUNT(*) FROM works WHERE author_id IS NULL;"

# 3. If authors incomplete, re-import
docker exec -it echo_data_api bun src/import/authors.ts

# 4. Clear works table and retry
docker exec echo_data_db \
  psql -U postgres -d echo_data_source \
  -c "TRUNCATE TABLE works CASCADE;"

# 5. Re-run works import
docker exec -it echo_data_api bun src/import/works.ts
```

### Editions Import Very Slow

**Error:** Import taking > 8 hours for editions

**Causes:**
- Insufficient resources
- Slow disk I/O
- Slow network connection
- High database load

**Solutions:**

```bash
# 1. Increase database work_mem temporarily
docker exec echo_data_db \
  psql -U postgres -c "ALTER SYSTEM SET work_mem = '256MB';"
docker exec echo_data_db pg_ctl reload

# 2. Monitor progress
watch -n 30 'docker exec echo_data_db \
  psql -U postgres -d echo_data_source -c \
  "SELECT COUNT(*) FROM editions;"'

# 3. Check disk I/O
iostat -x 1

# 4. Check network speed
iperf -c openlibrary.org  # Rough estimation

# 5. Stop conflicting processes
docker stats  # See CPU/memory usage
# Stop non-essential containers

# 6. Resume and complete
# Don't interrupt; let it finish

# 7. After completion, restore normal settings
docker exec echo_data_db \
  psql -U postgres -c "ALTER SYSTEM SET work_mem = '50MB';"
```

## Network Issues

### Can't Reach API from Host

**Error:** `Connection refused` or `Network unreachable`

**Causes:**
- API not running
- Port mapping incorrect
- Firewall blocking

**Solutions:**

```bash
# 1. Check if API is running
docker-compose ps api

# 2. Check port mapping
docker ps | grep echo_data_api
# Should show: 0.0.0.0:3001->3000/tcp

# 3. Test from within container
docker exec echo_data_api curl http://localhost:3000/health

# 4. Test port on host
curl http://localhost:3001/health

# 5. Check firewall
sudo iptables -L | grep 3001
# Or check firewall settings on macOS/Windows

# 6. Check Docker network
docker network inspect echo-alexandria-network

# 7. If everything looks good, restart
docker-compose restart api
```

### Internal Service Communication Fails

**Error:** API can't reach database or Elasticsearch

**Causes:**
- Services not on same network
- DNS resolution failure
- Service port incorrect

**Solutions:**

```bash
# 1. Verify all services are on same network
docker network inspect echo-alexandria-network

# 2. Test DNS resolution from API container
docker exec echo_data_api nslookup db
docker exec echo_data_api nslookup elasticsearch

# 3. Test connectivity from API container
docker exec echo_data_api curl http://elasticsearch:9200
docker exec echo_data_api \
  psql -h db -U postgres -c "SELECT NOW();"

# 4. Check environment variables
docker exec echo_data_api bash -c 'env | grep -E "DATABASE|ELASTICSEARCH"'

# 5. Ensure services are actually running
docker-compose ps

# 6. Restart all services in order
docker-compose restart
# Wait 30 seconds
docker-compose restart api
```

## Data Integrity Issues

### Data Appears Corrupted

**Error:** Invalid JSON, malformed records, NULL values where shouldn't be

**Causes:**
- Import interrupted
- Database corruption
- Encoding issues

**Solutions:**

```bash
# 1. Check database integrity
docker exec echo_data_db \
  psql -U postgres -d echo_data_source -c \
  "REINDEX DATABASE echo_data_source;"

# 2. Check for invalid records
docker exec echo_data_db \
  psql -U postgres -d echo_data_source -c "
    SELECT COUNT(*) FROM authors WHERE name IS NULL;
    SELECT COUNT(*) FROM works WHERE title IS NULL;
    SELECT COUNT(*) FROM editions WHERE isbn IS NULL;"

# 3. Vacuum and analyze
docker exec echo_data_db \
  psql -U postgres -d echo_data_source -c \
  "VACUUM ANALYZE;"

# 4. If corruption persists, restore from backup
gunzip -c /backups/echo_data_backup.sql.gz | \
  docker exec -i echo_data_db \
  psql -U postgres -d echo_data_source

# 5. Re-run import if necessary
docker exec -it echo_data_api bun src/jobs/refresh.ts
```

## Performance Issues

### Slow Search Queries

**Error:** API search takes > 2 seconds

**Causes:**
- Missing database indexes
- Elasticsearch shard issues
- Elasticsearch resources exhausted

**Solutions:**

```bash
# 1. Check query time
time curl "http://localhost:3001/api/search/editions?q=harry+potter"

# 2. Check database indexes
docker exec echo_data_db \
  psql -U postgres -d echo_data_source -c \
  "SELECT schemaname, tablename, indexname FROM pg_indexes
   WHERE schemaname = 'public'
   ORDER BY tablename;"

# 3. Check index usage
docker exec echo_data_db \
  psql -U postgres -d echo_data_source -c \
  "SELECT schemaname, tablename, indexname, idx_scan
   FROM pg_stat_user_indexes
   ORDER BY idx_scan DESC;"

# 4. Check Elasticsearch performance
curl http://localhost:9200/editions/_stats | jq '.indices.editions.primaries'

# 5. Reindex if necessary
docker-compose restart elasticsearch
# Wait for recovery, then reindex
curl -X POST "localhost:9200/editions/_forcemerge"
```

### High CPU Usage

**Error:** Docker containers using > 80% CPU

**Causes:**
- Import running
- Large queries
- Inefficient code

**Solutions:**

```bash
# 1. Identify which service
docker stats

# 2. Check if import is running
ps aux | grep "bun src"

# 3. If import, wait for completion
docker logs -f echo_data_api | grep -i progress

# 4. If application, check slow queries
docker exec echo_data_db \
  psql -U postgres -d echo_data_source -c \
  "SELECT query, calls, total_time, mean_time
   FROM pg_stat_statements
   ORDER BY mean_time DESC LIMIT 10;"

# 5. Check Elasticsearch CPU
curl http://localhost:9200/_nodes/stats | jq '.nodes[].process.cpu'

# 6. Restart Elasticsearch if stuck
docker-compose restart elasticsearch
```

## Log Analysis

### Finding Errors in Logs

```bash
# Show only errors
docker-compose logs | grep -i error

# Show errors with context
docker-compose logs | grep -B5 -A5 ERROR

# Show warnings and errors
docker-compose logs | grep -iE "warning|error|fatal"

# Show application startup logs
docker-compose logs api | head -50

# Count error occurrences
docker-compose logs | grep -ic error

# Follow specific service logs
docker-compose logs -f api | grep -i "elasticsearch\|postgres"
```

### Common Error Messages

| Error | Meaning | Action |
|-------|---------|--------|
| `ECONNREFUSED` | Service not running | Start service, check port |
| `ENOENT` | File not found | Check file paths, volumes |
| `ENOMEM` | Out of memory | Increase RAM allocation |
| `ETIMEDOUT` | Connection timeout | Check network, restart services |
| `EACCES` | Permission denied | Check file permissions |
| `ENOTFOUND` | DNS failure | Check service names, network |

## Debug Commands

Quick reference for common debugging tasks:

```bash
# Full system status
docker-compose ps
docker-compose logs --tail=50

# Database diagnostics
docker exec echo_data_db \
  psql -U postgres -d echo_data_source \
  -c "\dt"  # List tables

# Elasticsearch diagnostics
curl http://localhost:9200/_cluster/health?pretty

# API health
curl http://localhost:3001/health | jq .

# Disk usage
docker system df
du -sh /var/lib/docker/volumes/*/\_data

# Network issues
docker network ls
docker network inspect echo-alexandria-network

# Resource usage
docker stats --no-stream

# Specific container logs
docker logs --tail=100 -f echo_data_api
```

## Getting Help

### Before Reporting Issues

1. Collect logs: `docker-compose logs > debug.log`
2. Check disk space: `df -h`
3. Check memory: `free -h`
4. Check running containers: `docker ps`
5. Verify connectivity: `curl http://localhost:3001/health`
6. Check error messages in logs

### Useful Information to Provide

- Docker version: `docker --version`
- Docker Compose version: `docker-compose --version`
- Host OS and version
- Available RAM and disk space
- Complete error message with context
- Relevant logs (from `docker-compose logs`)
- Steps to reproduce the issue

## Next Steps

- Review [Deployment](./deployment.md) best practices
- Check [Monitoring](./monitoring.md) for early issue detection
- See [Data Import](./data-import.md) for import-specific help
- Reference [Docker Setup](./docker-setup.md) for configuration details
