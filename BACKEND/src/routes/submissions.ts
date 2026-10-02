import { Hono } from "hono";

import type { AppEnv } from "../types/env";
import {
  requireAuth,
  type AuthVariables,
} from "../middleware/auth";

const submissions = new Hono<{
  Bindings: AppEnv["Bindings"];
  Variables: AuthVariables;
}>();

submissions.use("*", requireAuth);

/*
|--------------------------------------------------------------------------
| GET /api/submissions
|--------------------------------------------------------------------------
| Get all students and their submission status for one practical.
|--------------------------------------------------------------------------
*/

submissions.get("/", async (c) => {
  const practicalId = c.req.query("practicalId");

  if (!practicalId) {
    return c.json(
      {
        success: false,
        message: "practicalId is required",
      },
      400
    );
  }

  try {
    const practical = await c.env.DB
      .prepare(`
        SELECT
          id,
          practical_number,
          title,
          description,
          is_active
        FROM practicals
        WHERE id = ?
      `)
      .bind(practicalId)
      .first<{
        id: string;
        practical_number: number;
        title: string;
        description: string | null;
        is_active: number;
      }>();

    if (!practical) {
      return c.json(
        {
          success: false,
          message: "Practical not found",
        },
        404
      );
    }

    const result = await c.env.DB
      .prepare(`
        SELECT
          s.id AS student_id,
          s.roll_number,
          s.name,
          COALESCE(sub.submitted, 0) AS submitted,
          sub.submitted_at,
          sub.updated_at
        FROM students s
        LEFT JOIN submissions sub
          ON sub.student_id = s.id
          AND sub.practical_id = ?
        ORDER BY
          CAST(s.roll_number AS INTEGER),
          s.roll_number,
          s.name
      `)
      .bind(practicalId)
      .all<{
        student_id: string;
        roll_number: string;
        name: string;
        submitted: number;
        submitted_at: string | null;
        updated_at: string | null;
      }>();

    const students = result.results.map((student) => ({
      studentId: student.student_id,
      rollNumber: student.roll_number,
      name: student.name,
      submitted: student.submitted === 1,
      submittedAt: student.submitted_at,
      updatedAt: student.updated_at,
    }));

    const submittedCount = students.filter(
      (student) => student.submitted
    ).length;

    return c.json({
      success: true,
      practical,
      summary: {
        totalStudents: students.length,
        submitted: submittedCount,
        pending: students.length - submittedCount,
      },
      students,
    });
  } catch (error) {
    console.error(
      "Failed to fetch submissions:",
      error
    );

    return c.json(
      {
        success: false,
        message: "Unable to fetch submissions",
      },
      500
    );
  }
});

/*
|--------------------------------------------------------------------------
| GET /api/submissions/pending
|--------------------------------------------------------------------------
| Get only students who have not submitted.
|--------------------------------------------------------------------------
*/

submissions.get("/pending", async (c) => {
  const practicalId = c.req.query("practicalId");

  if (!practicalId) {
    return c.json(
      {
        success: false,
        message: "practicalId is required",
      },
      400
    );
  }

  try {
    const practical = await c.env.DB
      .prepare(`
        SELECT id
        FROM practicals
        WHERE id = ?
      `)
      .bind(practicalId)
      .first<{ id: string }>();

    if (!practical) {
      return c.json(
        {
          success: false,
          message: "Practical not found",
        },
        404
      );
    }

    const result = await c.env.DB
      .prepare(`
        SELECT
          s.id AS student_id,
          s.roll_number,
          s.name
        FROM students s
        LEFT JOIN submissions sub
          ON sub.student_id = s.id
          AND sub.practical_id = ?
        WHERE COALESCE(sub.submitted, 0) = 0
        ORDER BY
          CAST(s.roll_number AS INTEGER),
          s.roll_number,
          s.name
      `)
      .bind(practicalId)
      .all<{
        student_id: string;
        roll_number: string;
        name: string;
      }>();

    return c.json({
      success: true,
      practicalId,
      count: result.results.length,
      students: result.results.map((student) => ({
        studentId: student.student_id,
        rollNumber: student.roll_number,
        name: student.name,
      })),
    });
  } catch (error) {
    console.error(
      "Failed to fetch pending submissions:",
      error
    );

    return c.json(
      {
        success: false,
        message: "Unable to fetch pending submissions",
      },
      500
    );
  }
});

/*
|--------------------------------------------------------------------------
| POST /api/submissions/apply
|--------------------------------------------------------------------------
| Apply multiple submission changes in one operation.
|--------------------------------------------------------------------------
*/

