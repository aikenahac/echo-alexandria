---
title: Data Import
sidebar_position: 4
---

# Data Import

Running and managing OpenLibrary data imports with detailed scheduling and monitoring guidance.

## Overview

Echo Alexandria imports book data from OpenLibrary in three stages, executed in strict order:

1. **Authors** - Author metadata (~500MB, 5-15 minutes)
2. **Works** - Book works and relationships (~2GB, 30-60 minutes)
3. **Editions** - Individual book editions (~45GB, 4-8 hours)

The import process handles streaming large files efficiently, parsing JSON-based dumps, and batch-inserting records.

## Import Commands

### Import Authors Only

```bash
# From project root
bun src/import/authors.ts

# Or via Docker container
docker exec -it echo_data_api bun src/import/authors.ts

# Or via npm script
npm run import:authors
```

**Details:**
- Downloads authors data from OpenLibrary
- Import time: 5-15 minutes (depending on network speed)
- Disk usage: ~500MB temporary + ~1GB final
- Records created: ~5 million authors
- Can be run independently (no dependencies)

### Import Works

```bash
# From project root
bun src/import/works.ts

# Or via Docker container
docker exec -it echo_data_api bun src/import/works.ts

# Or via npm script
npm run import:works
```

**Details:**
- Downloads works data from OpenLibrary
- Requires: Authors must be imported first
- Import time: 30-60 minutes
- Disk usage: ~5GB temporary + ~8GB final
- Records created: ~2 million works
- Creates author-work relationships

### Import Editions

```bash
# From project root
bun src/import/editions.ts

# Or via Docker container
docker exec -it echo_data_api bun src/import/editions.ts

# Or via npm script
npm run import:editions
```

**Details:**
- Downloads editions data from OpenLibrary
- Requires: Works must be imported first
- Import time: 4-8 hours
- Disk usage: ~45GB temporary + ~150GB final (after indexing)
- Records created: ~150 million editions
- Most time-consuming import

### Full Import (All Three)

```bash
# From project root
bun src/jobs/refresh.ts

# Or via Docker container
docker exec -it echo_data_api bun src/jobs/refresh.ts

# Or via npm script
npm run import:all
```

**Details:**
- Executes: Authors → Works → Editions (in order)
- Total time: ~5-9 hours for complete dataset
- Disk usage: ~60GB temporary + ~160GB final
- Full-text search indexes created automatically
- Progress shown for each stage

The `refresh.ts` orchestrator enforces import order and handles errors:

```typescript
export async function refreshAll() {
  console.log("Starting monthly OpenLibrary data refresh");

  try {
    // Step 1: Import Authors
    console.log("[1/3] Importing authors...");
    await importAuthors();

    // Step 2: Import Works
    console.log("[2/3] Importing works...");
    await importWorks();

    // Step 3: Import Editions
    console.log("[3/3] Importing editions...");
    await importEditions();

    console.log("✓ Monthly refresh complete!");
  } catch (error) {
    console.error("✗ Monthly refresh failed:", error);
    process.exit(1);
  }
}
```

## Import Workflow

### Manual Import Checklist

```bash
# 1. Verify connectivity
docker exec -it echo_data_api curl -s http://elasticsearch:9200 | jq .

# 2. Check available disk space
docker exec echo_data_api df -h /app/data

# 3. Start import
docker exec -it echo_data_api bun src/jobs/refresh.ts

# 4. Monitor progress (in another terminal)
docker logs -f echo_data_api

# 5. Verify results
docker exec echo_data_db psql -U postgres -d echo_data_source \
  -c "SELECT COUNT(*) FROM authors; SELECT COUNT(*) FROM works;"
```

### Background Import with Logging

```bash
# Run import in background and capture logs
docker exec -it echo_data_api bun src/jobs/refresh.ts > import.log 2>&1 &

# Monitor logs in real-time
tail -f import.log

# Check import status
ps aux | grep "bun src/jobs/refresh.ts"
```

