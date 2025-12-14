# Admin Panel Integration Guide - Elasticsearch Reindex

## Overview

This guide shows how to integrate the Elasticsearch re-index feature into your Echo Alexandria admin panel.

## Backend Setup

### 1. Run Database Migration

```bash
# Apply the reindex_jobs table migration
bun db:push
```

### 2. API Endpoints

Two new admin endpoints are available:

#### Trigger Re-index

```http
POST /api/admin/reindex
X-API-Key: your-admin-api-key
```

**Response:**
```json
{
  "message": "Elasticsearch re-index started",
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "started"
}
```

#### Get Re-index Status

```http
GET /api/admin/reindex/status
X-API-Key: your-admin-api-key
```

**Response (Running):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "full",
  "status": "running",
  "currentPhase": "indexing_editions",
  "authorsIndexed": 15000000,
  "editionsIndexed": 25000000,
  "totalAuthors": 15000000,
  "totalEditions": 55000000,
  "progress": 73,
  "startedAt": "2024-01-15T10:30:00.000Z",
  "completedAt": null,
  "error": null
}
```

**Response (Completed):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "full",
  "status": "completed",
  "currentPhase": null,
  "authorsIndexed": 15000000,
  "editionsIndexed": 55000000,
  "totalAuthors": 15000000,
  "totalEditions": 55000000,
  "progress": 100,
  "startedAt": "2024-01-15T10:30:00.000Z",
  "completedAt": "2024-01-15T13:45:00.000Z",
  "error": null
}
```

## Frontend Integration

### 1. Update Tab Name

Rename "Data Import" tab to "Alexandria" in your admin panel navigation.

### 2. Add Reindex Section

Add a new section in the Alexandria tab (formerly Data Import) for Elasticsearch reindexing.

### React Component Example

```typescript
import { useState, useEffect } from 'react';
import { format } from 'date-fns';

interface ReindexJob {
  id: string;
  type: string;
  status: 'running' | 'completed' | 'failed';
  currentPhase: string | null;
  authorsIndexed: number;
  editionsIndexed: number;
  totalAuthors: number;
  totalEditions: number;
  progress: number;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
}

export function ElasticsearchReindex() {
  const [job, setJob] = useState<ReindexJob | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);

  // Poll for status every 5 seconds when a job is running
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/admin/reindex/status', {
          headers: {
            'X-API-Key': localStorage.getItem('adminApiKey') || '',
          },
        });
        const data = await response.json();

        if (data.status !== 'no_jobs') {
          setJob(data);
        }
      } catch (error) {
        console.error('Failed to fetch reindex status:', error);
      }
    };

    fetchStatus(); // Initial fetch

    // Poll every 5 seconds if a job is running
    const interval = setInterval(() => {
      if (job?.status === 'running') {
        fetchStatus();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [job?.status]);

  const triggerReindex = async () => {
    setIsTriggering(true);
    try {
      const response = await fetch('/api/admin/reindex', {
        method: 'POST',
        headers: {
          'X-API-Key': localStorage.getItem('adminApiKey') || '',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Reindex started:', data);

        // Refresh status after a moment
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        alert('Failed to start reindex');
      }
    } catch (error) {
      console.error('Failed to trigger reindex:', error);
      alert('Failed to start reindex');
    } finally {
      setIsTriggering(false);
    }
  };

  const getPhaseDisplay = (phase: string | null) => {
    if (!phase) return '';

    const phases: Record<string, string> = {
      recreating_indices: 'Recreating indices...',
      indexing_authors: 'Indexing authors...',
      indexing_editions: 'Indexing editions...',
      refreshing: 'Refreshing indices...',
    };

    return phases[phase] || phase;
  };

  const formatDuration = (start: string, end: string | null) => {
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
    const durationMs = endTime - startTime;

    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3>Elasticsearch Re-index</h3>
        <p className="text-muted">
          Re-index data from PostgreSQL to Elasticsearch with improved search relevance
        </p>
      </div>

      <div className="card-body">
        {!job || job.status === 'no_jobs' ? (
          <div>
            <p>No reindex jobs found. Start a reindex to apply the latest search improvements.</p>
            <button
              onClick={triggerReindex}
              disabled={isTriggering}
              className="btn btn-primary"
            >
              {isTriggering ? 'Starting...' : 'Start Reindex'}
            </button>
          </div>
        ) : (
          <div>
            {/* Status Badge */}
            <div className="mb-3">
              <span className={`badge badge-${
                job.status === 'completed' ? 'success' :
                job.status === 'failed' ? 'danger' :
                'warning'
              }`}>
                {job.status.toUpperCase()}
              </span>
            </div>

            {/* Progress Bar */}
            {job.status === 'running' && (
              <div className="mb-3">
                <div className="progress" style={{ height: '30px' }}>
                  <div
                    className="progress-bar progress-bar-striped progress-bar-animated"
                    role="progressbar"
                    style={{ width: `${job.progress}%` }}
                  >
                    {job.progress}%
                  </div>
                </div>
                <small className="text-muted">{getPhaseDisplay(job.currentPhase)}</small>
              </div>
            )}

            {/* Stats */}
            <div className="row mb-3">
              <div className="col-md-6">
                <strong>Authors:</strong>{' '}
                {job.authorsIndexed.toLocaleString()} / {job.totalAuthors.toLocaleString()}
              </div>
              <div className="col-md-6">
                <strong>Editions:</strong>{' '}
                {job.editionsIndexed.toLocaleString()} / {job.totalEditions.toLocaleString()}
              </div>
            </div>

            {/* Timing */}
            <div className="mb-3">
              <strong>Started:</strong> {format(new Date(job.startedAt), 'PPpp')}<br />
              {job.completedAt && (
                <>
                  <strong>Completed:</strong> {format(new Date(job.completedAt), 'PPpp')}<br />
                </>
              )}
              <strong>Duration:</strong> {formatDuration(job.startedAt, job.completedAt)}
            </div>

            {/* Error */}
            {job.error && (
              <div className="alert alert-danger">
                <strong>Error:</strong> {job.error}
              </div>
            )}

            {/* Action Button */}
            {job.status !== 'running' && (
              <button
                onClick={triggerReindex}
                disabled={isTriggering}
                className="btn btn-primary"
              >
                {isTriggering ? 'Starting...' : 'Start New Reindex'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="card-footer">
        <small className="text-muted">
          <strong>What does reindexing do?</strong><br />
          • Recreates Elasticsearch indices with improved mappings<br />
          • Re-indexes all authors and editions from PostgreSQL<br />
          • Applies quality scoring based on covers, ISBNs, and authors<br />
          • Enables multi-field search (title + authors)<br />
          • Takes ~2-4 hours for full dataset<br />
          <strong>Note:</strong> PostgreSQL data is not affected, only Elasticsearch indices are recreated.
        </small>
      </div>
    </div>
  );
}
```

