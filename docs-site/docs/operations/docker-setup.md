---
title: Docker Setup
sidebar_position: 1
---

# Docker Setup

Complete Docker Compose configuration for Echo Alexandria with detailed explanations of all services, resource allocation, and networking.

## Docker Compose Overview

The `docker-compose.yaml` file defines three core services for Echo Alexandria:

```yaml
services:
  db:              # PostgreSQL database
  elasticsearch:   # Search engine
  api:             # API server
```

## PostgreSQL Service Configuration

### Basic Configuration

```yaml
db:
  image: postgres:17
  container_name: echo_data_db
  env_file:
    - .env
  ports:
    - 5433:5432
  volumes:
    - echo_data_db_data:/var/lib/postgresql/data
  restart: unless-stopped
  shm_size: 1g
  networks:
    - echo-alexandria-network
```

### Performance Tuning Parameters

The PostgreSQL container includes optimized settings for handling large book datasets:

**shared_buffers=2GB**
- Amount of memory PostgreSQL uses for caching data blocks
- Typically set to 25% of system RAM for dedicated servers
- For 8GB RAM servers: 2GB is appropriate
- For 16GB+ RAM: consider increasing to 4GB

**work_mem=50MB**
- Memory per operation (sorts, hash tables, etc.)
- With 4 max connections: 50MB × 4 = 200MB total
- Increase if you experience slow joins on large tables
- Set high enough: `work_mem = (available_ram - shared_buffers - connection_overhead) / expected_max_concurrent_operations`

**maintenance_work_mem=1GB**
- Memory for CREATE INDEX, VACUUM, ALTER TABLE
- Set to 10% of system RAM minimum
- Essential for efficient full-table maintenance operations

**shm_size=1g**
- Shared memory size (/dev/shm)
- Must be >= shared_buffers
- Prevents disk swapping for memory operations

### Port Mapping

- **5433** (host) → **5432** (container)
- Maps to 5433 to avoid conflicts with local PostgreSQL
- Configure DATABASE_URL: `postgresql://postgres:password@localhost:5433/echo_data_source`

### Volume Management

**echo_data_db_data**
- Named Docker volume for persistent data storage
- Located at: `/var/lib/docker/volumes/echo_data_db_data/_data`
- Survives container restart and removal

## Elasticsearch Service Configuration

### Basic Configuration

```yaml
elasticsearch:
  image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
  container_name: echo_data_elasticsearch
  environment:
    - discovery.type=single-node
    - xpack.security.enabled=false
    - ES_JAVA_OPTS=-Xms2g -Xmx2g
    - bootstrap.memory_lock=true
  ulimits:
    memlock:
      soft: -1
      hard: -1
  ports:
    - 9200:9200
    - 9300:9300
  volumes:
    - echo_data_es_data:/usr/share/elasticsearch/data
  restart: unless-stopped
  networks:
    - echo-alexandria-network
```

### Memory Configuration

**ES_JAVA_OPTS=-Xms2g -Xmx2g**
- Xms (initial heap): 2GB
- Xmx (maximum heap): 2GB
- Heap size recommendations:
  - Small deployments (< 10M documents): 1-2GB
  - Medium deployments (10M-100M documents): 2-4GB
  - Large deployments (> 100M documents): 4-8GB
- Never set heap > 50% of available RAM
- Keep heap within 31GB for compressed object pointers

**bootstrap.memory_lock=true**
- Prevents Elasticsearch heap from being swapped to disk
- Requires `memlock` unlimited ulimits

### Single-Node Cluster

```
discovery.type=single-node
```

- Suitable for development and small deployments
- For production with high availability, upgrade to multi-node cluster
- See [Scaling Guide](../advanced/scaling.md) for cluster setup

### Security Configuration

```
xpack.security.enabled=false
```

:::warning Security Note
Security is disabled for development convenience. For production:
1. Enable X-Pack security
2. Set strong passwords for all users
3. Configure TLS/SSL certificates
4. Restrict network access
:::

### Port Mapping

- **9200** (host) → **9200** (container) - REST API
- **9300** (host) → **9300** (container) - Node communication

### Volume Management

**echo_data_es_data**
- Persistent storage for search indexes
- Location: `/var/lib/docker/volumes/echo_data_es_data/_data`

## API Server Configuration

### Basic Configuration

```yaml
api:
  image: ghcr.io/aikenahac/echo-alexandria:master
  pull_policy: always
  container_name: echo_data_api
  env_file:
    - .env
  ports:
    - 3001:3000
  depends_on:
    - db
    - elasticsearch
  volumes:
    - ./data:/app/data
  restart: unless-stopped
  networks:
    - echo-alexandria-network
```

### Service Dependencies

```yaml
depends_on:
  - db
  - elasticsearch
```

Ensures PostgreSQL and Elasticsearch start before the API server. Note: This only guarantees container startup, not service readiness. The API implements health checks to verify connectivity.

