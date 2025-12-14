---
sidebar_position: 4
title: Batch Processing
---

# Batch Processing

Deep dive into Echo Alexandria's batch processing system for efficient bulk data operations.

## BatchInserter Class Architecture

The `BatchInserter` class is a generic, reusable component for efficient bulk database operations.

### Class Definition

```typescript
// From src/import/batch.ts
export class BatchInserter<T> {
  private batch: T[] = [];
  private readonly batchSize: number;
  private readonly insertFn: (items: T[]) => Promise<void>;
  private totalInserted = 0;

  constructor(batchSize: number, insertFn: (items: T[]) => Promise<void>) {
    this.batchSize = batchSize;
    this.insertFn = insertFn;
  }

  async add(item: T) { ... }
  async flush() { ... }
  getTotalInserted(): number { ... }
}
```

### Generic Type Support

The `<T>` parameter allows the class to work with any data type:

```typescript
// For authors
const authorInserter = new BatchInserter<AuthorRecord>(
  1000,
  upsertAuthorsBatch
);

// For works
const workInserter = new BatchInserter<WorkRecord>(
  1000,
  upsertWorksBatch
);

// For editions
const editionInserter = new BatchInserter<EditionRecord>(
  1000,
  upsertEditionsBatch
);
```

## How BatchInserter Works

### Flow Diagram

```
add() -> accumulate in batch[]
           |
           v
        batch.length >= batchSize?
           |
        YES -> flush() automatically
           |
           v
        insertFn(batch) executes
           |
           v
        totalInserted += batch.length
        batch = [] (reset)
```

### The add() Method

Accumulates records and auto-flushes when batch size reached:

```typescript
async add(item: T) {
  this.batch.push(item);
  if (this.batch.length >= this.batchSize) {
    await this.flush();
  }
}
```

**Example usage:**
```typescript
const inserter = new BatchInserter(1000, upsertAuthorsBatch);

// Add records one by one
for (const author of authorRecords) {
  await inserter.add(author);
  // After every 1000 records, automatically flushes
}

// Always call at the end to flush remaining records
await inserter.flush();
```

### The flush() Method

Executes the insert function and resets the batch:

```typescript
async flush() {
  if (this.batch.length === 0) return;  // No-op if empty

  await this.insertFn(this.batch);      // Execute insert
  this.totalInserted += this.batch.length;
  this.batch = [];                      // Reset
}
```

**When to call:**
- Automatically when batch size reached
- Manually at end of import to flush remaining records
- When switching to a different data type

### Progress Tracking

Track how many records have been inserted:

```typescript
const inserter = new BatchInserter(1000, upsertAuthorsBatch);

for (const author of authorRecords) {
  await inserter.add(author);

  if (inserted % 10000 === 0) {
    console.log(`Inserted: ${inserter.getTotalInserted()} authors`);
  }
}

const finalCount = inserter.getTotalInserted();
console.log(`Total inserted: ${finalCount}`);
```

## Memory Management

### Batch Size Impact

Larger batches use more memory but have higher throughput:

| Batch Size | Approx Memory | Notes |
|-----------|--------------|-------|
| 500 | 2.5MB | Safe, low memory usage |
| 1000 | 5MB | Default, balanced |
| 2000 | 10MB | Higher throughput, more memory |
| 5000 | 25MB | High throughput, significant memory |
| 10000 | 50MB | Risky, may cause OOM on small servers |

**Memory calculation:**
```
Memory per record ≈ 5-10KB (author) to 10-20KB (edition with text)
Batch memory = batch_size * memory_per_record

Example: 1000 authors * 5KB = 5MB
```

### Memory Profiling

Monitor memory usage during imports:

```typescript
import { performance } from 'perf_hooks';

class MonitoredBatchInserter<T> extends BatchInserter<T> {
  async add(item: T) {
    const before = process.memoryUsage().heapUsed;

    await super.add(item);

    const after = process.memoryUsage().heapUsed;
    const delta = (after - before) / 1024 / 1024;

    if (this.getTotalInserted() % 10000 === 0) {
      const used = after / 1024 / 1024;
      console.log(`Memory: ${used.toFixed(0)}MB (+${delta.toFixed(1)}MB)`);
    }
  }
}
```

