---
title: Health Check
---

# Health Check

Check the health and status of the API service.

## Endpoint

```
GET /health
```

## Authentication

No authentication required. This is a public endpoint.

---

## Response

### Success Response (200 OK)

```json
{
  "status": "ok",
  "timestamp": "2024-12-13T10:30:00.000Z"
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | Service status: `"ok"` |
| `timestamp` | string | ISO 8601 timestamp of when the check was performed |

---

## Examples

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

### Basic Health Check

<Tabs>
  <TabItem value="curl" label="cURL" default>
    ```bash
    curl "http://localhost:3001/health"
    ```
  </TabItem>
  <TabItem value="javascript" label="JavaScript">
    ```javascript
    const response = await fetch('http://localhost:3001/health');
    const health = await response.json();
    console.log(`Service status: ${health.status}`);
    console.log(`Checked at: ${health.timestamp}`);
    ```
  </TabItem>
  <TabItem value="python" label="Python">
    ```python
    import requests

    response = requests.get('http://localhost:3001/health')
    health = response.json()
    print(f"Service status: {health['status']}")
    print(f"Checked at: {health['timestamp']}")
    ```
  </TabItem>
</Tabs>

### Periodic Service Monitoring

<Tabs>
  <TabItem value="javascript" label="JavaScript">
    ```javascript
    async function monitorService(intervalMs = 30000) {
      setInterval(async () => {
        try {
          const response = await fetch('http://localhost:3001/health');
          const health = await response.json();

          if (health.status === 'ok') {
            console.log('Service is healthy');
          } else {
            console.warn(`Service status: ${health.status}`);
          }
        } catch (error) {
          console.error('Service health check failed:', error);
        }
      }, intervalMs);
    }

    // Check every 30 seconds
    monitorService(30000);
    ```
  </TabItem>
  <TabItem value="python" label="Python">
    ```python
    import requests
    import time

    def monitor_service(interval=30):
        while True:
            try:
                response = requests.get('http://localhost:3001/health')
                health = response.json()

                if health['status'] == 'ok':
                    print('Service is healthy')
                else:
                    print(f"Service status: {health['status']}")
            except requests.exceptions.RequestException as e:
                print(f'Service health check failed: {e}')

            time.sleep(interval)

    # Check every 30 seconds
    monitor_service(30)
    ```
  </TabItem>
</Tabs>

### Readiness Check

<Tabs>
  <TabItem value="bash" label="Bash">
    ```bash
    #!/bin/bash

    # Check service health before deploying
    health=$(curl -s "http://localhost:3001/health")
    status=$(echo $health | jq -r '.status')

    if [ "$status" = "ok" ]; then
      echo "Service is ready for requests"
      exit 0
    else
      echo "Service is not ready"
      exit 1
    fi
    ```
  </TabItem>
  <TabItem value="javascript" label="JavaScript">
    ```javascript
    async function isServiceReady() {
      try {
        const response = await fetch('http://localhost:3001/health');
        if (!response.ok) return false;

        const health = await response.json();
        return health.status === 'ok';
      } catch (error) {
        return false;
      }
    }

    // Usage in startup routine
    async function startApplication() {
      const ready = await isServiceReady();
      if (!ready) {
        throw new Error('API service is not ready');
      }
      console.log('API service is ready, starting application...');
    }
    ```
  </TabItem>
  <TabItem value="python" label="Python">
    ```python
    import requests
    import time

    def wait_for_service(max_attempts=30, wait_time=1):
        """Wait for service to be ready before starting"""
        for attempt in range(max_attempts):
            try:
                response = requests.get('http://localhost:3001/health')
                if response.status_code == 200:
                    health = response.json()
                    if health['status'] == 'ok':
                        return True
            except requests.exceptions.RequestException:
                pass

            if attempt < max_attempts - 1:
                print(f'Waiting for service... (attempt {attempt + 1}/{max_attempts})')
                time.sleep(wait_time)

        return False

    # Wait up to 30 seconds for service to be ready
    if wait_for_service():
        print('Service is ready')
    else:
        raise RuntimeError('Service failed to become ready')
    ```
  </TabItem>
</Tabs>

---

## Use Cases

### Docker Health Check

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY . .

# Install dependencies and build
RUN npm install && npm run build

# Define health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

EXPOSE 3001
CMD ["npm", "start"]
```

### Kubernetes Readiness Probe

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
spec:
  template:
    spec:
      containers:
      - name: api
        image: api:latest
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 15
          periodSeconds: 20
          timeoutSeconds: 5
          failureThreshold: 3
```

### Service Status Dashboard

```javascript
class HealthDashboard {
  constructor(service, checkInterval = 5000) {
    this.service = service;
    this.checkInterval = checkInterval;
    this.lastCheck = null;
    this.isHealthy = false;
  }

  async start() {
    await this.check();
    setInterval(() => this.check(), this.checkInterval);
  }

  async check() {
    try {
      const response = await fetch(`http://${this.service}/health`);
      const health = await response.json();

      this.isHealthy = health.status === 'ok';
      this.lastCheck = new Date(health.timestamp);

      this.updateUI();
    } catch (error) {
      this.isHealthy = false;
      this.lastCheck = new Date();
      this.updateUI();
    }
  }

  updateUI() {
    const element = document.getElementById('health-status');
    if (element) {
      element.innerHTML = `
        <div class="health-status ${this.isHealthy ? 'healthy' : 'unhealthy'}">
          <span class="status-indicator"></span>
          <span class="status-text">${this.isHealthy ? 'Healthy' : 'Unhealthy'}</span>
          <span class="last-check">${this.lastCheck?.toLocaleTimeString()}</span>
        </div>
      `;
    }
  }
}

// Start monitoring
const dashboard = new HealthDashboard('localhost:3001');
dashboard.start();
```

---

## Related Endpoints

- **[Catalog Authors](./catalog/authors.md)** - Browse authors
- **[Catalog Works](./catalog/works.md)** - Browse works
- **[Catalog Editions](./catalog/editions.md)** - Browse editions
- **[Search Authors](./search/authors.md)** - Search authors
- **[Search Editions](./search/editions.md)** - Search editions
