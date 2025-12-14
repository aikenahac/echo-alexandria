---
title: Update Schedule
---

# OpenLibrary Monthly Refresh Strategy

Echo Alexandria refreshes its OpenLibrary data monthly to stay synchronized with the latest author, work, and edition information. This guide covers how to manually refresh data and how to set up automated refresh cycles.

## OpenLibrary Update Cycle

### Monthly Publication Schedule

OpenLibrary publishes new data dumps on the **1st of each month**, typically around **00:00 UTC**:

```
December 1st, 00:00 UTC → New dumps available
December 1st, 06:00 UTC → Check and verify availability
December 1st-2nd → Download and import into Echo Alexandria
```

### Why Monthly Updates?

**Frequency trade-offs**:
- **More frequent**: Stale data concerns, higher resource usage
- **Less frequent**: Newer content not indexed, editorial changes delayed
- **Monthly**: Balances freshness with operational feasibility

**Data freshness**:
- Authors: New authors, biographical updates, photos
- Works: New works, description changes, subject updates
- Editions: New publications, ISBN assignments, metadata corrections

## Manual Refresh Process

### Prerequisites

Before importing, ensure:

1. **Sufficient disk space**: At least 100 GB free (for decompression)
2. **Database availability**: PostgreSQL and Elasticsearch running
3. **Network connectivity**: Reliable download access
4. **Low traffic window**: Schedule during off-peak hours

### Step 1: Verify Dump Availability

Check if new dumps are available:

```bash
# Test authors dump
curl -I https://openlibrary.org/data/ol_dump_authors_latest.txt.gz

# Test works dump
curl -I https://openlibrary.org/data/ol_dump_works_latest.txt.gz

# Test editions dump
curl -I https://openlibrary.org/data/ol_dump_editions_latest.txt.gz
```

Look for HTTP 200 response. If you get 404, dumps may not be available yet.

### Step 2: Create Backup

Before importing new data:

```bash
# Backup current database state
pg_dump echo_alexandria > backup_$(date +%Y%m%d).sql

# Optional: Create Elasticsearch backup
# (Depends on your ES configuration)
```

### Step 3: Run Full Import

The easiest way is the all-in-one command:

```bash
bun import:all
```

This command:
1. Downloads all three dumps (authors, works, editions)
2. Imports authors first
3. Imports works second
4. Imports editions last
5. Creates search indices in Elasticsearch
6. Validates record counts
7. Prints summary statistics

### Step 4: Monitor Progress

The import process prints progress updates:

```
[IMPORT] Starting OpenLibrary bulk import...
[IMPORT] Downloading authors dump...
[IMPORT] Downloaded ol_dump_authors_latest.txt.gz (487 MB)
[IMPORT] Decompressing and importing authors...
[IMPORT] 3,842,156 authors imported in 24 minutes 15 seconds
[IMPORT] Downloading works dump...
[IMPORT] Downloaded ol_dump_works_latest.txt.gz (1.9 GB)
[IMPORT] Decompressing and importing works...
[IMPORT] 1,843,291 works imported in 1 hour 3 minutes
[IMPORT] Downloading editions dump...
[IMPORT] Downloaded ol_dump_editions_latest.txt.gz (9.8 GB)
[IMPORT] Decompressing and importing editions...
[IMPORT] 33,156,482 editions imported in 4 hours 28 minutes
[IMPORT] Creating search indices...
[IMPORT] Refreshing Elasticsearch...
[IMPORT] Validating data integrity...
[IMPORT] All imports completed successfully
```

### Step 5: Verify Import Results

After import completes, verify the data:

```bash
# Check author count
bun run verify:authors

# Check work count
bun run verify:works

# Check edition count
bun run verify:editions

# Run full data integrity check
bun run verify:integrity
```

Example output:
```
Authors: 3,842,156 (expected ~3.8M) ✓
Works: 1,843,291 (expected ~1.8M) ✓
Editions: 33,156,482 (expected ~33M) ✓
Integrity: 0 orphaned records, 0 broken references ✓
```

### Import Time Estimates

Complete import times (all three dumps) by resource configuration:

| Configuration | Authors | Works | Editions | Total |
|---------------|---------|-------|----------|-------|
| Standard (4 CPU, 8GB RAM) | 20 min | 50 min | 4 hours | 5.5 hours |
| Optimized (8 CPU, 32GB RAM) | 15 min | 35 min | 2.5 hours | 3.5 hours |
| High-end (16 CPU, 64GB RAM) | 12 min | 25 min | 1.5 hours | 2 hours |

Times include:
- Download (5-30 min depending on connection)
- Decompression (happens during import)
- Database insertion (batched)
- Index creation (Elasticsearch)
- Validation

## Selective Import

