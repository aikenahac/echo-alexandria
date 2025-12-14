---
sidebar_position: 2
title: Scaling
---

# Scaling

Comprehensive guide to scaling Echo Alexandria horizontally across multiple servers and regions.

## Understanding Vertical vs Horizontal Scaling

### Vertical Scaling Limits

Single-server constraints you'll eventually hit:

| Component | Limit | When It Matters |
|-----------|-------|-----------------|
| CPU cores | 48-96 | >1000 queries/second |
| RAM | 512GB-2TB | >1 billion documents |
| Network | 100Gbps | >100TB/month transfer |
| Disk I/O | 10Gbps | >1M writes/second |
| PostgreSQL connections | 10k-100k | >500 concurrent users |

**Cost implications:**
- Vertical: CPU/RAM costs scale exponentially
- Horizontal: Linear cost growth with 10-30% overhead

**Decision point:** When a single server can't handle peak load, it's time to scale horizontally.

## Horizontal Scaling Architecture

### Stateless API Design

The foundation of horizontal scaling is stateless APIs. Each server must be replaceable:

```typescript
// ✅ Stateless (scales horizontally)
export async function searchEndpoint(req: Request) {
  const query = new URL(req.url).searchParams.get('q');
  const results = await searchEditions(query);  // Calls shared database
  return new Response(JSON.stringify(results));
}

// ❌ Stateful (doesn't scale)
let searchCache = {};  // In-memory cache - doesn't share between servers
export async function searchEndpoint(req: Request) {
  if (searchCache[query]) return cached;
  // ...
}
```

**Key principles:**
1. No server-local state (session, cache, queues)
2. All state in shared systems (database, Redis, external cache)
3. Each server identical and independently deployable
4. Traffic can be routed to any server

### Load Balancing

Distribute traffic across multiple API servers:

**Architecture:**
```
[Clients] -> [Load Balancer] -> [API Server 1]
                            \-> [API Server 2]
                             -> [API Server 3]
                                    |
                                    v
                            [PostgreSQL]
                            [Elasticsearch]
```

**Load Balancer Options:**

| Solution | Scale | Cost | Setup |
|----------|-------|------|-------|
| nginx | Millions req/s | Free | Self-hosted |
| HAProxy | 1M+ req/s | Free | Self-hosted |
| AWS ALB | Auto-scale | Pay-per-LCU | Managed |
| AWS NLB | 25M+ req/s | Pay-per-LCU | Managed |
| Google Cloud LB | Global | Pay-per-rule | Managed |

**nginx example:**
```nginx
upstream api_backend {
  # Round-robin load balancing
  server api1.example.com:3000;
  server api2.example.com:3000;
  server api3.example.com:3000;

  # With health checks
  server api1.example.com:3000 weight=5;  # 50% traffic
  server api2.example.com:3000 weight=3;  # 30% traffic
  server api3.example.com:3000 weight=2;  # 20% traffic
}

server {
  listen 80;

  location /api/ {
    proxy_pass http://api_backend;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Host $http_host;
    proxy_connect_timeout 5s;
    proxy_read_timeout 10s;
  }
}
```

## PostgreSQL Scaling

### Replication Strategy

Scale reads with streaming replication:

```
[Primary DB] -> [Replica 1] -> [Replica 2]
      |              |              |
  Writes         Reads          Reads
  Updates        (5-10ms lag)   (10-20ms lag)
```

**Setup streaming replication:**

```sql
-- On primary (write server)
CREATE USER replication WITH REPLICATION ENCRYPTED PASSWORD 'password';

-- In postgresql.conf
wal_level = replica
max_wal_senders = 10
max_replication_slots = 10

-- On replica
pg_basebackup -h primary.example.com -D /var/lib/postgresql/data -U replication

-- standby.signal file tells replica to stream WAL
touch /var/lib/postgresql/data/standby.signal
```

**Connection routing:**

```typescript
// Write operations to primary
const primaryDb = new Database({
  connectionString: process.env.PRIMARY_DB_URL
});

// Read operations distributed across replicas
const readReplicas = [
  new Database({ connectionString: 'postgresql://replica1:5432/...' }),
  new Database({ connectionString: 'postgresql://replica2:5432/...' }),
  new Database({ connectionString: 'postgresql://replica3:5432/...' })
];

// Round-robin replica selection
let replicaIndex = 0;
function getReadDb() {
  const db = readReplicas[replicaIndex % readReplicas.length];
  replicaIndex++;
  return db;
}

// Usage
async function getAuthor(key: string) {
  const db = getReadDb();  // Use replica
  return db.select().from(authors).where(eq(authors.key, key)).limit(1);
}

async function updateAuthor(key: string, data: any) {
  return primaryDb.update(authors).set(data).where(eq(authors.key, key));
}
```

