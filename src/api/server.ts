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

// Elasticsearch re-index trigger (full)
app.post("/api/admin/reindex", async (c) => {
  const apiKey = c.req.header("X-API-Key");
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const { reindexWithTracking } = await import("../elasticsearch/reindex-optimized");
    const jobId = crypto.randomUUID();

    // Start reindex in background (don't await)
    reindexWithTracking(jobId).catch((error) => {
      console.error("Reindex failed:", error);
    });

    return c.json({
      message: "Elasticsearch re-index started (full)",
      jobId,
      status: "started",
    });
  } catch (error) {
    console.error("Failed to start reindex:", error);
    return c.json({ error: "Failed to start reindex" }, 500);
  }
});

// Elasticsearch re-index authors only
app.post("/api/admin/reindex/authors", async (c) => {
  const apiKey = c.req.header("X-API-Key");
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const { reindexAuthorsOnly } = await import("../elasticsearch/reindex-optimized");
    const jobId = crypto.randomUUID();

    // Start reindex in background (don't await)
    reindexAuthorsOnly(jobId).catch((error) => {
      console.error("Authors reindex failed:", error);
    });

    return c.json({
      message: "Authors re-index started",
      jobId,
      status: "started",
    });
  } catch (error) {
    console.error("Failed to start authors reindex:", error);
    return c.json({ error: "Failed to start authors reindex" }, 500);
  }
});

// Elasticsearch re-index editions only
app.post("/api/admin/reindex/editions", async (c) => {
  const apiKey = c.req.header("X-API-Key");
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const { reindexEditionsOnly } = await import("../elasticsearch/reindex-optimized");
    const jobId = crypto.randomUUID();

    // Start reindex in background (don't await)
    reindexEditionsOnly(jobId).catch((error) => {
      console.error("Editions reindex failed:", error);
    });

    return c.json({
      message: "Editions re-index started",
      jobId,
      status: "started",
    });
  } catch (error) {
    console.error("Failed to start editions reindex:", error);
    return c.json({ error: "Failed to start editions reindex" }, 500);
  }
});

// Get reindex status
app.get("/api/admin/reindex/status", async (c) => {
  const apiKey = c.req.header("X-API-Key");
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const { getLatestReindexJob } = await import("../elasticsearch/reindex-optimized");
    const job = await getLatestReindexJob();

    if (!job) {
      return c.json({ status: "no_jobs", message: "No reindex jobs found" });
    }

    // Calculate progress percentage
    let progress = 0;
    if (job.status === "completed") {
      progress = 100;
    } else if (job.status === "running") {
      const authorsProgress = job.totalAuthors > 0
        ? (job.authorsIndexed / job.totalAuthors) * 50
        : 0;
      const editionsProgress = job.totalEditions > 0
        ? (job.editionsIndexed / job.totalEditions) * 50
        : 0;
      progress = authorsProgress + editionsProgress;
    }

    return c.json({
      ...job,
      progress: Math.round(progress),
    });
  } catch (error) {
    console.error("Failed to get reindex status:", error);
    return c.json({ error: "Failed to get reindex status" }, 500);
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