### 3. Add to Alexandria Tab

In your Alexandria (formerly Data Import) tab component:

```tsx
import { ElasticsearchReindex } from './ElasticsearchReindex';
import { DataImport } from './DataImport'; // Your existing import component

export function AlexandriaTab() {
  return (
    <div>
      <h2>Alexandria - Data Management</h2>

      {/* Existing data import section */}
      <DataImport />

      {/* New reindex section */}
      <div className="mt-4">
        <ElasticsearchReindex />
      </div>
    </div>
  );
}
```

## Testing

### 1. Test API Endpoints

```bash
# Trigger reindex
curl -X POST http://localhost:3000/api/admin/reindex \
  -H "X-API-Key: your-admin-api-key"

# Check status
curl http://localhost:3000/api/admin/reindex/status \
  -H "X-API-Key: your-admin-api-key"
```

### 2. Test in Production

```bash
# SSH into production server
ssh your-server

# Run database migration
cd /path/to/echo-data-source
bun db:push

# Restart API server
pm2 restart echo-data-api

# Trigger reindex from CLI (or use admin panel)
bun es:reindex
```

## Monitoring

The reindex job updates the database every batch (1000 records), so you can monitor progress in real-time:

- **Progress**: Combined percentage of authors + editions indexed
- **Current Phase**: Shows which step is currently running
- **Rate**: ~5,000-10,000 docs/sec typical
- **Duration**: ~2-4 hours for 55M editions + 15M authors

## Troubleshooting

### Reindex stuck at 0%

Check Elasticsearch is running:
```bash
curl http://localhost:9200
```

### Reindex failed with error

Check the `reindex_jobs` table for error details:
```sql
SELECT * FROM reindex_jobs ORDER BY started_at DESC LIMIT 1;
```

### Frontend not showing status

- Verify API key is correct in localStorage
- Check browser console for CORS errors
- Ensure polling interval is running (check console logs)

## Database Schema

The `reindex_jobs` table structure:

```sql
CREATE TABLE reindex_jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  authors_indexed INTEGER DEFAULT 0,
  editions_indexed INTEGER DEFAULT 0,
  total_authors INTEGER DEFAULT 0,
  total_editions INTEGER DEFAULT 0,
  current_phase TEXT,
  error TEXT,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);
```
