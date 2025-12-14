---
title: Deployment
sidebar_position: 5
---

# Deployment

Production deployment guide for Echo Alexandria with Docker, environment configuration, and best practices.

## Deployment Options

### Docker Compose (Recommended for Single Server)

Ideal for small to medium deployments on a single server.

**Advantages:**
- Simple setup and maintenance
- Easy scaling within a single machine
- Built-in networking
- Persistent volumes

**Disadvantages:**
- Single point of failure
- No automatic failover
- Limited to single server resources

**When to use:** Small teams, development, staging environments

### Docker Swarm (Recommended for Small Clusters)

Lightweight clustering for multi-server deployments.

**Advantages:**
- Built into Docker
- Simple multi-server orchestration
- Automatic service restart
- Load balancing

**Disadvantages:**
- Less feature-rich than Kubernetes
- Smaller ecosystem
- Limited autoscaling

**When to use:** 2-5 servers, standard workloads

### Kubernetes (Recommended for Enterprise)

Full-featured container orchestration platform.

**Advantages:**
- Highly scalable
- Auto-scaling capabilities
- Advanced networking
- Large ecosystem

**Disadvantages:**
- Steep learning curve
- Complex setup and maintenance
- More resources overhead

**When to use:** Large deployments, complex requirements, multiple teams

## Docker Compose Production Deployment

### Production Compose File

```yaml
version: '3.8'

services:
  db:
    image: postgres:17
    container_name: echo_data_db
    env_file:
      - .env.production
    ports:
      - 5433:5432
    volumes:
      - echo_data_db_data:/var/lib/postgresql/data
      - ./backups:/backups
    restart: always
    shm_size: 2g
    command:
      - "postgres"
      - "-c"
      - "shared_buffers=4GB"
      - "-c"
      - "work_mem=100MB"
      - "-c"
      - "maintenance_work_mem=2GB"
      - "-c"
      - "max_connections=200"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - echo-alexandria-network

  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    container_name: echo_data_elasticsearch
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=true
      - xpack.security.enrollment.enabled=true
      - ELASTIC_PASSWORD=${ELASTICSEARCH_PASSWORD}
      - "ES_JAVA_OPTS=-Xms4g -Xmx4g"
      - bootstrap.memory_lock=true
    ulimits:
      memlock:
        soft: -1
        hard: -1
    ports:
      - 9200:9200
    volumes:
      - echo_data_es_data:/usr/share/elasticsearch/data
    restart: always
    healthcheck:
      test: curl -s http://localhost:9200 >/dev/null || exit 1
      interval: 30s
      timeout: 10s
      retries: 5
    networks:
      - echo-alexandria-network

  api:
    image: ghcr.io/aikenahac/echo-alexandria:v1.0.0
    pull_policy: always
    container_name: echo_data_api
    env_file:
      - .env.production
    ports:
      - 3001:3000
    depends_on:
      db:
        condition: service_healthy
      elasticsearch:
        condition: service_healthy
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - echo-alexandria-network
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

volumes:
  echo_data_db_data:
    driver: local
  echo_data_es_data:
    driver: local

networks:
  echo-alexandria-network:
    driver: bridge
```

### Production Environment File

```bash
# .env.production
POSTGRES_USER=echo_prod_user
POSTGRES_PASSWORD=<VERY_SECURE_PASSWORD_CHANGE_ME>
POSTGRES_DB=echo_data_production
DATABASE_URL=postgresql://echo_prod_user:<PASSWORD>@db:5432/echo_data_production

ELASTICSEARCH_PASSWORD=<VERY_SECURE_PASSWORD_CHANGE_ME>
ELASTICSEARCH_URL=https://elastic:<PASSWORD>@elasticsearch:9200

ADMIN_API_KEY=<GENERATE_SECURE_KEY>
PORT=3000

# Production-specific settings
NODE_ENV=production
LOG_LEVEL=info
```

## SSL/TLS Setup with Nginx Reverse Proxy

### Nginx Configuration

```nginx
upstream echo_api {
    server api:3000;
}

server {
    listen 80;
    server_name api.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.example.com;

    # SSL Certificates (use Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;

    # Logging
    access_log /var/log/nginx/echo_access.log;
    error_log /var/log/nginx/echo_error.log;

    # Proxy settings
    location / {
        proxy_pass http://echo_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;

        # Timeouts for long-running imports
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # WebSocket support (if needed in future)
    location /api/ws {
        proxy_pass http://echo_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### Docker Compose with Nginx

```yaml
services:
  nginx:
    image: nginx:latest
    container_name: echo_data_nginx
    ports:
      - 80:80
      - 443:443
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - api
    restart: always
    networks:
      - echo-alexandria-network

  # ... other services
```

## Let's Encrypt SSL Certificate Setup

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot certonly --standalone -d api.example.com

# Auto-renewal (runs twice daily)
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# Verify renewal
sudo certbot renew --dry-run
```

## Database Backup Strategy

### Automated Daily Backups

```bash
#!/bin/bash
# backup.sh - Run via cron daily

BACKUP_DIR="/backups/echo-alexandria"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/echo_data_$DATE.sql.gz"

# Create backup
docker exec echo_data_db pg_dump -U postgres -d echo_data_source | gzip > "$BACKUP_FILE"

# Keep only 30 days of backups
find $BACKUP_DIR -name "echo_data_*.sql.gz" -mtime +30 -delete

# Upload to S3 (optional)
aws s3 cp "$BACKUP_FILE" s3://your-backup-bucket/echo-alexandria/
```

### Cron Schedule

```bash
# Run daily backup at 2 AM
0 2 * * * /path/to/backup.sh >> /var/log/echo-backup.log 2>&1

# Test restore weekly
0 3 0 * * /path/to/test-restore.sh >> /var/log/echo-restore-test.log 2>&1
```