## Import Scheduling

### Monthly Cron Job

Schedule automatic imports on the 1st of each month at 2 AM (low-traffic time):

**Docker host cron:**
```bash
# Edit crontab
crontab -e

# Add this line for monthly full refresh
0 2 1 * * cd /path/to/echo-data-source && docker exec echo_data_api bun src/jobs/refresh.ts >> /var/log/echo-import.log 2>&1
```

**Docker Compose with scheduler service:**
```yaml
services:
  scheduler:
    image: mcuadros/ofelia:latest
    command: daemon --docker
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    labels:
      ofelia.enabled: "true"
      ofelia.job-exec.refresh.schedule: "0 2 1 * *"
      ofelia.job-exec.refresh.command: "bun src/jobs/refresh.ts"
```

### Kubernetes CronJob

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: echo-data-import
spec:
  schedule: "0 2 1 * *"  # 2 AM on 1st of month
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: import
            image: ghcr.io/aikenahac/echo-alexandria:master
            command: ["bun", "src/jobs/refresh.ts"]
            env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: echo-secrets
                  key: database-url
            - name: ELASTICSEARCH_URL
              valueFrom:
                secretKeyRef:
                  name: echo-secrets
                  key: elasticsearch-url
          restartPolicy: OnFailure
```

## Partial Imports

### Refresh Only Authors

Useful for updating author data without re-importing works and editions:

```bash
docker exec -it echo_data_api bun src/import/authors.ts
```

### Refresh Authors and Works

Update two tiers without the expensive editions import:

```bash
docker exec -it echo_data_api bash -c '\
  bun src/import/authors.ts && \
  bun src/import/works.ts'
```

## Resource Requirements

### Minimum Hardware for Import

| Tier | CPU | RAM | Disk | Time |
|------|-----|-----|------|------|
| Authors only | 2 cores | 4GB | 10GB | 5-15 min |
| Authors + Works | 2 cores | 6GB | 20GB | 45-90 min |
| Full import | 4+ cores | 8GB+ | 100GB+ | 5-9 hours |

### Network Requirements

- **Bandwidth**: 5+ Mbps recommended (45GB download for full import)
- **Stability**: Long-term connection stability (8+ hours for full import)
- **Timeouts**: Reasonable connection timeout settings (30+ seconds)

### Disk Space Calculation

```
Total needed = Temporary + Final + Buffer

Authors:
  Temporary: 500MB (compressed download)
  Final: 1GB (database + indexes)
  Buffer: 500MB
  Total: 2GB

Works:
  Temporary: 2GB
  Final: 8GB
  Buffer: 2GB
  Total: 12GB

Editions:
  Temporary: 45GB
  Final: 150GB
  Buffer: 15GB
  Total: 210GB

Full import total: ~224GB
```

## Import Monitoring

### Progress Output

The import process logs detailed progress:

```
============================================================
Starting monthly OpenLibrary data refresh
============================================================

[1/3] Importing authors...
Downloaded: 500MB | Parsed: 5M authors | Indexed: 100% complete

[2/3] Importing works...
Downloaded: 2GB | Parsed: 2M works | Indexed: 100% complete

[3/3] Importing editions...
Downloaded: 45GB | Parsed: 150M editions | Indexed: 100% complete

============================================================
✓ Monthly refresh complete! Total time: 234 minutes
============================================================
```

### Check Import Status During Run

```bash
# See how many records are in database
docker exec echo_data_db psql -U postgres -d echo_data_source \
  -c "SELECT
    (SELECT COUNT(*) FROM authors) as author_count,
    (SELECT COUNT(*) FROM works) as work_count,
    (SELECT COUNT(*) FROM editions) as edition_count;"

# Monitor API and ES connection
docker logs echo_data_api | tail -20

# Check database connections
docker exec echo_data_db \
  psql -U postgres -d echo_data_source \
  -c "SELECT count(*) FROM pg_stat_activity;"

