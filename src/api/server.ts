import { Hono } from "hono";
import { cors } from "hono/cors";
import { searchEditions, searchAuthors } from "../elasticsearch/search";
import { importAuthors } from "../import/authors";
import { importWorks } from "../import/works";
import { importEditions } from "../import/editions";

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

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default app;