### Connection Pooling with PgBouncer

Manage thousands of client connections with pooling:

```
[App Servers] -> [PgBouncer] -> [PostgreSQL]
    100 conn         |         max 200 conn
    100 conn    pools them
    100 conn         |
    (many more)   efficiently
```

**PgBouncer configuration:**

```ini
[databases]
echo_db = host=db.example.com port=5432 dbname=echo_alexandria user=postgres password=secret

[pgbouncer]
listen_port = 6432
listen_addr = 0.0.0.0

; Connection pool settings
pool_mode = transaction    ; Each transaction gets a connection
max_client_conn = 1000     ; Max clients to accept
default_pool_size = 25     ; Connections per database
min_pool_size = 5
reserve_pool_size = 5
reserve_pool_timeout = 5
max_db_connections = 100   ; Max to PostgreSQL
max_user_connections = 50

; Server lifetime
server_lifetime = 3600
server_idle_timeout = 600

; Query routing
query_wait_timeout = 120
query_timeout = 0
```

**Docker setup:**

```yaml
pgbouncer:
  image: edoburu/pgbouncer:latest
  environment:
    DATABASE_URL: postgresql://postgres:password@db:5432/echo_alexandria
  ports:
    - "6432:6432"
  networks:
    - echo-alexandria-network
```

### Database Partitioning

Split large tables by date or range:

```sql
-- Partition editions by year
CREATE TABLE editions_2024 PARTITION OF editions
  FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

CREATE TABLE editions_2025 PARTITION OF editions
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

-- Benefits:
-- - Faster queries on specific year ranges
-- - Easier archival of old data
-- - Faster VACUUM of recent partitions
```

## Elasticsearch Scaling

### Multi-Node Cluster Setup

Transform single-node setup into a production cluster:

```yaml
services:
  # 3 dedicated master nodes (odd number for quorum)
  master-1:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    environment:
      - node.name=master-1
      - node.roles=[master]
      - cluster.name=echo-cluster
      - cluster.initial_master_nodes=master-1,master-2,master-3
      - discovery.seed_hosts=master-1,master-2,master-3
      - "ES_JAVA_OPTS=-Xms2g -Xmx2g"

  # Data nodes (can be many)
  data-1:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    environment:
      - node.name=data-1
      - node.roles=[data,ingest]
      - cluster.name=echo-cluster
      - discovery.seed_hosts=master-1,master-2,master-3
      - "ES_JAVA_OPTS=-Xms8g -Xmx8g"

  # Coordinating node (accepts client requests)
  coordinator:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    environment:
      - node.name=coordinator
      - node.roles=[]  # Coordinating only
      - cluster.name=echo-cluster
      - discovery.seed_hosts=master-1
      - "ES_JAVA_OPTS=-Xms4g -Xmx4g"
    ports:
      - "9200:9200"
```

### Shard and Replica Configuration

Optimize for scale:

```json
{
  "settings": {
    "number_of_shards": 10,
    "number_of_replicas": 2,
    "index.refresh_interval": "30s",
    "index.merge.scheduler.max_thread_count": 4,
    "index.queries.cache.size": "40%"
  }
}
```

**Shard allocation for 1TB index:**

```
Ideal shard size: 30GB
Required shards: 1000GB / 30GB = 34 shards

With 2 replicas: 34 shards * 3 = 102 shard copies
Requires: 102 / 5 = ~21 data nodes (5 shards per node)
```

### Index Lifecycle Management (ILM)

Automatically manage index growth and performance:

```json
PUT /_ilm/policy/editions_policy
{
  "policy": "editions_policy",
  "phases": {
    "hot": {
      "min_age": "0d",
      "actions": {
        "rollover": {
          "max_primary_shard_size": "50GB"
        },
        "set_priority": {
          "priority": 100
        }
      }
    },
    "warm": {
      "min_age": "7d",
      "actions": {
        "set_replicas": {
          "number_of_replicas": 1
        },
        "forcemerge": {
          "max_num_segments": 1
        }
      }
    },
    "cold": {
      "min_age": "30d",
      "actions": {
        "searchable_snapshot": {}
      }
    },
    "delete": {
      "min_age": "90d",
      "actions": {
        "delete": {}
      }
    }
  }
}
```

### Cross-Cluster Search

Query across multiple Elasticsearch clusters:

```typescript
// Configure cross-cluster connection
// In each cluster's elasticsearch.yml
search.remote:
  production:
    seeds: ["prod-cluster.example.com:9300"]
    proxy.socket_connections: 10

// Query both clusters
async function globalSearch(query: string) {
  const response = await es.search({
    index: ['production:editions', 'backup:editions'],
    body: {
      query: {
        multi_match: {
          query: query,
          fields: ['title^2', 'authors']
        }
      }
    }
  });

  return response.hits.hits;
}
```

