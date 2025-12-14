---
title: Trigger Import
---

# Trigger Import

Start a data import job for authors, works, or editions from OpenLibrary.

## Endpoint

```
POST /api/admin/import/:type
```

## Authentication

**Required:** `X-API-Key` header

Provide the admin API key in the `X-API-Key` header. This endpoint is protected and requires valid authentication.

```bash
curl -X POST "http://localhost:3001/api/admin/import/authors" \
  -H "X-API-Key: your-api-key-here"
```

---

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | string | **Yes** | Import type: `authors`, `works`, or `editions` |
| `X-API-Key` | header | **Yes** | Admin API key for authentication |

### Type

The type of data to import. Must be one of:

- `authors` - Import author data
- `works` - Import literary works
- `editions` - Import book editions

**Examples:**
```
POST /api/admin/import/authors
POST /api/admin/import/works
POST /api/admin/import/editions
```

---

## Response

### Success Response (200 OK)

```json
{
  "message": "authors import started",
  "status": "started"
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `message` | string | Human-readable message indicating import type |
| `status` | string | Status value: `"started"` |

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
  "error": "Failed to start import"
}
```

---

## Examples

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

### Trigger Authors Import

<Tabs>
  <TabItem value="curl" label="cURL" default>
    ```bash
    curl -X POST "http://localhost:3001/api/admin/import/authors" \
      -H "X-API-Key: your-api-key"
    ```
  </TabItem>
  <TabItem value="javascript" label="JavaScript">
    ```javascript
    const response = await fetch(
      'http://localhost:3001/api/admin/import/authors',
      {
        method: 'POST',
        headers: {
          'X-API-Key': 'your-api-key'
        }
      }
    );
    const result = await response.json();
    console.log(result);
    // { message: "authors import started", status: "started" }
    ```
  </TabItem>
  <TabItem value="python" label="Python">
    ```python
    import requests

    response = requests.post(
        'http://localhost:3001/api/admin/import/authors',
        headers={'X-API-Key': 'your-api-key'}
    )
    result = response.json()
    print(result)
    # {'message': 'authors import started', 'status': 'started'}
    ```
  </TabItem>
</Tabs>

### Trigger Works Import

<Tabs>
  <TabItem value="curl" label="cURL" default>
    ```bash
    curl -X POST "http://localhost:3001/api/admin/import/works" \
      -H "X-API-Key: your-api-key"
    ```
  </TabItem>
  <TabItem value="javascript" label="JavaScript">
    ```javascript
    const response = await fetch(
      'http://localhost:3001/api/admin/import/works',
      {
        method: 'POST',
        headers: { 'X-API-Key': 'your-api-key' }
      }
    );
    const result = await response.json();
    console.log(result.message);
    ```
  </TabItem>
  <TabItem value="python" label="Python">
    ```python
    response = requests.post(
        'http://localhost:3001/api/admin/import/works',
        headers={'X-API-Key': 'your-api-key'}
    )
    result = response.json()
    print(result['message'])
    ```
  </TabItem>
</Tabs>

### Trigger Editions Import

<Tabs>
  <TabItem value="curl" label="cURL" default>
    ```bash
    curl -X POST "http://localhost:3001/api/admin/import/editions" \
      -H "X-API-Key: your-api-key"
    ```
  </TabItem>
  <TabItem value="javascript" label="JavaScript">
    ```javascript
    async function startImport(type) {
      const response = await fetch(
        `http://localhost:3001/api/admin/import/${type}`,
        {
          method: 'POST',
          headers: { 'X-API-Key': 'your-api-key' }
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log(`Import started: ${result.message}`);
        return result;
      } else {
        console.error(`Error: ${response.status}`);
      }
    }

    // Start imports
    await startImport('editions');
    ```
  </TabItem>
  <TabItem value="python" label="Python">
    ```python
    def start_import(import_type):
        response = requests.post(
            f'http://localhost:3001/api/admin/import/{import_type}',
            headers={'X-API-Key': 'your-api-key'}
        )

        if response.ok:
            result = response.json()
            print(f"Import started: {result['message']}")
            return result
        else:
            print(f"Error: {response.status_code}")

    # Start import
    start_import('editions')
    ```
  </TabItem>
</Tabs>

---

## Behavior

**Asynchronous:** Import jobs run in the background. The endpoint returns immediately after starting the import without waiting for it to complete.

**Queuing:** Only one import of a specific type can run at a time. Starting a new import while one is already running will cancel the previous job.

**Monitoring:** Use the [Import Status](./import-status.md) endpoint to check the progress of an import.

---

## Use Cases

### Refresh All Data

```javascript
async function refreshAllData(apiKey) {
  const types = ['authors', 'works', 'editions'];

  for (const type of types) {
    const response = await fetch(
      `http://localhost:3001/api/admin/import/${type}`,
      {
        method: 'POST',
        headers: { 'X-API-Key': apiKey }
      }
    );

    if (response.ok) {
      const result = await response.json();
      console.log(result.message);
    }
  }
}

await refreshAllData('your-api-key');
```

### Monitor Import Progress

```javascript
async function importAndMonitor(type, apiKey) {
  // Start the import
  const startResponse = await fetch(
    `http://localhost:3001/api/admin/import/${type}`,
    {
      method: 'POST',
      headers: { 'X-API-Key': apiKey }
    }
  );

  if (!startResponse.ok) {
    console.error('Failed to start import');
    return;
  }

  console.log(`Import started for ${type}`);

  // Poll status every 5 seconds
  let completed = false;
  while (!completed) {
    await new Promise(resolve => setTimeout(resolve, 5000));

    const statusResponse = await fetch(
      `http://localhost:3001/api/admin/import/status/${type}`,
      {
        headers: { 'X-API-Key': apiKey }
      }
    );

    const status = await statusResponse.json();
    console.log(`Status: ${status.status} - ${status.recordsProcessed} records`);

    if (status.status === 'completed' || status.status === 'failed') {
      completed = true;
      console.log(`Import ${status.status}`);
    }
  }
}
```

---

## Related Endpoints

- **[Import Status](./import-status.md)** - Check the status of an import job
- **[Catalog Authors](../catalog/authors.md)** - Browse imported authors
- **[Catalog Works](../catalog/works.md)** - Browse imported works
- **[Catalog Editions](../catalog/editions.md)** - Browse imported editions