### Trade-offs: Throughput vs Memory

**High throughput (large batch):**
- Pros: Fewer database round-trips
- Cons: Uses more memory, risk of OOM

**Low memory (small batch):**
- Pros: Safe for memory-constrained systems
- Cons: More frequent database writes

**Recommendation:** Start with 1000 (default), test with your data volume.

## Batch Size Optimization

### Testing Methodology

Test different batch sizes with production-like data:

```bash
#!/bin/bash

# Test script: benchmark_batch_sizes.sh

for BATCH_SIZE in 500 1000 2000 5000; do
  echo "Testing batch size: $BATCH_SIZE"

  START=$(date +%s)

  # Run import with specific batch size
  BATCH_SIZE=$BATCH_SIZE npm run import:authors

  END=$(date +%s)
  DURATION=$((END - START))

  RECORDS=1000000
  THROUGHPUT=$((RECORDS / DURATION))

  echo "Throughput: $THROUGHPUT records/sec"
  echo "---"
done
```

### PostgreSQL Batch Insert Performance

PostgreSQL performance characteristics:

```sql
-- Measure insertion time for different batch sizes

-- Batch size 100
INSERT INTO editions (key, title) VALUES
  ('k1', 't1'), ('k2', 't2'), ... (100 rows)
-- ~5ms

-- Batch size 1000
INSERT INTO editions (key, title) VALUES
  ('k1', 't1'), ... (1000 rows)
-- ~35ms (3.5ms per 100 records)

-- Batch size 5000
INSERT INTO editions (key, title) VALUES
  ('k1', 't1'), ... (5000 rows)
-- ~150ms (3ms per 100 records)
```

**Diminishing returns:** After ~1000 records, time per record decreases minimally.

### Elasticsearch Bulk API Limits

Elasticsearch has practical limits:

```
Default max request size: 100MB
Typical document size: 1-5KB
Safe batch size: 10,000-100,000 documents per bulk request
```

**For Echo Alexandria:**
```typescript
// Elasticsearch bulk example
const bulkOps = [];
for (const edition of editions) {
  bulkOps.push({ index: { _index: 'editions' } });
  bulkOps.push(edition);

  if (bulkOps.length >= 100000) {
    await es.bulk({ body: bulkOps });
    bulkOps = [];
  }
}
```

### Network Latency Considerations

Network round-trip impact:

```
Assuming 1ms network latency per request:

Batch 500:  1ms latency, 5MB network = 0.5 requests/sec max
Batch 1000: 1ms latency, 10MB network = 0.1 requests/sec max
Batch 5000: 1ms latency, 50MB network = 0.02 requests/sec max

With local database (typical): negligible
With remote database: significant
```

**Optimization:** Use PgBouncer to pool connections and reduce latency.

## Parallel Batch Processing

### Worker Pool Pattern

Process multiple batches concurrently:

```typescript
import { Worker } from 'worker_threads';
import path from 'path';

class BatchWorkerPool {
  private workers: Worker[] = [];
  private taskQueue: any[] = [];
  private activeWorkers = 0;

  constructor(numWorkers: number) {
    for (let i = 0; i < numWorkers; i++) {
      const worker = new Worker(
        path.join(__dirname, 'batch-worker.ts')
      );
      this.workers.push(worker);
    }
  }

  async processBatch(data: any) {
    return new Promise((resolve) => {
      const task = { data, resolve };
      this.taskQueue.push(task);
      this.processTasks();
    });
  }

  private processTasks() {
    while (this.activeWorkers < this.workers.length && this.taskQueue.length > 0) {
      const task = this.taskQueue.shift();
      const worker = this.workers[this.activeWorkers % this.workers.length];

      this.activeWorkers++;

      worker.postMessage(task.data);
      worker.once('message', () => {
        this.activeWorkers--;
        task.resolve();
        this.processTasks();
      });
    }
  }
}
```

### Partitioning Data by Key Range

Divide data among workers:

```typescript
function partitionByKeyRange(records: any[], numPartitions: number) {
  const partitions = Array.from({ length: numPartitions }, () => []);

  const sortedRecords = records.sort((a, b) =>
    a.key.localeCompare(b.key)
  );

  sortedRecords.forEach((record, index) => {
    const partition = index % numPartitions;
    partitions[partition].push(record);
  });

  return partitions;
}

// Usage
const authorPartitions = partitionByKeyRange(authorRecords, 4);

const workers = authorPartitions.map((partition, i) =>
  spawnWorker(`worker-${i}`, partition)
);

await Promise.all(workers);
```

