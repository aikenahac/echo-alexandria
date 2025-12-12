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
