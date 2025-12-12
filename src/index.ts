import { serve } from "@hono/node-server";
import app from "./api/server";

const port = parseInt(process.env.PORT || "3000");

console.log(`Starting Echo Data Source API server on port ${port}...`);

serve({
  fetch: app.fetch,
  port,
});

console.log(`Server running at http://localhost:${port}`);