### Coordinating Multiple Workers

Aggregate results from workers:

```typescript
async function importWithWorkers(recordSets: any[][]) {
  const workers = recordSets.map((records, i) => {
    return new Promise((resolve) => {
      const worker = new Worker('./batch-worker.ts');

      worker.on('message', (result) => {
        console.log(`Worker ${i}: ${result.inserted} records`);
        resolve(result);
      });

      worker.postMessage(records);
    });
  });

  const results = await Promise.all(workers);
  const total = results.reduce((sum, r) => sum + r.inserted, 0);

  console.log(`Total inserted: ${total}`);
  return total;
}
```

### Avoiding Deadlocks

PostgreSQL deadlock prevention:

```sql
-- Process in consistent order
-- Bad: Different processes insert in different order
-- Process 1: INSERT INTO authors ..., then INSERT INTO works ...
-- Process 2: INSERT INTO works ..., then INSERT INTO authors ...
-- -> DEADLOCK

-- Good: All processes insert in same order
-- Process 1: INSERT INTO authors ..., then INSERT INTO works ...
-- Process 2: INSERT INTO authors ..., then INSERT INTO works ...
-- -> No deadlock

-- Configure lock timeout
SET lock_timeout = '10s';
SET statement_timeout = '30s';
```

## Error Handling in Batches

### Partial Batch Failures

Handle failures gracefully:

```typescript
async function upsertWithErrorHandling(records: any[]) {
  const errors = [];

  for (const record of records) {
    try {
      // Try to insert individual record
      await db.insert(editions).values(record)
        .onConflictDoUpdate({
          target: editions.key,
          set: record
        });
    } catch (error) {
      errors.push({
        record: record.key,
        error: error.message
      });
    }
  }

  return {
    successful: records.length - errors.length,
    failed: errors.length,
    errors: errors
  };
}
```

### Retry Strategies

Implement exponential backoff:

```typescript
async function insertWithRetry(
  insertFn: () => Promise<void>,
  maxRetries: number = 3
) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await insertFn();
      return; // Success
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw error; // All retries exhausted
      }

      // Exponential backoff: 100ms, 200ms, 400ms
      const delay = Math.pow(2, attempt) * 100;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Usage
const inserter = new BatchInserter(1000, async (records) => {
  await insertWithRetry(() => upsertAuthorsBatch(records));
});
```

### Dead Letter Queues

Track failed records for later processing:

```typescript
class DeadLetterQueue {
  private queue: any[] = [];

  async add(record: any, error: Error) {
    this.queue.push({
      timestamp: new Date(),
      record,
      error: error.message,
      attempts: 0
    });
  }

  async processQueue() {
    for (const item of this.queue) {
      if (item.attempts < 3) {
        try {
          await upsertAuthorsBatch([item.record]);
          this.queue.splice(this.queue.indexOf(item), 1);
        } catch (error) {
          item.attempts++;
        }
      }
    }

    // Log permanently failed records
    const permanent = this.queue.filter(item => item.attempts >= 3);
    if (permanent.length > 0) {
      console.error(`Permanently failed: ${permanent.length} records`);
      // Write to dead-letter log file or database
    }
  }
}
```

## Upsert Pattern Deep Dive

Echo Alexandria uses PostgreSQL's `ON CONFLICT DO UPDATE` for upsert operations.

### How ON CONFLICT Works

```sql
INSERT INTO authors (key, name) VALUES ('author123', 'John Doe')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  last_imported = NOW();
```

**Behavior:**
1. Try to insert new record
2. If key already exists (conflict), update instead
3. If no conflict, insert new record

### Conflict Resolution Strategies

**Update all fields:**
```sql
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  bio = EXCLUDED.bio,
  birth_date = EXCLUDED.birth_date,
  last_imported = NOW()
```

**Conditional update (only if source is newer):**
```sql
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  bio = EXCLUDED.bio,
  last_imported = EXCLUDED.last_imported
WHERE authors.last_imported < EXCLUDED.last_imported
```

