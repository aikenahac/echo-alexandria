import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { searchEditions, searchAuthors } from "../elasticsearch/search";
import { importAuthors } from "../import/authors";
import { importWorks } from "../import/works";
import { importEditions } from "../import/editions";
import { listAuthors, listWorks, listEditions } from "./catalog";

const app = new Hono();

// Enable CORS for Echo app
app.use("/*", cors());

// Search endpoints
app.get("/api/search/editions", async (c) => {
  const query = c.req.query("q");
  const limit = parseInt(c.req.query("limit") || "20");
  const offset = parseInt(c.req.query("offset") || "0");

  if (!query) {
    return c.json({ error: "Query parameter 'q' is required" }, 400);
  }

  try {
    const results = await searchEditions(query, limit, offset);
    return c.json(results);
  } catch (error) {
    console.error("Search error:", error);
    return c.json({ error: "Search failed" }, 500);
  }
});

app.get("/api/search/authors", async (c) => {
  const query = c.req.query("q");
  const limit = parseInt(c.req.query("limit") || "20");
  const offset = parseInt(c.req.query("offset") || "0");

  if (!query) {
    return c.json({ error: "Query parameter 'q' is required" }, 400);
  }

  try {
    const results = await searchAuthors(query, limit, offset);
    return c.json(results);
  } catch (error) {
    console.error("Search error:", error);
    return c.json({ error: "Search failed" }, 500);
  }
});

// Admin triggers (protected by API key)
app.post("/api/admin/import/:type", async (c) => {
  const apiKey = c.req.header("X-API-Key");
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const type = c.req.param("type") as "works" | "editions" | "authors";

  if (!["works", "editions", "authors"].includes(type)) {
    return c.json({ error: "Invalid import type" }, 400);
  }

  try {
    // Start import in background (don't await)
    let jobPromise: Promise<any>;

    switch (type) {
      case "authors":
        jobPromise = importAuthors();
        break;
      case "works":
        jobPromise = importWorks();
        break;
      case "editions":
        jobPromise = importEditions();
        break;
    }

    // Return immediately with job started message
    return c.json({
      message: `${type} import started`,
      status: "started",
    });
  } catch (error) {
    console.error(`Failed to start ${type} import:`, error);
    return c.json({ error: "Failed to start import" }, 500);
  }
});

// Get import status for a specific type
app.get("/api/admin/import/status/:type", async (c) => {
  const apiKey = c.req.header("X-API-Key");
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const type = c.req.param("type") as "works" | "editions" | "authors";

  if (!["works", "editions", "authors"].includes(type)) {
    return c.json({ error: "Invalid import type" }, 400);
  }

  try {
    const { getLatestImportJob } = await import("./import-status");
    const job = await getLatestImportJob(type);

    return c.json(job);
  } catch (error) {
    console.error(`Failed to get ${type} import status:`, error);
    return c.json({ error: "Failed to get import status" }, 500);
  }
});

// Catalog listing endpoints (for admin UI)
app.get("/api/catalog/authors", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const pageSize = parseInt(c.req.query("pageSize") || "50");
  const search = c.req.query("search");

  try {
    const result = await listAuthors(page, pageSize, search);
    return c.json(result);
  } catch (error) {
    console.error("List authors error:", error);
    return c.json({ error: "Failed to list authors" }, 500);
  }
});

app.get("/api/catalog/works", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const pageSize = parseInt(c.req.query("pageSize") || "50");
  const search = c.req.query("search");

  try {
    const result = await listWorks(page, pageSize, search);
    return c.json(result);
  } catch (error) {
    console.error("List works error:", error);
    return c.json({ error: "Failed to list works" }, 500);
  }
});

app.get("/api/catalog/editions", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const pageSize = parseInt(c.req.query("pageSize") || "50");
  const search = c.req.query("search");

  try {
    const result = await listEditions(page, pageSize, search);
    return c.json(result);
  } catch (error) {
    console.error("List editions error:", error);
    return c.json({ error: "Failed to list editions" }, 500);
  }
});

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Serve Docusaurus documentation (after all API routes)
// This serves the built static site from docs-site/build
app.use(
  "/*",
  serveStatic({
    root: "./docs-site/build",
    rewriteRequestPath: (path) => {
      // Remove leading slash for file lookup
      return path.startsWith("/") ? path.slice(1) : path;
    },
  })
);

// Fallback to index.html for client-side routing (SPA)
app.get("/*", (c) => {
  return c.html(Bun.file("./docs-site/build/index.html"));
});

export default app;
