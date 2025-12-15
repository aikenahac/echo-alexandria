# Admin Panel Implementation Prompt

Copy and paste this entire message into Claude Code in your Echo Alexandria admin panel repository:

---

I need you to update the admin panel to add Elasticsearch reindex functionality. Here are the details:

## Task Overview

1. Rename the "Data Import" tab to "Alexandria"
2. Add a new Elasticsearch Reindex section to this tab
3. Create a UI component with progress tracking and controls

## Backend API Endpoints (Already Implemented)

The echo-data-source backend now has these endpoints:

### Trigger Full Reindex
```http
POST /api/admin/reindex
X-API-Key: <admin-api-key>

Response:
{
  "message": "Elasticsearch re-index started (full)",
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "started"
}
```

### Trigger Authors Only
```http
POST /api/admin/reindex/authors
X-API-Key: <admin-api-key>

Response:
{
  "message": "Authors re-index started",
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "started"
}
```

### Trigger Editions Only
```http
POST /api/admin/reindex/editions
X-API-Key: <admin-api-key>

Response:
{
  "message": "Editions re-index started",
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "started"
}
```

### Get Reindex Status
```http
GET /api/admin/reindex/status
X-API-Key: <admin-api-key>

Response (Running):
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "full",  // or "authors" or "editions"
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

Response (Completed):
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

Response (No Jobs):
{
  "status": "no_jobs",
  "message": "No reindex jobs found"
}
```

## UI Requirements

### 1. Tab Rename
- Find the "Data Import" tab in the admin panel
- Rename it to "Alexandria"
- Keep all existing import functionality in that tab

### 2. Reindex Section Layout

Add a new card/section below the existing import section with:

**Header:**
- Title: "Elasticsearch Re-index"
- Subtitle: "Re-index data from PostgreSQL to Elasticsearch with improved search relevance"

**Status Display (when job exists):**
- Status badge (Running: yellow/warning, Completed: green/success, Failed: red/danger)
- Progress bar (0-100%, animated when running)
- Current phase indicator (e.g., "Indexing editions...")
- Stats:
  - Authors: {authorsIndexed} / {totalAuthors}
  - Editions: {editionsIndexed} / {totalEditions}
- Timing:
  - Started: {formatted start time}
  - Completed: {formatted completion time} (if completed)
  - Duration: {hours}h {minutes}m
- Error message (if failed, shown in alert/danger box)

**Control Buttons:**

Three buttons in a button group:
1. "Reindex All" - Triggers full reindex (authors + editions)
2. "Reindex Authors" - Triggers authors only
3. "Reindex Editions" - Triggers editions only

Buttons should be:
- Disabled when a job is currently running
- Show loading spinner when triggering
- Primary/accent color for "Reindex All", secondary for others

**Info Box (footer):**
```
What does reindexing do?
• Recreates Elasticsearch indices with improved mappings
• Re-indexes all authors and editions from PostgreSQL
• Applies quality scoring based on covers, ISBNs, and authors
• Enables multi-field search (title + authors)
• Authors: ~30 minutes, Editions: ~2-3 hours (for full dataset)

Note: PostgreSQL data is not affected, only Elasticsearch indices are recreated.
```

### 3. Polling Behavior

- Poll the status endpoint every 5 seconds when a job is running
- Stop polling when job completes or fails
- Auto-refresh status on component mount
- Show real-time progress updates

### 4. User Interactions

**Trigger Flow:**
1. User clicks a reindex button
2. Button shows loading spinner
3. POST request to trigger endpoint
4. On success: Auto-refresh status after 1 second
5. On error: Show error alert

**Status Updates:**
- Poll every 5 seconds while status === "running"
- Update progress bar smoothly
- Show current phase (recreating indices, indexing authors, etc.)
- Calculate and show ETA if possible

### 5. Design Guidelines

- Match the existing admin panel design system (colors, fonts, spacing)
- Use the same card/section styling as the import section
- Use date-fns for date formatting (as specified in CLAUDE.md)
- Follow the project's existing patterns for API calls and error handling
- Make it responsive (looks good on mobile and desktop)

### 6. TypeScript Interface

```typescript
interface ReindexJob {
  id: string;
  type: 'full' | 'authors' | 'editions';
  status: 'running' | 'completed' | 'failed';
  currentPhase: 'recreating_indices' | 'indexing_authors' | 'indexing_editions' | 'refreshing' | null;
  authorsIndexed: number;
  editionsIndexed: number;
  totalAuthors: number;
  totalEditions: number;
  progress: number;  // 0-100
  startedAt: string;  // ISO 8601
  completedAt: string | null;
  error: string | null;
}
```

### 7. Example State Management

```typescript
const [job, setJob] = useState<ReindexJob | null>(null);
const [isLoading, setIsLoading] = useState(false);

useEffect(() => {
  // Initial fetch
  fetchStatus();

  // Poll every 5 seconds if job is running
  const interval = setInterval(() => {
    if (job?.status === 'running') {
      fetchStatus();
    }
  }, 5000);

  return () => clearInterval(interval);
}, [job?.status]);

const fetchStatus = async () => {
  const response = await fetch('/api/admin/reindex/status', {
    headers: { 'X-API-Key': apiKey }
  });
  const data = await response.json();
  if (data.status !== 'no_jobs') {
    setJob(data);
  }
};

const triggerReindex = async (type: 'full' | 'authors' | 'editions') => {
  setIsLoading(true);
  const endpoint = type === 'full'
    ? '/api/admin/reindex'
    : `/api/admin/reindex/${type}`;

  await fetch(endpoint, {
    method: 'POST',
    headers: { 'X-API-Key': apiKey }
  });

  setTimeout(fetchStatus, 1000);
  setIsLoading(false);
};
```

### 8. Phase Display Mapping

```typescript
const getPhaseDisplay = (phase: string | null) => {
  const phases = {
    recreating_indices: 'Recreating indices...',
    indexing_authors: 'Indexing authors...',
    indexing_editions: 'Indexing editions...',
    refreshing: 'Refreshing indices...',
  };
  return phase ? phases[phase] || phase : '';
};
```

## Testing

After implementation, test these scenarios:

1. **No job exists**: Should show initial state with all 3 buttons enabled
2. **Trigger full reindex**: Should POST to /api/admin/reindex, show loading, then status
3. **Job running**: Should show progress bar, disable buttons, poll for updates
4. **Job completed**: Should show 100% progress, success badge, enable buttons
5. **Job failed**: Should show error message in alert, enable buttons
6. **Authors only**: Should show only authors progress
7. **Editions only**: Should show only editions progress

## Implementation Notes

- Find the existing "Data Import" tab component file
- Rename the tab to "Alexandria" in the navigation
- Create a new component called `ElasticsearchReindex` or similar
- Add it to the Alexandria tab below the existing import section
- Use the project's existing API client/service for HTTP requests
- Use the project's existing UI components (Button, Card, ProgressBar, Badge, Alert, etc.)
- Follow the project's file structure and naming conventions

## Expected Result

A professional, polished UI section that:
- ✅ Matches the existing admin panel design
- ✅ Shows real-time progress for reindexing jobs
- ✅ Allows admins to trigger full, authors-only, or editions-only reindex
- ✅ Displays helpful information about what reindexing does
- ✅ Handles all edge cases (no jobs, running, completed, failed)
- ✅ Works on mobile and desktop

Let me know if you need any clarification or have questions about the implementation!
