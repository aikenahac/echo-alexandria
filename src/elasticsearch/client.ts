/**
 * Elasticsearch REST API wrapper using fetch (compatible with Bun)
 * The @elastic/elasticsearch client has compatibility issues with Bun,
 * so we use direct REST API calls instead.
 */

function getElasticsearchUrl(): string {
  const url = process.env.ELASTICSEARCH_URL;
  if (!url) {
    throw new Error("ELASTICSEARCH_URL is not set");
  }
  return url;
}

/**
 * Make a request to Elasticsearch REST API
 */
async function esRequest(
  method: string,
  path: string,
  body?: any
): Promise<any> {
  const url = `${getElasticsearchUrl()}${path}`;
  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok && response.status !== 404) {
    const errorText = await response.text();
    throw new Error(
      `Elasticsearch error [${response.status}]: ${errorText}`
    );
  }

  return response.json();
}

/**
 * Elasticsearch API wrapper compatible with Bun
 */
export const es = {
  indices: {
    async exists(params: { index: string }): Promise<boolean> {
      try {
        const response = await fetch(
          `${getElasticsearchUrl()}/${params.index}`,
          { method: "HEAD" }
        );
        return response.status === 200;
      } catch {
        return false;
      }
    },

    async create(params: { index: string; body: any }): Promise<any> {
      return esRequest("PUT", `/${params.index}`, params.body);
    },

    async delete(params: { index: string }): Promise<any> {
      return esRequest("DELETE", `/${params.index}`);
    },

    async refresh(params: { index: string | string[] }): Promise<any> {
      const indices = Array.isArray(params.index)
        ? params.index.join(",")
        : params.index;
      return esRequest("POST", `/${indices}/_refresh`);
    },
  },

  async bulk(params: {
    body?: any[];
    operations?: any[];
    refresh?: boolean;
  }): Promise<any> {
    // Support both 'body' and 'operations' parameter names
    const operations = params.body || params.operations;
    if (!operations) {
      throw new Error("bulk() requires either 'body' or 'operations' parameter");
    }

    // Elasticsearch bulk API expects newline-delimited JSON
    const ndjson =
      operations.map((item) => JSON.stringify(item)).join("\n") + "\n";

    const url = params.refresh
      ? `${getElasticsearchUrl()}/_bulk?refresh=true`
      : `${getElasticsearchUrl()}/_bulk`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-ndjson",
      },
      body: ndjson,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Elasticsearch bulk error [${response.status}]: ${errorText}`
      );
    }

    return response.json();
  },

  async search(params: { index: string; body: any }): Promise<any> {
    return esRequest("POST", `/${params.index}/_search`, params.body);
  },
};

/**
 * Test Elasticsearch connection and return detailed error info
 */
export async function checkElasticsearchConnection(): Promise<{
  connected: boolean;
  error?: string;
  details?: any;
}> {
  const url = getElasticsearchUrl();

  try {
    console.log(`Testing connection to Elasticsearch at ${url}...`);
    const response = await fetch(url);

    if (!response.ok) {
      return {
        connected: false,
        error: `Elasticsearch returned HTTP ${response.status}: ${response.statusText}`,
        details: {
          url,
          suggestion:
            "Elasticsearch is reachable but returned an error. Check if it's fully started.",
        },
      };
    }

    const data = (await response.json()) as any;
    console.log(
      `✓ Elasticsearch is running (version: ${data.version?.number || "unknown"})`
    );

    return { connected: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    // Provide specific error messages based on error type
    let suggestion = "Make sure Elasticsearch is running and accessible";

    if (errorMessage.includes("ECONNREFUSED")) {
      suggestion =
        "Connection refused. Elasticsearch is not running or not accessible at this address.";
    } else if (errorMessage.includes("ENOTFOUND")) {
      suggestion = `Host not found. Check if '${url}' is the correct address.`;
    } else if (errorMessage.includes("ETIMEDOUT")) {
      suggestion = "Connection timed out. Check network connectivity.";
    }

    return {
      connected: false,
      error: errorMessage,
      details: {
        url,
        suggestion,
        note: "If using Docker, make sure containers are on the same network or use the correct host",
      },
    };
  }
}