**Selective update (some fields only):**
```sql
ON CONFLICT (key) DO UPDATE SET
  last_imported = NOW()
  -- Don't update name, bio, etc. (keep existing)
```

### Performance Implications

Upsert vs separate insert/update:

```
Upsert (single operation):
- Pros: Atomic, simpler code
- Cons: Slightly slower than insert-only

Separate operations:
- Pros: Can optimize for read-heavy workloads
- Cons: Non-atomic, complex error handling

For Echo Alexandria: Upsert is best (idempotent imports)
```

### Bulk Upsert Optimization

```typescript
// From src/import/batch.ts
export async function upsertAuthorsBatch(authorRecords: any[]) {
  if (authorRecords.length === 0) return;

  await db.insert(authors)
    .values(authorRecords)
    .onConflictDoUpdate({
      target: authors.key,
      set: {
        name: sql`EXCLUDED.name`,
        personalName: sql`EXCLUDED.personal_name`,
        // ... other fields
        lastImported: sql`EXCLUDED.last_imported`
      }
    });
}
```

**Key points:**
- Single SQL statement for entire batch
- Uses `sql` template for field references
- Much faster than individual upserts

## Monitoring Batch Operations

### ProgressLogger Class

Track progress with detailed metrics:

```typescript
// From src/import/progress.ts
export class ProgressLogger {
  constructor(
    private type: string,
    private logInterval: number = 10000
  ) { }

  log(recordsProcessed: number, force: boolean = false): void {
    // Shows: processed, elapsed time, rate
  }

  logComplete(recordsProcessed: number, recordsInserted: number): void {
    // Summary statistics
  }

  logPhase(phase: string): void {
    // Mark import phases
  }
}

// Usage
const progress = new ProgressLogger('Authors');

for (const author of authorRecords) {
  await inserter.add(author);
  progress.log(processed);
}

await inserter.flush();
progress.logComplete(processed, inserter.getTotalInserted());
```

### Throughput Metrics

Calculate and track throughput:

```typescript
class PerformanceMonitor {
  private startTime: number = Date.now();
  private checkpoints: { time: number; count: number }[] = [];

  recordCheckpoint(count: number) {
    this.checkpoints.push({
      time: Date.now(),
      count
    });
  }

  getThroughput(): { overall: number; recent: number } {
    const latest = this.checkpoints[this.checkpoints.length - 1];
    const first = this.checkpoints[0];

    const overallSeconds = (latest.time - first.time) / 1000;
    const overallRate = latest.count / overallSeconds;

    // Recent rate (last checkpoint)
    const recent = this.checkpoints[this.checkpoints.length - 2];
    const recentSeconds = (latest.time - recent.time) / 1000;
    const recentRate = (latest.count - recent.count) / recentSeconds;

    return {
      overall: overallRate,  // records/sec
      recent: recentRate     // records/sec
    };
  }
}
```

### Latency Percentiles

Monitor query latency:

```typescript
class LatencyTracker {
  private latencies: number[] = [];

  recordLatency(ms: number) {
    this.latencies.push(ms);
  }

  getPercentiles() {
    const sorted = this.latencies.sort((a, b) => a - b);
    const len = sorted.length;

    return {
      p50: sorted[Math.floor(len * 0.50)],
      p95: sorted[Math.floor(len * 0.95)],
      p99: sorted[Math.floor(len * 0.99)],
      max: sorted[len - 1],
      min: sorted[0],
      avg: this.latencies.reduce((a, b) => a + b) / len
    };
  }
}
```

## Custom Batch Processors

### Example 1: Batch Email Sender

```typescript
class EmailBatchSender {
  private batch: { email: string; subject: string; body: string }[] = [];

  constructor(
    private batchSize: number = 100,
    private sender: (emails: any[]) => Promise<void> = sendEmails
  ) { }

  async add(email: string, subject: string, body: string) {
    this.batch.push({ email, subject, body });

    if (this.batch.length >= this.batchSize) {
      await this.flush();
    }
  }

  async flush() {
    if (this.batch.length === 0) return;

    try {
      await this.sender(this.batch);
      console.log(`Sent ${this.batch.length} emails`);
      this.batch = [];
    } catch (error) {
      console.error(`Failed to send batch: ${error.message}`);
      throw error;
    }
  }
}

// Usage
const emailBatcher = new EmailBatchSender(100);

for (const user of users) {
  await emailBatcher.add(
    user.email,
    'Welcome!',
    `Hello ${user.name}`
  );
}

await emailBatcher.flush();
```

