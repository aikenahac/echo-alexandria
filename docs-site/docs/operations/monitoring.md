---
title: Monitoring
sidebar_position: 6
---

# Monitoring

Setting up comprehensive monitoring and health checks for Echo Alexandria in production.

## Health Check Endpoint

Echo Alexandria provides a health check endpoint for monitoring service status:

```bash
# Health check request
curl http://localhost:3001/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2024-12-13T10:30:00.000Z",
  "database": "connected",
  "elasticsearch": "connected"
}
```

### Health Check Details

The health endpoint verifies:

1. **API Server Status** - Application is running
2. **Database Connection** - PostgreSQL is accessible
3. **Elasticsearch Connection** - Search engine is accessible
4. **Response Time** - All connections complete within timeout

### Monitoring the Health Endpoint

```bash
# Continuous monitoring (every 30 seconds)
watch -n 30 'curl -s http://localhost:3001/health | jq .'

# Get status code only
curl -w "%{http_code}" -o /dev/null -s http://localhost:3001/health

# With timeout
curl --max-time 5 http://localhost:3001/health
```

## Docker Health Checks

### Built-in Health Checks

Docker Compose health checks automatically monitor containers:

```bash
# View container health status
docker-compose ps

# Output:
NAME                 STATUS
echo_data_db         up (healthy)
echo_data_elasticsearch  up (healthy)
echo_data_api        up (healthy)
```

### Check Individual Container Health

```bash
# Check specific container
docker ps --filter "name=echo_data_api" --format "table {{.Names}}\t{{.Status}}"

# Get detailed health info
docker inspect --format='{{json .State.Health}}' echo_data_api | jq .

# Expected output:
{
  "Status": "healthy",
  "FailingStreak": 0,
  "Log": [
    {
      "Start": "2024-12-13T10:30:00.000000Z",
      "End": "2024-12-13T10:30:01.000000Z",
      "ExitCode": 0,
      "Output": ""
    }
  ]
}
```

## PostgreSQL Monitoring

### Database Connection Health

```bash
# Test database connection
docker exec echo_data_db \
  pg_isready -U postgres -h localhost

# Output: accepting connections (healthy)

# Get connection count
docker exec echo_data_db \
  psql -U postgres -c "SELECT COUNT(*) FROM pg_stat_activity;"

# Check active connections
docker exec echo_data_db \
  psql -U postgres -c "
    SELECT datname, count(*)
    FROM pg_stat_activity
    GROUP BY datname;"
```

### Database Performance Metrics

```bash
# Monitor slow queries
docker exec echo_data_db \
  psql -U postgres -d echo_data_source -c "
    SELECT query, calls, mean_time
    FROM pg_stat_statements
    ORDER BY mean_time DESC
    LIMIT 10;"

# Check index usage
docker exec echo_data_db \
  psql -U postgres -d echo_data_source -c "
    SELECT schemaname, tablename, indexname, idx_scan
    FROM pg_stat_user_indexes
    ORDER BY idx_scan DESC;"

# Check table sizes
docker exec echo_data_db \
  psql -U postgres -d echo_data_source -c "
    SELECT schemaname, tablename,
           pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
    FROM pg_tables
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"
```

### Database Maintenance Queries

```bash
# Last vacuum time
docker exec echo_data_db \
  psql -U postgres -d echo_data_source -c "
    SELECT schemaname, tablename, last_vacuum, last_autovacuum
    FROM pg_stat_user_tables
    ORDER BY last_autovacuum DESC;"

# Table bloat monitoring
docker exec echo_data_db \
  psql -U postgres -d echo_data_source -c "
    SELECT schemaname, tablename,
           ROUND(100 * pg_relation_size(schemaname||'.'||tablename)
           / pg_total_relation_size(schemaname||'.'||tablename))
           as table_ratio
    FROM pg_tables;"

# Row count verification
docker exec echo_data_db \
  psql -U postgres -d echo_data_source -c "
    SELECT
      'authors' as table_name, COUNT(*) FROM authors
    UNION ALL SELECT 'works', COUNT(*) FROM works
    UNION ALL SELECT 'editions', COUNT(*) FROM editions;"
```

## Elasticsearch Monitoring