Sometimes you only need to update one entity type:

### Import Authors Only

```bash
bun import:authors
```

Use case: Quick biographical updates without full refresh

### Import Works Only

```bash
bun import:works
```

Use case: Update work descriptions and subject categories
Note: Editions may reference new works not yet in database

### Import Editions Only

```bash
bun import:editions
```

Use case: New ISBN assignments and publication metadata
Note: Editions must have valid work_keys in database

## Automated Refresh Setup

### Cron Job (Linux/macOS)

Create a cron job to import automatically on the 1st of each month:

```bash
# Edit crontab
crontab -e

# Add this line (2 AM UTC on 1st of month)
0 2 1 * * cd /path/to/echo-data-source && bun import:all >> logs/import-$(date +\%Y\%m\%d).log 2>&1

# Add this line to restart API server after import
15 2 1 * * systemctl restart echo-alexandria-api
```

Breakdown:
- `0` - Minute (0)
- `2` - Hour (2 AM UTC)
- `1` - Day of month (1st)
- `*` - Any month
- `*` - Any weekday
- Command to execute

### Docker Scheduler

For Docker deployments, use a scheduler service:

```yaml
version: '3.8'
services:
  echo-alexandria:
    image: echo-alexandria:latest
    # ... other config ...

  scheduler:
    image: mcuadros/ofelia:latest
    depends_on:
      - echo-alexandria
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    command: daemon --docker
    environment:
      - SWARM_MODE=false

# Add labels to services you want scheduled
# On the echo-alexandria service:
# labels:
#   ofelia.enabled: "true"
#   ofelia.job-exec.import.schedule: "@monthly"
#   ofelia.job-exec.import.command: "bun import:all"
```

### Kubernetes CronJob

For Kubernetes deployments:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: echo-alexandria-import
  namespace: echo-data-source
spec:
  schedule: "0 2 1 * *"  # 2 AM UTC on 1st of month
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: echo-alexandria
          containers:
          - name: import
            image: echo-alexandria:latest
            command:
            - /bin/sh
            - -c
            - |
              cd /app && \
              bun import:all && \
              kubectl rollout restart deployment/echo-alexandria-api
            resources:
              requests:
                memory: "16Gi"
                cpu: "4"
              limits:
                memory: "32Gi"
                cpu: "8"
            volumeMounts:
            - name: import-logs
              mountPath: /app/logs
            env:
            - name: NODE_ENV
              value: production
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: db-credentials
                  key: url
          restartPolicy: OnFailure
          volumes:
          - name: import-logs
            persistentVolumeClaim:
              claimName: import-logs-pvc
```

## Monitoring Refresh Jobs

### Viewing Import Logs

After import completes:

```bash
# View latest import log
tail -n 100 logs/import-$(date +%Y%m%d).log

# Search for errors
grep -i "error\|warning\|fail" logs/import-*.log

# Get import statistics
tail -n 50 logs/import-$(date +%Y%m%d).log | grep -E "^(Authors|Works|Editions|Total)"
```

### Email Notifications

Send email on import failure:

```bash
#!/bin/bash
# save as scripts/import-with-notification.sh

bun import:all > /tmp/import-output.log 2>&1
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  SUBJECT="OpenLibrary Import Failed"
  BODY="Import process exited with code $EXIT_CODE. See attached log."

  echo "$BODY" | mail -s "$SUBJECT" \
    -a "/tmp/import-output.log" \
    ops@example.com

  exit $EXIT_CODE
fi

# Import succeeded
echo "Import completed successfully" | mail -s "OpenLibrary Import Complete" ops@example.com
```

Then add to crontab:

```bash
0 2 1 * * /path/to/scripts/import-with-notification.sh
```

### Slack Notifications

Send notifications to Slack:

```bash
#!/bin/bash
# save as scripts/import-slack-notify.sh

WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

bun import:all > /tmp/import-output.log 2>&1
EXIT_CODE=$?

TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")

if [ $EXIT_CODE -ne 0 ]; then
  curl -X POST $WEBHOOK_URL \
    -H 'Content-Type: application/json' \
    -d "{
      \"text\": \"OpenLibrary Import Failed\",
      \"attachments\": [{
        \"color\": \"danger\",
        \"text\": \"Import failed at $TIMESTAMP with exit code $EXIT_CODE\"
      }]
    }"
  exit $EXIT_CODE
else
  AUTHOR_COUNT=$(grep "authors imported" /tmp/import-output.log | tail -1)
  WORK_COUNT=$(grep "works imported" /tmp/import-output.log | tail -1)
  EDITION_COUNT=$(grep "editions imported" /tmp/import-output.log | tail -1)

  curl -X POST $WEBHOOK_URL \
    -H 'Content-Type: application/json' \
    -d "{
      \"text\": \"OpenLibrary Import Complete\",
      \"attachments\": [{
        \"color\": \"good\",
        \"text\": \"Import completed at $TIMESTAMP\n$AUTHOR_COUNT\n$WORK_COUNT\n$EDITION_COUNT\"
      }]
    }"