### Example 2: Batch File Processor

```typescript
class FileProcessorBatch {
  private batch: string[] = [];

  constructor(
    private batchSize: number = 50,
    private processor: (files: string[]) => Promise<void> = processFiles
  ) { }

  async add(filePath: string) {
    this.batch.push(filePath);

    if (this.batch.length >= this.batchSize) {
      await this.flush();
    }
  }

  async flush() {
    if (this.batch.length === 0) return;

    try {
      await this.processor(this.batch);
      console.log(`Processed ${this.batch.length} files`);
      this.batch = [];
    } catch (error) {
      console.error(`Failed to process batch: ${error.message}`);
      throw error;
    }
  }
}

// Usage
const fileBatcher = new FileProcessorBatch(50);

for (const file of filesToProcess) {
  await fileBatcher.add(file);
}

await fileBatcher.flush();
```

## Best Practices

### 1. Always Flush at the End

```typescript
// RIGHT: Flush at end
const inserter = new BatchInserter(1000, insertFn);

for (const record of records) {
  await inserter.add(record);
}

await inserter.flush(); // Critical!

// WRONG: Forgot flush
for (const record of records) {
  await inserter.add(record);
}
// Last batch (if < 1000) never inserted!
```

### 2. Handle Errors Gracefully

```typescript
try {
  const inserter = new BatchInserter(1000, insertFn);

  for (const record of records) {
    await inserter.add(record);
  }

  await inserter.flush();
  console.log(`Success: ${inserter.getTotalInserted()} records`);
} catch (error) {
  console.error(`Import failed: ${error.message}`);
  // Log to error tracking, send alert, etc.
  throw error;
}
```

### 3. Log Progress Regularly

```typescript
const inserter = new BatchInserter(1000, insertFn);
const progress = new ProgressLogger('Authors');

for (const record of records) {
  await inserter.add(record);
  progress.log(processingCount);
}

await inserter.flush();
progress.logComplete(processingCount, inserter.getTotalInserted());
```

### 4. Test with Production-Like Data

```bash
# Test with real data volumes
npm run import:authors -- --dry-run  # Validate without inserting

# Test with different batch sizes
BATCH_SIZE=500 npm run import:authors
BATCH_SIZE=2000 npm run import:authors

# Measure performance
time npm run import:authors
```

### 5. Monitor Memory Usage

```typescript
const before = process.memoryUsage();

// Run import
await runImport();

const after = process.memoryUsage();
const heapUsed = (after.heapUsed - before.heapUsed) / 1024 / 1024;

console.log(`Memory used: ${heapUsed.toFixed(1)}MB`);
```

### 6. Document Batch Configuration

```typescript
/**
 * BatchInserter configuration for authors import
 *
 * Batch size: 1000 records
 * - Throughput: ~100k records/sec
 * - Memory: ~5MB per batch
 * - Network: ~10MB per request
 *
 * Tested on: 16GB RAM server
 * Max concurrent: 3 parallel workers
 */
const authorInserter = new BatchInserter(1000, upsertAuthorsBatch);
```

---

## Batch Processing Checklist

- [ ] BatchInserter sized for your data (test different sizes)
- [ ] Memory usage monitored and optimized
- [ ] Error handling implemented (retries, dead-letter queue)
- [ ] Progress logging configured
- [ ] Flush called at end of import
- [ ] Parallel workers configured (if needed)
- [ ] Deadlock prevention in place (ordered inserts)
- [ ] Upsert strategy appropriate for your use case
- [ ] Performance benchmarked
- [ ] Load tested with production-like data volumes
- [ ] Monitoring metrics configured
- [ ] Documentation updated with batch configuration

---

## Related Topics

- **[Performance Tuning](./performance-tuning.md)** - Optimize batch throughput
- **[Scaling](./scaling.md)** - Distribute batch processing
- **[Custom Search](./custom-search.md)** - Index data efficiently