### Restore from Backup

```bash
# List available backups
ls -la /backups/echo-alexandria/

# Restore database
gunzip -c /backups/echo-alexandria/echo_data_20240101_020000.sql.gz | \
  docker exec -i echo_data_db psql -U postgres -d echo_data_source
```

## Deployment Checklist

### Pre-Deployment

- [ ] Environment variables configured securely
- [ ] SSL certificates obtained and installed
- [ ] Database backups tested
- [ ] Resource requirements verified (CPU, RAM, disk)
- [ ] Network connectivity confirmed
- [ ] Elasticsearch security enabled
- [ ] Database credentials rotated from defaults
- [ ] API keys generated and stored securely

### Deployment

- [ ] Pull latest image: `docker pull ghcr.io/aikenahac/echo-alexandria:v1.0.0`
- [ ] Start services: `docker-compose -f docker-compose.prod.yml up -d`
- [ ] Verify all services running: `docker-compose ps`
- [ ] Check logs for errors: `docker-compose logs`
- [ ] Run health checks: `curl https://api.example.com/health`
- [ ] Verify database connection
- [ ] Verify Elasticsearch connection

### Post-Deployment

- [ ] Load test with expected traffic
- [ ] Monitor resource usage
- [ ] Check application logs for warnings/errors
- [ ] Verify backup process runs
- [ ] Test DNS resolution
- [ ] Test SSL certificate
- [ ] Document deployment details
- [ ] Set up monitoring and alerting

## Scaling Considerations

### Vertical Scaling (Single Server)

Increase resources on existing server:

1. Stop services: `docker-compose down`
2. Increase PostgreSQL settings:
   - `shared_buffers`: 25% of new RAM
   - `work_mem`: new RAM / max connections / 2
3. Increase Elasticsearch heap: `-Xmx` flag
4. Restart services: `docker-compose up -d`

### Horizontal Scaling (Multiple Servers)

For multiple servers, consider:

1. **Shared Database**: Use managed PostgreSQL (RDS, CloudSQL)
2. **Shared Elasticsearch**: Use managed Elasticsearch (Elastic Cloud, OpenSearch Service)
3. **Multiple API Instances**: Load balance across servers
4. **Stateless API**: Ensure API containers are stateless

Example with managed services:

```yaml
api:
  image: ghcr.io/aikenahac/echo-alexandria:v1.0.0
  environment:
    DATABASE_URL: postgresql://user:pass@managed-postgres.example.com:5432/echo_data
    ELASTICSEARCH_URL: https://elasticsearch.example.com:9200
  deploy:
    replicas: 3
```

## Health Monitoring

### Health Check Endpoint

```bash
curl https://api.example.com/health

# Response:
{
  "status": "ok",
  "timestamp": "2024-12-13T10:30:00.000Z",
  "database": "connected",
  "elasticsearch": "connected"
}
```

### Docker Health Checks

Configured in docker-compose with automatic restart:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

## Monitoring and Logging

### Application Logs

```bash
# View logs
docker-compose logs -f api

# With timestamp
docker-compose logs -f --timestamps api

# Last 100 lines
docker-compose logs --tail=100 api
```

### Centralized Logging (Optional)

Send logs to external service:

```yaml
api:
  logging:
    driver: "splunk"
    options:
      splunk-token: "${SPLUNK_TOKEN}"
      splunk-url: "https://splunk.example.com"
      tag: "echo-api"
```

## Security Best Practices

### Environment Variable Security

```bash
# Never commit secrets to version control
git add docker-compose.yml
git ignore .env.production

# Use secrets manager
export $(cat /path/to/secure/env | xargs)
```

### Container Security

```yaml
api:
  security_opt:
    - no-new-privileges:true
  read_only: true
  tmpfs:
    - /tmp
    - /run
```

### Network Security

```yaml
networks:
  echo-alexandria-network:
    driver: bridge
    driver_opts:
      # Enable IPAM (IP Address Management)
      com.docker.network.bridge.enable_icc: "true"
```

## Rollback Strategy

### If Deployment Fails

```bash
# 1. Stop current services
docker-compose down

# 2. Roll back to previous image
docker-compose -f docker-compose.prod.yml \
  set image api=ghcr.io/aikenahac/echo-alexandria:v0.9.0

# 3. Restore previous database backup
gunzip -c /backups/pre_deployment_backup.sql.gz | \
  docker exec -i echo_data_db psql -U postgres -d echo_data_source

# 4. Start with previous version
docker-compose up -d

# 5. Verify health
curl https://api.example.com/health
```

## Performance Optimization

### Database Connection Pooling

```bash
# Use connection pooling middleware (PgBouncer)
docker run -d \
  --name pgbouncer \
  --network echo-alexandria-network \
  edoburu/pgbouncer
```

### Caching Strategy

Consider adding caching layer:

```yaml
redis:
  image: redis:latest
  container_name: echo_data_cache
  ports:
    - 6379:6379
  volumes:
    - redis_data:/data
  restart: unless-stopped
  networks:
    - echo-alexandria-network
```

## Disaster Recovery

### Recovery Time Objective (RTO)

Target: 1 hour to full service restoration

### Recovery Point Objective (RPO)

Target: 24 hours of data loss acceptable

### Disaster Recovery Checklist

- [ ] Backup strategy documented
- [ ] Recovery procedures tested
- [ ] Alternate infrastructure available
- [ ] DNS failover configured
- [ ] Team trained on recovery
- [ ] Recovery scripts automated

## Next Steps

- Set up [Monitoring](./monitoring.md) for production
- Configure [Data Imports](./data-import.md) schedule
- Review [Troubleshooting](./troubleshooting.md) procedures
- Plan [Scaling Strategy](../advanced/scaling.md)