fi
```

### Database Monitoring

Check if import is running:

```bash
# Connect to PostgreSQL
psql -U postgres -d echo_alexandria

# View active connections and queries
SELECT
  pid,
  now() - query_start AS duration,
  query
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY query_start;

# Check table sizes after import
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Disk Space Monitoring

Monitor available disk space during import:

```bash
#!/bin/bash
# save as scripts/monitor-disk.sh

WARNING_THRESHOLD=20  # Alert if less than 20GB free

while true; do
  FREE_SPACE=$(df /data | tail -1 | awk '{print $4}')
  FREE_GB=$((FREE_SPACE / 1024 / 1024))

  if [ $FREE_GB -lt $WARNING_THRESHOLD ]; then
    echo "WARNING: Only ${FREE_GB}GB free on /data"
    # Send alert to ops team
  fi

  sleep 60
done
```

## Handling Import Failures

### Failed Download

If the dump download fails:

```bash
# Retry download manually
wget https://openlibrary.org/data/ol_dump_authors_latest.txt.gz \
  --continue \
  -O ol_dump_authors_latest.txt.gz

# Then resume import
bun import:authors
```

### Partial Import Success

If import completes partially (e.g., authors imported, works failed):

**Option 1: Continue from where it stopped**
```bash
# Restore from backup
psql -U postgres -d echo_alexandria < backup_$(date +%Y%m%d).sql

# Retry complete import
bun import:all
```

**Option 2: Clear and restart**
```bash
# Clear all imported data
bun import:reset

# Start fresh
bun import:all
```

### Data Validation Failures

If validation checks fail:

```bash
# Run detailed integrity check
bun run verify:detailed

# Get more information about failures
psql -U postgres -d echo_alexandria -c \
  "SELECT * FROM import_errors ORDER BY created_at DESC LIMIT 100;"
```

## Rollback Procedures

### Complete Rollback

If the new import has issues:

```bash
# Restore from backup
psql -U postgres -d echo_alexandria < backup_$(date +%Y%m%d).sql

# Verify restoration
bun run verify:integrity

# Restart API services
systemctl restart echo-alexandria-api
```

### Elasticsearch Rollback

If Elasticsearch indices are corrupted:

```bash
# Delete corrupted indices
curl -X DELETE "localhost:9200/authors*"
curl -X DELETE "localhost:9200/works*"
curl -X DELETE "localhost:9200/editions*"

# Recreate indices from database
bun run elasticsearch:reindex

# Verify indices
curl "localhost:9200/_cat/indices?v"
```

## Best Practices

### Pre-Import Checklist

Before each monthly import:

- [ ] New dumps available at openlibrary.org/data/
- [ ] At least 250GB free disk space
- [ ] Database and Elasticsearch healthy
- [ ] Recent backup created
- [ ] Scheduled during low-traffic window
- [ ] Monitoring and notifications configured
- [ ] Team notified of maintenance window

### Post-Import Verification

After import completes:

- [ ] Record counts match expected ranges
- [ ] No orphaned records detected
- [ ] Data integrity checks pass
- [ ] Search queries return correct results
- [ ] API response times acceptable
- [ ] No error spikes in logs

### Documentation

Keep records of each import:

```bash
# Create import summary
cat > imports/$(date +%Y%m%d)-summary.txt << EOF
Date: $(date)
Status: Success
Authors: $(bun run verify:authors | grep "^Authors:")
Works: $(bun run verify:works | grep "^Works:")
Editions: $(bun run verify:editions | grep "^Editions:")
Duration: 5 hours 23 minutes
Disk used: 87 GB
Notes: All systems nominal
EOF
```

## Optimization Tips

### Parallel Import (if supported)

Some import operations can run in parallel:

```bash
# Import different entity types in parallel shells
(bun import:authors) &
(bun import:works) &
(bun import:editions) &

wait  # Wait for all to complete
```

Note: Be cautious with parallel imports to avoid database contention.

### Incremental Updates (Future)

If implementing incremental updates based on last_modified timestamp:

```bash
bun import:works --since 2024-11-01

# This would only import works modified after Nov 1st
# Significantly faster for partial refreshes
```

## Related Documentation

- [Data Dumps Overview](./data-dumps.md) - Where to find dumps
- [Data Format Reference](./data-format.md) - Understanding dump structure
- [Entity Relationships](./relationships.md) - How to query imported data
- [Import API Documentation](../api/admin/import-trigger) - Programmatic import control