# Monitor disk usage
docker exec echo_data_api du -sh /app/data
docker exec echo_data_db df -h /var/lib/postgresql
```

### Import Completion Verification

```bash
# Verify data integrity
docker exec echo_data_db psql -U postgres -d echo_data_source <<EOF
-- Count records in each table
SELECT 'authors' as table_name, COUNT(*) as record_count FROM authors
UNION ALL
SELECT 'works', COUNT(*) FROM works
UNION ALL
SELECT 'editions', COUNT(*) FROM editions;

-- Check recent imports
SELECT MAX(created_at) FROM authors;
SELECT MAX(created_at) FROM works;
SELECT MAX(created_at) FROM editions;
EOF
```

## Handling Import Failures

### If Import Fails Halfway

```bash
# Check logs for error
docker logs echo_data_api | tail -50

# Restart from that stage
# Option 1: Continue with next stage
docker exec -it echo_data_api bun src/import/works.ts  # If works failed

# Option 2: Restart everything from scratch
# Delete data and start over (careful - destructive!)
docker-compose down -v
docker-compose up -d
docker exec -it echo_data_api bun src/jobs/refresh.ts
```

### Recovery from Corrupted State

```bash
# 1. Stop application
docker-compose stop api

# 2. Backup current data
docker exec echo_data_db pg_dump -U postgres -d echo_data_source > recovery_backup.sql

# 3. Clear specific table (e.g., if editions import failed)
docker exec echo_data_db psql -U postgres -d echo_data_source \
  -c "TRUNCATE TABLE editions CASCADE;"

# 4. Re-run just that import
docker-compose start api
docker exec -it echo_data_api bun src/import/editions.ts
```

## Performance Tuning

### Optimize for Faster Imports

Increase resource allocation during import:

```bash
# Temporarily increase PostgreSQL work_mem
docker exec echo_data_db \
  psql -U postgres -c "ALTER SYSTEM SET work_mem = '256MB';"

docker exec echo_data_db pg_ctl reload

# Run import
docker exec -it echo_data_api bun src/jobs/refresh.ts

# Restore original setting
docker exec echo_data_db \
  psql -U postgres -c "ALTER SYSTEM SET work_mem = '50MB';"
```

### Parallel Import Consideration

Currently, imports run sequentially (Author → Works → Editions). Future optimizations could include:
- Batched insertion improvements
- Streaming parser optimization
- Index creation timing

## Import Data Retention

### Keeping Previous Data

During import, the system:
- Appends new data (doesn't delete old records)
- Updates existing records if keys match
- Creates new indexes as needed
- Removes duplicate entries

To see when data was imported:

```bash
docker exec echo_data_db psql -U postgres -d echo_data_source \
  -c "SELECT created_at, COUNT(*) FROM authors GROUP BY created_at ORDER BY created_at DESC LIMIT 5;"
```

### Archiving Import History

```bash
# Export current state before re-import
docker exec echo_data_db pg_dump -U postgres -d echo_data_source > backup_pre_import_$(date +%Y%m%d).sql

# Store in S3 or archive storage
aws s3 cp backup_pre_import_*.sql s3://your-bucket/backups/
```

## Best Practices

### Do's

- Import authors before works, works before editions
- Schedule imports during low-traffic periods
- Monitor disk space before large imports
- Keep import logs for audit trail
- Test imports on staging environment first
- Document import timing for capacity planning

### Don'ts

- Don't interrupt an import without recovery plan
- Don't run multiple imports simultaneously
- Don't forget to verify data after import completes
- Don't import to production without staging test
- Don't ignore connection timeout errors
- Don't neglect disk space monitoring

## Next Steps

- Configure [Database Migrations](./database-migrations.md)
- Set up [Monitoring](./monitoring.md) for imports
- Review [Deployment](./deployment.md) with imports
- Check [Troubleshooting](./troubleshooting.md) for common issues
