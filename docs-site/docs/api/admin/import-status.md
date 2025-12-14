---
title: Import Status
---

# Import Status

Check the current status and progress of data import jobs.

## Endpoint

```
GET /api/admin/import/status/:type
```

## Authentication

**Required:** `X-API-Key` header

Provide the admin API key in the `X-API-Key` header. This endpoint is protected and requires valid authentication.

```bash
curl "http://localhost:3001/api/admin/import/status/authors" \
  -H "X-API-Key: your-api-key-here"
```

---

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | string | **Yes** | Import type: `authors`, `works`, or `editions` |
| `X-API-Key` | header | **Yes** | Admin API key for authentication |

### Type

The type of import to check status for. Must be one of:

- `authors` - Check authors import status
- `works` - Check works import status
- `editions` - Check editions import status

---

## Response

### Success Response (200 OK)

#### While Idle (No Job)

```json
{
  "id": null,
  "type": "authors",
  "status": "idle",
  "recordsProcessed": 0,
  "recordsInserted": 0,
  "recordsUpdated": 0,
  "error": null,
  "startedAt": null,
  "completedAt": null,
  "progressPercentage": 0
}
```

#### While Running

```json
{
  "id": "job-12345",
  "type": "authors",
  "status": "running",
  "recordsProcessed": 50000,
  "recordsInserted": 45000,
  "recordsUpdated": 5000,
  "error": null,
  "startedAt": "2024-12-13T10:30:00.000Z",
  "completedAt": null,
  "progressPercentage": 45
}
```

#### When Completed

```json
{
  "id": "job-12345",
  "type": "authors",
  "status": "completed",
  "recordsProcessed": 120500,
  "recordsInserted": 115000,
  "recordsUpdated": 5500,
  "error": null,
  "startedAt": "2024-12-13T10:30:00.000Z",
  "completedAt": "2024-12-13T11:45:30.000Z",
  "progressPercentage": 100
}
```

#### When Failed

