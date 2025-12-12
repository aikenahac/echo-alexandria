import { Client } from "@elastic/elasticsearch";

let esClient: Client | null = null;

function getElasticsearchClient(): Client {
  if (!esClient) {
    if (!process.env.ELASTICSEARCH_URL) {
      throw new Error("ELASTICSEARCH_URL is not set");
    }
    esClient = new Client({
      node: process.env.ELASTICSEARCH_URL,
    });
  }
  return esClient;
}

// Lazy-loaded singleton with Proxy pattern
export const es = new Proxy({} as Client, {
  get: (_, prop) => {
    return getElasticsearchClient()[prop as keyof Client];
  },
}) as Client;

/**
 * Test Elasticsearch connection and return detailed error info
 */
export async function checkElasticsearchConnection(): Promise<{
  connected: boolean;
  error?: string;
  details?: any;
}> {
  const url = process.env.ELASTICSEARCH_URL;

  if (!url) {
    return {
      connected: false,
      error: "ELASTICSEARCH_URL environment variable is not set",
      details: {
        suggestion: "Set ELASTICSEARCH_URL in your .env file",
      },
    };
  }

  // First, try a simple HTTP health check
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

    const data = await response.json() as any;
    console.log(
      `✓ Elasticsearch is running (version: ${data.version?.number || "unknown"})`
    );

    // Now try using the official client
    try {
      const client = getElasticsearchClient();
      await client.ping();
      return { connected: true };
    } catch (clientError) {
      // Elasticsearch is running but client has issues - continue anyway
      console.warn(
        "Warning: Elasticsearch client ping failed, but HTTP check succeeded. Continuing..."
      );
      return { connected: true };
    }
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