## API Layer Scaling

### Docker Swarm Mode

Native Docker clustering (3+ manager nodes):

```bash
# Initialize swarm
docker swarm init

# Join as manager
docker swarm join --token SWMTKN-... 10.0.0.1:2377

# Deploy service (auto-replicas across nodes)
docker service create \
  --name echo-api \
  --replicas 10 \
  --update-parallelism 2 \
  --update-delay 10s \
  -p 3000:3000 \
  ghcr.io/aikenahac/echo-alexandria:latest

# Scale dynamically
docker service update --replicas 20 echo-api
```

### Kubernetes Deployment

Enterprise-grade orchestration with auto-scaling:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: echo-api
spec:
  replicas: 10
  selector:
    matchLabels:
      app: echo-api
  template:
    metadata:
      labels:
        app: echo-api
    spec:
      containers:
      - name: echo-api
        image: ghcr.io/aikenahac/echo-alexandria:latest
        ports:
        - containerPort: 3000
        resources:
          requests:
            cpu: "500m"
            memory: "512Mi"
          limits:
            cpu: "1000m"
            memory: "1Gi"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 10

---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: echo-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: echo-api
  minReplicas: 5
  maxReplicas: 50
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

**Auto-scaling:** Automatically adds/removes replicas based on CPU/memory.

### CDN for Static Assets

Serve cover images and assets from edge locations:

```typescript
// Configure CDN in API responses
export async function getEdition(key: string) {
  const edition = await getEditionFromDb(key);

  return {
    ...edition,
    covers: edition.covers.map(id => ({
      id,
      url: `https://cdn.example.com/covers/${id}.jpg`,  // CDN URL
      thumbnail: `https://cdn.example.com/covers/${id}_thumb.jpg`
    }))
  };
}
```

**CDN providers:**
- Cloudflare (cheapest, global)
- AWS CloudFront (integrated with AWS)
- Google Cloud CDN (high performance)
- Fastly (real-time purge)

## Request Rate Limiting

Prevent abuse and ensure fair resource usage:

```typescript
import { RateLimiter } from 'bottleneck';

// Per-IP rate limiter (1000 req/minute)
const limiter = new RateLimiter({
  minTime: 60 * 1000 / 1000,  // 1 minute window
  maxConcurrent: 1
});

export async function apiMiddleware(req: Request) {
  const clientIp = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for');

  try {
    await limiter.schedule(async () => {
      // Continue to next middleware
    });
  } catch (e) {
    return new Response('Rate limit exceeded', { status: 429 });
  }
}

// Or use Redis-backed rate limiter for distributed systems
const redis = new Redis(process.env.REDIS_URL);

async function checkRateLimit(clientId: string, limit: number = 1000) {
  const key = `ratelimit:${clientId}`;
  const current = await redis.incr(key);

  if (current === 1) {
    await redis.expire(key, 60);  // 1 minute window
  }

  if (current > limit) {
    return false;  // Limit exceeded
  }

  return true;
}
```

## Database Migration Strategies

### Zero-Downtime Migrations

Deploy schema changes without downtime:

**Blue-Green Pattern:**
1. Keep old code/schema running (Blue)
2. Deploy new code to separate environment (Green)
3. Copy data from Blue to Green
4. Switch load balancer to Green
5. Archive Blue environment

```bash
# 1. Create new database
CREATE DATABASE echo_alexandria_new AS SELECT * FROM echo_alexandria;

# 2. Run migrations on new database
psql -d echo_alexandria_new -f migrations.sql

# 3. Validate data integrity
SELECT COUNT(*) FROM echo_alexandria;
SELECT COUNT(*) FROM echo_alexandria_new;

# 4. Switch applications to new database
# Update DATABASE_URL in load balancer

# 5. After validation, drop old database
DROP DATABASE echo_alexandria;
ALTER DATABASE echo_alexandria_new RENAME TO echo_alexandria;
```

**Online Schema Changes:**
```sql
-- Add column without locking table
ALTER TABLE editions ADD COLUMN new_field TEXT DEFAULT NULL;

-- Backfill data incrementally
UPDATE editions SET new_field = computed_value WHERE new_field IS NULL LIMIT 10000;