```json
{
  "id": "job-12345",
  "type": "works",
  "status": "failed",
  "recordsProcessed": 25000,
  "recordsInserted": 20000,
  "recordsUpdated": 5000,
  "error": "Connection timeout to OpenLibrary",
  "startedAt": "2024-12-13T10:30:00.000Z",
  "completedAt": "2024-12-13T10:35:45.000Z",
  "progressPercentage": 20
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string \| null | Unique job identifier, `null` if no job has run |
| `type` | string | Import type: `authors`, `works`, or `editions` |
| `status` | string | Current status: `idle`, `running`, `completed`, or `failed` |
| `recordsProcessed` | number | Total records processed from source |
| `recordsInserted` | number | Records newly inserted into database |
| `recordsUpdated` | number | Existing records updated |
| `error` | string \| null | Error message if failed, `null` otherwise |
| `startedAt` | string \| null | ISO 8601 timestamp when job started |
| `completedAt` | string \| null | ISO 8601 timestamp when job completed, `null` if still running |
| `progressPercentage` | number | Estimated progress as percentage (0-100) |

### Error Responses

**Unauthorized (401 Unauthorized):**
```json
{
  "error": "Unauthorized"
}
```

Returned when the `X-API-Key` header is missing or invalid.

**Invalid Type (400 Bad Request):**
```json
{
  "error": "Invalid import type"
}
```

Returned when the type parameter is not one of `authors`, `works`, or `editions`.

**Server Error (500 Internal Server Error):**
```json
{
  "error": "Failed to get import status"
}
```

---

## Status Values

| Status | Description |
|--------|-------------|
| `idle` | No import job has been run yet, or the last job has finished |
| `running` | An import job is currently in progress |
| `completed` | The last import job completed successfully |
| `failed` | The last import job failed |

---

## Examples

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

### Check Authors Import Status

<Tabs>
  <TabItem value="curl" label="cURL" default>
    ```bash
    curl "http://localhost:3001/api/admin/import/status/authors" \
      -H "X-API-Key: your-api-key"
    ```
  </TabItem>
  <TabItem value="javascript" label="JavaScript">
    ```javascript
    const response = await fetch(
      'http://localhost:3001/api/admin/import/status/authors',
      {
        headers: { 'X-API-Key': 'your-api-key' }
      }
    );
    const status = await response.json();
    console.log(`Status: ${status.status}`);
    console.log(`Progress: ${status.progressPercentage}%`);
    console.log(`Records processed: ${status.recordsProcessed}`);
    ```
  </TabItem>
  <TabItem value="python" label="Python">
    ```python
    import requests

    response = requests.get(
        'http://localhost:3001/api/admin/import/status/authors',
        headers={'X-API-Key': 'your-api-key'}
    )
    status = response.json()
    print(f"Status: {status['status']}")
    print(f"Progress: {status['progressPercentage']}%")
    print(f"Records processed: {status['recordsProcessed']}")
    ```
  </TabItem>
</Tabs>

### Poll Import Progress

<Tabs>
  <TabItem value="curl" label="cURL" default>
    ```bash
    # Poll status every 5 seconds
    while true; do
      curl "http://localhost:3001/api/admin/import/status/editions" \
        -H "X-API-Key: your-api-key"
      echo ""
      sleep 5
    done
    ```
  </TabItem>
  <TabItem value="javascript" label="JavaScript">
    ```javascript
    async function waitForImport(type, apiKey, pollInterval = 5000) {
      let completed = false;

      while (!completed) {
        const response = await fetch(
          `http://localhost:3001/api/admin/import/status/${type}`,
          {
            headers: { 'X-API-Key': apiKey }
          }
        );

        const status = await response.json();
        console.log(`[${new Date().toLocaleTimeString()}] ${status.status}: ${status.progressPercentage}%`);
        console.log(`  Processed: ${status.recordsProcessed}, Inserted: ${status.recordsInserted}, Updated: ${status.recordsUpdated}`);

        if (status.status === 'completed' || status.status === 'failed') {
          completed = true;
          console.log(`Import ${status.status}`);
          if (status.error) {
            console.error(`Error: ${status.error}`);
          }
        } else if (status.status !== 'idle') {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
      }
    }

    await waitForImport('editions', 'your-api-key');
    ```
  </TabItem>
  <TabItem value="python" label="Python">
    ```python
    import requests
    import time
    from datetime import datetime

    def wait_for_import(import_type, api_key, poll_interval=5):
        completed = False

        while not completed:
            response = requests.get(
                f'http://localhost:3001/api/admin/import/status/{import_type}',
                headers={'X-API-Key': api_key}
            )
            status = response.json()

            now = datetime.now().strftime('%H:%M:%S')
            print(f'[{now}] {status["status"]}: {status["progressPercentage"]}%')
            print(f'  Processed: {status["recordsProcessed"]}, Inserted: {status["recordsInserted"]}, Updated: {status["recordsUpdated"]}')

            if status['status'] in ['completed', 'failed']:
                completed = True
                print(f'Import {status["status"]}')
                if status['error']:
                    print(f'Error: {status["error"]}')
            elif status['status'] != 'idle':
                time.sleep(poll_interval)

    wait_for_import('editions', 'your-api-key')
    ```
  </TabItem>
</Tabs>

### Check All Import Types

<Tabs>
  <TabItem value="javascript" label="JavaScript">
    ```javascript
    async function checkAllImports(apiKey) {
      const types = ['authors', 'works', 'editions'];

      for (const type of types) {
        const response = await fetch(
          `http://localhost:3001/api/admin/import/status/${type}`,
          {
            headers: { 'X-API-Key': apiKey }
          }
        );

        const status = await response.json();
        console.log(`${type}: ${status.status} (${status.progressPercentage}%)`);
      }
    }

    await checkAllImports('your-api-key');
    ```
  </TabItem>
  <TabItem value="python" label="Python">
    ```python
    def check_all_imports(api_key):
        types = ['authors', 'works', 'editions']

        for import_type in types:
            response = requests.get(
                f'http://localhost:3001/api/admin/import/status/{import_type}',
                headers={'X-API-Key': api_key}
            )
            status = response.json()
            print(f"{import_type}: {status['status']} ({status['progressPercentage']}%)")

    check_all_imports('your-api-key')
    ```
  </TabItem>
</Tabs>

---

## Use Cases

### Dashboard Status Widget

```javascript
class ImportStatusWidget {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.types = ['authors', 'works', 'editions'];
  }

  async updateStatus() {
    const statuses = {};

    for (const type of this.types) {
      const response = await fetch(
        `http://localhost:3001/api/admin/import/status/${type}`,
        {
          headers: { 'X-API-Key': this.apiKey }
        }
      );
      statuses[type] = await response.json();
    }

    this.render(statuses);
  }

  render(statuses) {
    // Render status in HTML
    Object.entries(statuses).forEach(([type, status]) => {
      const element = document.getElementById(`status-${type}`);
      if (element) {
        element.innerHTML = `
          <h3>${type}</h3>
          <p>Status: ${status.status}</p>
          <p>Progress: ${status.progressPercentage}%</p>
          <progress value="${status.progressPercentage}" max="100"></progress>
        `;
      }
    });
  }
}
```

### Automated Import with Retry

```javascript
async function importWithRetry(type, apiKey, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // Start import
    const startResponse = await fetch(
      `http://localhost:3001/api/admin/import/${type}`,
      {
        method: 'POST',
        headers: { 'X-API-Key': apiKey }
      }
    );

    if (!startResponse.ok) {
      console.error(`Failed to start import attempt ${attempt}`);
      continue;
    }

    // Wait for completion
    let completed = false;
    while (!completed) {
      await new Promise(r => setTimeout(r, 10000));

      const statusResponse = await fetch(
        `http://localhost:3001/api/admin/import/status/${type}`,
        { headers: { 'X-API-Key': apiKey } }
      );
      const status = await statusResponse.json();

      if (status.status === 'completed') {
        console.log(`Import ${type} succeeded`);
        return status;
      } else if (status.status === 'failed') {
        console.error(`Import failed: ${status.error}`);
        if (attempt < maxRetries) {
          console.log(`Retrying... (attempt ${attempt + 1}/${maxRetries})`);
        }
        break;
      }
    }
  }

  throw new Error(`Import failed after ${maxRetries} attempts`);
}
```

---

## Performance Considerations

- **Polling Interval:** For production systems, use at least 5-10 second intervals to avoid excessive requests
- **Timeout Estimation:** Large imports may take hours. Check `recordsProcessed` to estimate remaining time
- **Error Handling:** Always check for errors before assuming completion

---

## Related Endpoints

- **[Trigger Import](./import-trigger.md)** - Start a new import job
- **[Catalog Authors](../catalog/authors.md)** - Browse imported authors
- **[Catalog Works](../catalog/works.md)** - Browse imported works
- **[Catalog Editions](../catalog/editions.md)** - Browse imported editions