submissions.post("/apply", async (c) => {
  const teacher = c.get("teacher");

  try {
    const body = await c.req.json<{
      practicalId?: string;
      changes?: Array<{
        studentId?: string;
        submitted?: boolean;
      }>;
    }>();

    if (!body.practicalId) {
      return c.json(
        {
          success: false,
          message: "practicalId is required",
        },
        400
      );
    }

    if (!Array.isArray(body.changes)) {
      return c.json(
        {
          success: false,
          message: "changes must be an array",
        },
        400
      );
    }

    if (body.changes.length === 0) {
      return c.json({
        success: true,
        message: "No changes to apply",
        updated: 0,
      });
    }

    if (body.changes.length > 500) {
      return c.json(
        {
          success: false,
          message:
            "Maximum 500 changes can be applied at once",
        },
        400
      );
    }

    const practical = await c.env.DB
      .prepare(`
        SELECT id
        FROM practicals
        WHERE id = ?
      `)
      .bind(body.practicalId)
      .first<{ id: string }>();

    if (!practical) {
      return c.json(
        {
          success: false,
          message: "Practical not found",
        },
        404
      );
    }

    for (const change of body.changes) {
      if (
        typeof change.studentId !== "string" ||
        change.studentId.trim().length === 0
      ) {
        return c.json(
          {
            success: false,
            message:
              "Every change must contain a valid studentId",
          },
          400
        );
      }

      if (typeof change.submitted !== "boolean") {
        return c.json(
          {
            success: false,
            message:
              "Every change must contain submitted as true or false",
          },
          400
        );
      }
    }

    const uniqueStudentIds = [
      ...new Set(
        body.changes.map(
          (change) => change.studentId!
        )
      ),
    ];

    const placeholders = uniqueStudentIds
      .map(() => "?")
      .join(",");

    const existingStudents = await c.env.DB
      .prepare(`
        SELECT id
        FROM students
        WHERE id IN (${placeholders})
      `)
      .bind(...uniqueStudentIds)
      .all<{ id: string }>();

    const existingIds = new Set(
      existingStudents.results.map(
        (student) => student.id
      )
    );

    const invalidStudentIds =
      uniqueStudentIds.filter(
        (studentId) =>
          !existingIds.has(studentId)
      );

    if (invalidStudentIds.length > 0) {
      return c.json(
        {
          success: false,
          message: "One or more students do not exist",
          invalidStudentIds,
        },
        400
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Read current values.
    |--------------------------------------------------------------------------
    */

    const oldValues = new Map<
      string,
      boolean
    >();

    for (const studentId of uniqueStudentIds) {
      const existing = await c.env.DB
        .prepare(`
          SELECT submitted
          FROM submissions
          WHERE student_id = ?
            AND practical_id = ?
        `)
        .bind(
          studentId,
          body.practicalId
        )
        .first<{
          submitted: number;
        }>();

      oldValues.set(
        studentId,
        existing?.submitted === 1
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Build database operations.
    |--------------------------------------------------------------------------
    */

    const statements: D1PreparedStatement[] = [];

    for (const change of body.changes) {
      const studentId = change.studentId!;
      const submitted = change.submitted!;

      const submittedAt = submitted
        ? new Date().toISOString()
        : null;

      statements.push(
        c.env.DB
          .prepare(`
            INSERT INTO submissions (
              id,
              student_id,
              practical_id,
              submitted,
              submitted_at,
              updated_at
            )
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(student_id, practical_id)
            DO UPDATE SET
              submitted = excluded.submitted,
              submitted_at = excluded.submitted_at,
              updated_at = CURRENT_TIMESTAMP
          `)
          .bind(
            crypto.randomUUID(),
            studentId,
            body.practicalId,
            submitted ? 1 : 0,
            submittedAt
          )
      );

      const oldValue =
        oldValues.get(studentId) ?? false;

      if (oldValue !== submitted) {
        statements.push(
          c.env.DB
            .prepare(`
              INSERT INTO audit_logs (
                id,
                teacher_id,
                practical_id,
                student_id,
                action,
                old_value,
                new_value
              )
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `)
            .bind(
              crypto.randomUUID(),
              teacher.id,
              body.practicalId,
              studentId,
              "SUBMISSION_STATUS_CHANGED",
              oldValue
                ? "submitted"
                : "pending",
              submitted
                ? "submitted"
                : "pending"
            )
        );
      }
    }

    /*
    |--------------------------------------------------------------------------
    | Apply everything together.
    |--------------------------------------------------------------------------
    */

    await c.env.DB.batch(statements);

    return c.json({
      success: true,
      message:
        "Submission changes applied successfully",
      updated: body.changes.length,
    });
  } catch (error) {
    console.error(
      "Failed to apply submission changes:",
      error
    );

    return c.json(
      {
        success: false,
        message:
          "Unable to apply submission changes",
      },
      500
    );
  }
});

/*
|--------------------------------------------------------------------------
| GET /api/submissions/history
|--------------------------------------------------------------------------
| Returns audit trail of submission changes.
|--------------------------------------------------------------------------
*/

submissions.get("/history", async (c) => {
  try {
    const result = await c.env.DB
      .prepare(`
        SELECT
          a.id,
          a.action,
          a.old_value,
          a.new_value,
          a.created_at,
          s.name AS student_name,
          s.roll_number,
          p.practical_number
        FROM audit_logs a
        LEFT JOIN students s
          ON s.id = a.student_id
        LEFT JOIN practicals p
          ON p.id = a.practical_id
        ORDER BY a.created_at DESC
        LIMIT 200
      `)
      .all<{
        id: string;
        action: string;
        old_value: string | null;
        new_value: string | null;
        created_at: string;
        student_name: string | null;
        roll_number: string | null;
        practical_number: number | null;
      }>();

    const items = result.results.map((row) => ({
      id: row.id,
      action: row.action,
      oldValue: row.old_value,
      newValue: row.new_value,
      createdAt: row.created_at,
      studentName: row.student_name,
      rollNumber: row.roll_number,
      practicalNumber: row.practical_number,
    }));

    return c.json({
      success: true,
      data: items,
    });
  } catch (error) {
    console.error(
      "Failed to fetch submission history:",
      error
    );

    return c.json(
      {
        success: false,
        message:
          "Unable to fetch submission history",
      },
      500
    );
  }
});

export default submissions;