### Image Configuration

```yaml
image: ghcr.io/aikenahac/echo-alexandria:master
pull_policy: always
```

- Pulls from GitHub Container Registry (GHCR)
- `pull_policy: always` ensures latest master branch is used
- For stable releases, use specific version tags: `ghcr.io/aikenahac/echo-alexandria:v1.0.0`

### Port Mapping

- **3001** (host) → **3000** (container)
- Access API at `http://localhost:3001`

### Data Volume

```yaml
volumes:
  - ./data:/app/data
```

- Mounts local `./data` directory into container
- Used for temporary import files and logs
- Survives container restarts

## Networking

```yaml
networks:
  echo-alexandria-network:
    driver: bridge
```

### Internal Service Communication

Services communicate via container names on the bridge network:

```
db:5432
elasticsearch:9200
```

### Connection Examples

**From API container:**
```
DATABASE_URL=postgresql://postgres:password@db:5432/echo_data_source
ELASTICSEARCH_URL=http://elasticsearch:9200
```

**From host machine:**
```
DATABASE_URL=postgresql://postgres:password@localhost:5433/echo_data_source
ELASTICSEARCH_URL=http://localhost:9200
```

## Volume Management

### Named Volumes

Echo Alexandria uses two named Docker volumes for data persistence:

**echo_data_db_data**
- Stores PostgreSQL data
- Typical size: 5-200GB (depends on import scope)

**echo_data_es_data**
- Stores Elasticsearch indexes
- Typical size: 2-100GB (depends on import scope)

### Backup Volumes

Backup PostgreSQL volume:
```bash
docker run --rm -v echo_data_db_data:/data -v $(pwd):/backup \
  postgres:17 tar czf /backup/db-backup.tar.gz /data
```

View volume information:
```bash
docker volume inspect echo_data_db_data
docker volume inspect echo_data_es_data
```

## Common Operations

### Start Services

```bash
docker-compose up -d
```

### Stop Services

```bash
docker-compose down
```

### View Logs

```bash
# All services
docker-compose logs

# Specific service
docker-compose logs db
docker-compose logs elasticsearch
docker-compose logs api

# Follow logs
docker-compose logs -f api
```

### Execute Commands in Containers

```bash
# Run migration
docker exec -it echo_data_api bun src/db/migrate.ts

# Access PostgreSQL CLI
docker exec -it echo_data_db psql -U postgres -d echo_data_source

# Check Elasticsearch health
curl http://localhost:9200/_cluster/health
```

### Restart Services

```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart api
```

### Remove Volumes

```bash
# Stop and remove containers, networks, but keep volumes
docker-compose down

# Also remove volumes (destructive!)
docker-compose down -v
```

## Resource Requirements

### Minimum Configuration

- **CPU**: 2 cores
- **RAM**: 8GB total (PostgreSQL: 2GB, Elasticsearch: 2GB, API: 1GB, System: 3GB)
- **Disk**: 20GB (5GB PostgreSQL, 2GB Elasticsearch, 3GB API overhead, 10GB imports)

### Recommended Configuration

- **CPU**: 4+ cores
- **RAM**: 16GB+ (PostgreSQL: 4GB, Elasticsearch: 4GB, API: 2GB, System: 6GB)
- **Disk**: 100GB+ (accommodate full OpenLibrary import)
- **Network**: Gigabit or better for efficient data transfer

## System Prerequisites

### Linux

```bash
# Install Docker
sudo apt-get update
sudo apt-get install docker.io docker-compose-plugin

# Add user to docker group (optional)
sudo usermod -aG docker $USER
newgrp docker
```

### macOS

- Download Docker Desktop from [docker.com](https://www.docker.com/products/docker-desktop)
- Install and start from Applications
- Allocate sufficient RAM in Docker preferences (minimum 8GB)

### Windows

- Download Docker Desktop from [docker.com](https://www.docker.com/products/docker-desktop)
- Enable WSL 2 backend
- Configure resource limits in Docker settings

## Troubleshooting Docker

### Port Already in Use

```bash
# Find process using port
lsof -i :5433  # PostgreSQL
lsof -i :9200  # Elasticsearch
lsof -i :3001  # API

# Kill process
kill -9 <PID>

# Or change port in docker-compose.yaml
# Change "5433:5432" to "5434:5432"
```

### Out of Memory

```bash
# Check resource usage
docker stats

# Increase Docker memory limit
# Docker Desktop: Settings → Resources → Memory
# Docker CLI: edit /etc/docker/daemon.json
```

### Services Won't Start

```bash
# Check logs
docker-compose logs

# Verify images are pulled
docker images

# Rebuild images
docker-compose build --no-cache
```

## Next Steps

- Configure [Environment Variables](./environment-variables.md)
- Set up [Database Migrations](./database-migrations.md)
- Plan [Data Imports](./data-import.md)
- Learn about [Deployment](./deployment.md)