-- Create index concurrently (doesn't lock reads)
CREATE INDEX CONCURRENTLY idx_new_field ON editions(new_field);
```

## Scaling the Import Pipeline

### Parallel Processing

Process multiple files concurrently:

```typescript
import { Worker } from 'worker_threads';
import path from 'path';

const NUM_WORKERS = 4;
const workers = [];

// Create worker pool
for (let i = 0; i < NUM_WORKERS; i++) {
  const worker = new Worker(path.join(__dirname, 'import-worker.ts'));
  workers.push(worker);
}

// Distribute files across workers
const files = ['authors.jsonl', 'works.jsonl', 'editions.jsonl'];
let workerIndex = 0;

for (const file of files) {
  const worker = workers[workerIndex % NUM_WORKERS];
  worker.postMessage({ file });
  workerIndex++;
}

// Worker code (import-worker.ts)
import { parentPort } from 'worker_threads';

parentPort.on('message', async (msg) => {
  const { file } = msg;

  const inserter = new BatchInserter(1000, upsertAuthorsBatch);

  // Process file
  const stream = Bun.file(file).stream();
  // ... parse and insert

  await inserter.flush();
  console.log(`${file}: ${inserter.getTotalInserted()} inserted`);
});
```

### Distributed Task Queues

Scale imports across machines with Redis/BullMQ:

```typescript
import { Queue, Worker } from 'bullmq';

// Add import job
const importQueue = new Queue('imports', {
  connection: { host: 'redis.example.com' }
});

await importQueue.add('import-authors', { file: 'authors.jsonl' });
await importQueue.add('import-works', { file: 'works.jsonl' });
await importQueue.add('import-editions', { file: 'editions.jsonl' });

// Process jobs across multiple workers
const worker = new Worker('imports', async (job) => {
  const { file } = job.data;

  const inserter = new BatchInserter(1000, upsertAuthorsBatch);

  // Process file
  const lines = Bun.file(file).text().split('\n');
  for (const line of lines) {
    const record = JSON.parse(line);
    await inserter.add(record);
  }

  await inserter.flush();
  return { imported: inserter.getTotalInserted() };
}, {
  connection: { host: 'redis.example.com' },
  concurrency: 5  // 5 concurrent jobs per worker
});
```

## Cost Optimization

### Server Right-Sizing

Match server types to actual workload:

```
Development:
- 1x 2-core API server (t2.small)
- 1x 2GB PostgreSQL (t2.small)
- 1x 2GB Elasticsearch (t2.small)
Cost: ~$50/month

Small Production (100 QPS):
- 3x 4-core API servers (t3.medium) = $150/month
- 1x 16GB PostgreSQL (r6i.xlarge) = $300/month
- 2x 8GB Elasticsearch (m5.2xlarge) = $400/month
Total: ~$850/month

Large Production (1000 QPS):
- 20x 4-core API servers = $1000/month
- 1x 64GB PostgreSQL + replicas = $2000/month
- 10x 16GB Elasticsearch = $3000/month
Total: ~$6000/month
```

### Reserved Instances

Commit to 1-3 year terms for 30-60% discounts:

```bash
# Reserved instance breakdown
Spot instances: 70% on-demand cost (for fault-tolerant services)
1-year reserved: 40% discount
3-year reserved: 60% discount
```

## Monitoring at Scale

### Prometheus + Grafana

Collect metrics across all components:

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'api-servers'
    static_configs:
      - targets: ['api1:9090', 'api2:9090', 'api3:9090']

  - job_name: 'postgresql'
    static_configs:
      - targets: ['db:9187']  # postgres_exporter

  - job_name: 'elasticsearch'
    static_configs:
      - targets: ['es:9114']  # elasticsearch_exporter
```

### ELK Stack (Elasticsearch, Logstash, Kibana)

Centralized logging across all servers:

```
[API Servers] -> [Filebeat] -> [Logstash] -> [Elasticsearch]
[PostgreSQL]                                      |
[Elasticsearch]                                   v
                                            [Kibana Dashboard]
```

---

## Scaling Checklist

- [ ] Architecture is stateless
- [ ] Load balancer configured and tested
- [ ] Database read replicas deployed
- [ ] PgBouncer connection pooling active
- [ ] Elasticsearch cluster has 3+ nodes
- [ ] CDN configured for static assets
- [ ] Rate limiting implemented
- [ ] Zero-downtime migration plan documented
- [ ] Kubernetes/Docker Swarm cluster ready
- [ ] Auto-scaling policies configured
- [ ] Monitoring (Prometheus/ELK) deployed
- [ ] Cost optimization review completed
- [ ] Disaster recovery plan in place
- [ ] Load testing completed (2x expected peak)

---

## Related Topics

- **[Performance Tuning](./performance-tuning.md)** - Optimize individual components
- **[Custom Search](./custom-search.md)** - Enhance search relevance
- **[Batch Processing](./batch-processing.md)** - Efficient data imports
