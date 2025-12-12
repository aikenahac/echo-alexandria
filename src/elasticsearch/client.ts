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
  try {
    const client = getElasticsearchClient();
    const health = await client.ping();
    return { connected: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    return {
      connected: false,
      error: errorMessage,
      details: {
        url: process.env.ELASTICSEARCH_URL,
        suggestion:
          "Make sure Elasticsearch is running and accessible at the configured URL",
      },
    };
  }
}
