import { Hono } from "hono";

import { requireAuth } from "../middleware/auth";
import { success, failure } from "../lib/response";

type Bindings = {
  DB: D1Database;
};

type Variables = {
  teacher: {
    id: string;
    email: string;
    name: string;
  };
};

const practicals = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

practicals.use("*", requireAuth);

/**
 * GET /api/practicals
 */
practicals.get("/", async (c) => {
  try {
    const result = await c.env.DB
      .prepare(`
        SELECT
          id,
          practical_number,
          title,
          description,
          is_active,
          created_at,
          updated_at
        FROM practicals
        ORDER BY practical_number ASC
      `)
      .all();

    return c.json(success(result.results));
  } catch (error) {
    console.error("Failed to fetch practicals:", error);

    return c.json(
      failure(
        "Unable to fetch practicals",
        error instanceof Error
          ? error.message
          : String(error)
      ),
      500
    );
  }
});

/**
 * POST /api/practicals
 */
practicals.post("/", async (c) => {
  try {
    const body = await c.req.json<{
      practicalNumber?: number;
      title?: string;
      description?: string;
    }>();

    console.log("Create practical request:", body);

    if (
      !Number.isInteger(body.practicalNumber) ||
      body.practicalNumber! <= 0
    ) {
      return c.json(
        failure(
          "practicalNumber must be a positive integer"
        ),
        400
      );
    }

    if (
      !body.title ||
      body.title.trim().length === 0
    ) {
      return c.json(
        failure("title is required"),
        400
      );
    }

    const id = crypto.randomUUID();

    console.log("Creating practical with ID:", id);

    const insertResult = await c.env.DB
      .prepare(`
        INSERT INTO practicals (
          id,
          practical_number,
          title,
          description
        )
        VALUES (?, ?, ?, ?)
      `)
      .bind(
        id,
        body.practicalNumber,
        body.title.trim(),
        body.description?.trim() || null
      )
      .run();

    console.log(
      "Practical insert result:",
      insertResult
    );

    const practical = await c.env.DB
      .prepare(`
        SELECT
          id,
          practical_number,
          title,
          description,
          is_active,
          created_at,
          updated_at
        FROM practicals
        WHERE id = ?
      `)
      .bind(id)
      .first();

    return c.json(success(practical), 201);
  } catch (error) {
    console.error(
      "FAILED TO CREATE PRACTICAL:",
      error
    );

    return c.json(
      failure(
        "Unable to create practical",
        error instanceof Error
          ? error.message
          : String(error)
      ),
      500
    );
  }
});

/**
 * PATCH /api/practicals/:id
 */
practicals.patch("/:id", async (c) => {
  const id = c.req.param("id");

  try {
    const body = await c.req.json<{
      practicalNumber?: number;
      title?: string;
      description?: string | null;
      isActive?: boolean;
    }>();

    const existing = await c.env.DB
      .prepare(`
        SELECT id
        FROM practicals
        WHERE id = ?
      `)
      .bind(id)
      .first();

    if (!existing) {
      return c.json(
        failure("Practical not found"),
        404
      );
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    if (body.practicalNumber !== undefined) {
      if (
        !Number.isInteger(body.practicalNumber) ||
        body.practicalNumber <= 0
      ) {
        return c.json(
          failure(
            "practicalNumber must be a positive integer"
          ),
          400
        );
      }

      updates.push("practical_number = ?");
      values.push(body.practicalNumber);
    }

    if (body.title !== undefined) {
      if (body.title.trim().length === 0) {
        return c.json(
          failure("title cannot be empty"),
          400
        );
      }

      updates.push("title = ?");
      values.push(body.title.trim());
    }

    if (body.description !== undefined) {
      updates.push("description = ?");
      values.push(
        body.description?.trim() || null
      );
    }

    if (body.isActive !== undefined) {
      updates.push("is_active = ?");
      values.push(body.isActive ? 1 : 0);
    }

    if (updates.length === 0) {
      return c.json(
        failure("No changes provided"),
        400
      );
    }

    updates.push(
      "updated_at = CURRENT_TIMESTAMP"
    );

    await c.env.DB
      .prepare(`
        UPDATE practicals
        SET ${updates.join(", ")}
        WHERE id = ?
      `)
      .bind(...values, id)
      .run();

    const updated = await c.env.DB
      .prepare(`
        SELECT
          id,
          practical_number,
          title,
          description,
          is_active,
          created_at,
          updated_at
        FROM practicals
        WHERE id = ?
      `)
      .bind(id)
      .first();

    return c.json(success(updated));
  } catch (error) {
    console.error(
      "Failed to update practical:",
      error
    );

    return c.json(
      failure(
        "Unable to update practical",
        error instanceof Error
          ? error.message
          : String(error)
      ),
      500
    );
  }
});

/**
 * DELETE /api/practicals/:id
 */
practicals.delete("/:id", async (c) => {
  const id = c.req.param("id");

  try {
    const existing = await c.env.DB
      .prepare(`
        SELECT id
        FROM practicals
        WHERE id = ?
      `)
      .bind(id)
      .first();

    if (!existing) {
      return c.json(
        failure("Practical not found"),
        404
      );
    }

    await c.env.DB
      .prepare(`
        DELETE FROM practicals
        WHERE id = ?
      `)
      .bind(id)
      .run();

    return c.json(
      success({
        deleted: true,
        id,
      })
    );
  } catch (error) {
    console.error(
      "Failed to delete practical:",
      error
    );

    return c.json(
      failure(
        "Unable to delete practical",
        error instanceof Error
          ? error.message
          : String(error)
      ),
      500
    );
  }
});

export default practicals;
