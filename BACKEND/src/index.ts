import { Hono } from "hono";
import { cors } from "hono/cors";

import auth from "./routes/auth";
import students from "./routes/students";
import practicals from "./routes/practicals";
import submissions from "./routes/submissions";
import dashboard from "./routes/dashboard";
import exportsRoute from "./routes/exports";
import ocr from "./routes/ocr";

type Bindings = {
  DB: D1Database;
  AI: Ai;
};

const app = new Hono<{
  Bindings: Bindings;
}>();

/*
 * CORS
 * Allows the Vite frontend running on localhost:5173
 * to communicate with the Worker on localhost:8787.
 */
app.use(
  "/api/*",
  cors({
    origin: (origin) => {
      if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:") || origin.endsWith(".pages.dev") || origin.endsWith(".workers.dev")) {
        return origin;
      }
      return "http://localhost:5173";
    },
    allowMethods: [
      "GET",
      "POST",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],
    allowHeaders: [
      "Content-Type",
    ],
    credentials: true,
  })
);

/*
 * Root
 */
app.get("/", (c) => {
  return c.json({
    success: true,
    application: "DBMS Practical Tracker",
    message: "Backend is running successfully",
    status: "online",
  });
});

/*
 * Basic health check
 */
app.get("/api/health", async (c) => {
  try {
    const result = await c.env.DB
      .prepare("SELECT 1 AS connected")
      .first<{ connected: number }>();

    return c.json({
      success: true,
      worker: "online",
      database:
        result?.connected === 1
          ? "connected"
          : "unknown",
    });
  } catch (error) {
    console.error(
      "Database health check failed:",
      error
    );

    return c.json(
      {
        success: false,
        worker: "online",
        database: "disconnected",
      },
      500
    );
  }
});

/*
 * Database table health check
 */
app.get("/api/health/database", async (c) => {
  try {
    const result = await c.env.DB
      .prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
          AND name NOT LIKE '_cf_%'
        ORDER BY name
      `)
      .all<{ name: string }>();

    return c.json({
      success: true,
      tables: result.results,
    });
  } catch (error) {
    console.error(
      "Database table check failed:",
      error
    );

    return c.json(
      {
        success: false,
        message: "Unable to read database tables",
      },
      500
    );
  }
});

/*
 * API routes
 */
app.route("/api/auth", auth);
app.route("/api/students", students);
app.route("/api/practicals", practicals);
app.route("/api/submissions", submissions);
app.route("/api/dashboard", dashboard);
app.route("/api/exports", exportsRoute);
app.route("/api/ocr", ocr);

/*
 * IMPORTANT:
 * Do NOT register /api/assistant here yet.
 * The current reset script added that route without
 * ensuring the assistant route module exists correctly.
 */

export default app;