### Cluster Health

```bash
# Check overall cluster health
curl http://localhost:9200/_cluster/health | jq .

# Expected response:
{
  "cluster_name": "docker-cluster",
  "status": "green",
  "timed_out": false,
  "number_of_nodes": 1,
  "number_of_data_nodes": 1,
  "active_primary_shards": 10,
  "active_shards": 10,
  "relocating_shards": 0,
  "initializing_shards": 0,
  "unassigned_shards": 0
}

# Status meanings:
# green  - All shards allocated
# yellow - All primary shards allocated, some replicas missing
# red    - Some primary shards not allocated
```

### Index Monitoring

```bash
# List all indexes
curl http://localhost:9200/_cat/indices?v | jq .

# Get specific index health
curl http://localhost:9200/_cat/indices/editions?v

# Check index size
curl http://localhost:9200/_cat/indices?v&bytes=b | grep editions

# Monitor shard allocation
curl http://localhost:9200/_cat/shards?v

# Check index mapping
curl http://localhost:9200/editions/_mapping | jq .
```

### Search Performance

```bash
# Monitor search requests
curl http://localhost:9200/_stats | jq '.indices | .[].primaries.search'

# Query execution stats
curl -X GET "localhost:9200/_nodes/stats/indices/search" | jq .
```

## Application Logging

### View Application Logs

```bash
# Real-time logs
docker-compose logs -f api

# Last 100 lines
docker-compose logs --tail=100 api

# Logs with timestamps
docker-compose logs -f --timestamps api

# Filter logs by pattern
docker-compose logs api | grep ERROR

# Monitor import logs
docker-compose logs api | grep "Importing\|Complete"
```

### Log Levels

Configure logging level via environment variable:

```bash
# In .env or docker-compose
LOG_LEVEL=info    # Standard logging
LOG_LEVEL=debug   # Verbose logging (development)
LOG_LEVEL=warn    # Warnings and errors only
LOG_LEVEL=error   # Errors only
```

### Persistent Application Logs

```yaml
# In docker-compose.yml
api:
  volumes:
    - ./logs:/app/logs  # Application logs directory
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "3"
```

Then view logs:

```bash
tail -f logs/*.log
```

## Resource Monitoring

### CPU and Memory Usage

```bash
# Real-time resource usage
docker stats

# Output:
CONTAINER              CPU %   MEM USAGE
echo_data_api          2.1%    456MiB
echo_data_db           1.5%    1.2GiB
echo_data_elasticsearch 5.2%   2.1GiB
```

### Monitor Specific Service

```bash
# Continuous monitoring of API server
docker stats echo_data_api --no-stream
docker stats echo_data_api --no-stream --interval 5  # Update every 5 seconds
```

### Disk Usage

```bash
# Docker volume usage
docker system df

# Specific volume usage
docker exec echo_data_api du -sh /app/data
docker exec echo_data_db du -sh /var/lib/postgresql

# Check available disk space
docker exec echo_data_api df -h /
```

## Import Job Monitoring

### Monitor Running Import

```bash
# Check if import is running
ps aux | grep "src/import\|src/jobs"

# View import logs in real-time
docker logs -f echo_data_api | grep -i "importing\|progress\|complete"

# Get record count during import
docker exec echo_data_db \
  psql -U postgres -d echo_data_source -c "
    SELECT
      (SELECT COUNT(*) FROM authors) as authors,
      (SELECT COUNT(*) FROM works) as works,
      (SELECT COUNT(*) FROM editions) as editions;"
```

### Import Performance

```bash
# Monitor disk usage during import
watch -n 10 'docker exec echo_data_api df -h /app/data'

# Monitor database size growth
watch -n 10 'docker exec echo_data_db du -sh /var/lib/postgresql/data'

# Monitor Elasticsearch index growth
watch -n 10 'curl -s http://localhost:9200/_cat/indices?bytes=b | head -10'
```

## Alerting Setup

### Prometheus Monitoring (Optional)

Install Prometheus for advanced monitoring:

```yaml
monitoring:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - 9090:9090
    networks:
      - echo-alexandria-network
```

### Alert Rules

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'docker'
    static_configs:
      - targets: ['localhost:9323']  # Docker daemon metrics

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres_exporter:9187']

  - job_name: 'elasticsearch'
    static_configs:
      - targets: ['elasticsearch:9200']

rule_files:
  - 'alerts.yml'
```

### Simple Alert Script

```bash
#!/bin/bash
# alert-monitor.sh - Check health and send alerts

API_HEALTH=$(curl -s http://localhost:3001/health)
STATUS=$(echo $API_HEALTH | jq -r '.status')

if [ "$STATUS" != "ok" ]; then
  echo "ALERT: API health check failed"
  # Send email or webhook
  curl -X POST -H 'Content-type: application/json' \
    --data '{"text":"Echo Alexandria API is down!"}' \
    $WEBHOOK_URL
fi

# Check disk space
DISK_USAGE=$(docker exec echo_data_db df /var/lib/postgresql | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 90 ]; then
  echo "ALERT: Database disk usage at ${DISK_USAGE}%"
fi
```

Run via cron:

```bash
# Check every 5 minutes
*/5 * * * * /path/to/alert-monitor.sh
```

## Grafana Dashboard

### Grafana Setup

```yaml
grafana:
  image: grafana/grafana:latest
  ports:
    - 3000:3000
  environment:
    - GF_SECURITY_ADMIN_PASSWORD=admin
  volumes:
    - grafana_data:/var/lib/grafana
  networks:
    - echo-alexandria-network
```

### Dashboard Queries

Create dashboard panels with queries:

```
# API Response Time
rate(http_request_duration_seconds_sum[5m]) / rate(http_request_duration_seconds_count[5m])

# Database Connection Count
pg_stat_activity_count

# Elasticsearch Heap Usage
elasticsearch_jvm_memory_used_bytes / elasticsearch_jvm_memory_max_bytes
```

## Manual Health Checks

### Daily Health Check Script

```bash
#!/bin/bash
# daily-health-check.sh

echo "=== Echo Alexandria Health Check ==="
echo "Time: $(date)"
echo ""

echo "1. Docker Containers:"
docker-compose ps

echo ""
echo "2. API Health:"
curl -s http://localhost:3001/health | jq .

echo ""
echo "3. Database Status:"
docker exec echo_data_db pg_isready -U postgres

echo ""
echo "4. Elasticsearch Status:"
curl -s http://localhost:9200/_cluster/health | jq '.status'

echo ""
echo "5. Disk Usage:"
df -h /var/lib/docker/volumes/ | head -2

echo ""
echo "6. Record Counts:"
docker exec echo_data_db psql -U postgres -d echo_data_source -c \
  "SELECT (SELECT COUNT(*) FROM authors) as authors, \
          (SELECT COUNT(*) FROM works) as works, \
          (SELECT COUNT(*) FROM editions) as editions;"

echo ""
echo "=== Health Check Complete ==="
```

Schedule daily:

```bash
# Run at 6 AM daily
0 6 * * * /path/to/daily-health-check.sh >> /var/log/health-check.log
```

## Metrics to Track

### Key Performance Indicators (KPIs)

- **API Response Time**: < 200ms for search queries
- **Database Connections**: < 80% of max connections
- **Elasticsearch Cluster Health**: green status
- **Disk Usage**: < 85% capacity
- **Memory Usage**: API < 2GB, Database < 8GB, Elasticsearch < 4GB
- **Import Duration**: Authors 5-15 min, Works 30-60 min, Editions 4-8 hours
- **Data Freshness**: Last import within last 35 days

### Thresholds for Alerts

| Metric | Warning | Critical |
|--------|---------|----------|
| API Response Time | > 500ms | > 2000ms |
| Disk Usage | > 75% | > 90% |
| Memory Usage | > 80% | > 95% |
| Error Rate | > 1% | > 5% |
| Failed Health Checks | 1 in a row | 3 in a row |
| Database Connections | > 150 | > 180 |
| Elasticsearch Health | yellow | red |

## Next Steps

- Review [Troubleshooting](./troubleshooting.md) for common issues
- Set up [Data Import](./data-import.md) monitoring
- Configure [Deployment](./deployment.md) alerts
- Review [Docker Setup](./docker-setup.md) for resource settings
