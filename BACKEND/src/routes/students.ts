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

const students = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

students.use("*", requireAuth);

/**
 * GET /api/students
 *
 * Returns all imported students.
 */
students.get("/", async (c) => {
  try {
    const result = await c.env.DB
      .prepare(`
        SELECT
          id,
          student_list_id,
          roll_number,
          name,
          created_at
        FROM students
        ORDER BY
          CAST(roll_number AS INTEGER),
          name COLLATE NOCASE
      `)
      .all();

    return c.json(
      success(result.results)
    );
  } catch (error) {
    console.error(
      "Failed to fetch students:",
      error
    );

    return c.json(
      failure(
        "Unable to fetch students"
      ),
      500
    );
  }
});

/**
 * GET /api/students/:id
 *
 * Returns one student.
 */
students.get("/:id", async (c) => {
  const studentId = c.req.param("id");

  try {
    const student = await c.env.DB
      .prepare(`
        SELECT
          id,
          student_list_id,
          roll_number,
          name,
          created_at
        FROM students
        WHERE id = ?
      `)
      .bind(studentId)
      .first();

    if (!student) {
      return c.json(
        failure("Student not found"),
        404
      );
    }

    return c.json(
      success(student)
    );
  } catch (error) {
    console.error(
      "Failed to fetch student:",
      error
    );

    return c.json(
      failure(
        "Unable to fetch student"
      ),
      500
    );
  }
});

/**
 * POST /api/students/import
 *
 * Imports a confirmed student list.
 *
 * The frontend/OCR layer is responsible for
 * extracting the student data first.
 *
 * This endpoint only stores confirmed data.
 */
students.post("/import", async (c) => {
  try {
    const body = await c.req.json<{
      sourceFileName?: string;
      sourceFileUrl?: string;
      students?: Array<{
        rollNumber?: string;
        name?: string;
      }>;
    }>();

    if (
      !body.students ||
      !Array.isArray(body.students) ||
      body.students.length === 0
    ) {
      return c.json(
        failure(
          "students must be a non-empty array"
        ),
        400
      );
    }

    if (body.students.length > 500) {
      return c.json(
        failure(
          "A maximum of 500 students can be imported at once"
        ),
        400
      );
    }

    const cleanedStudents =
      body.students.map(
        (student, index) => ({
          index: index + 1,
          rollNumber:
            typeof student.rollNumber === "string"
              ? student.rollNumber.trim()
              : "",
          name:
            typeof student.name === "string"
              ? student.name.trim()
              : "",
        })
      );

    const invalidStudent =
      cleanedStudents.find(
        (student) =>
          !student.rollNumber ||
          !student.name
      );

    if (invalidStudent) {
      return c.json(
        failure(
          `Student ${invalidStudent.index} must have both rollNumber and name`
        ),
        400
      );
    }

    const duplicateRollNumbers =
      new Set<string>();

    for (const student of cleanedStudents) {
      const normalizedRoll =
        student.rollNumber.toLowerCase();

      if (
        duplicateRollNumbers.has(
          normalizedRoll
        )
      ) {
        return c.json(
          failure(
            `Duplicate roll number found: ${student.rollNumber}`
          ),
          400
        );
      }

      duplicateRollNumbers.add(
        normalizedRoll
      );
    }

    const teacher = c.get("teacher");

    const studentListId =
      crypto.randomUUID();

    const sourceFileName =
      typeof body.sourceFileName === "string" &&
      body.sourceFileName.trim()
        ? body.sourceFileName.trim()
        : "student-list-import";

    const sourceFileUrl =
      typeof body.sourceFileUrl === "string" &&
      body.sourceFileUrl.trim()
        ? body.sourceFileUrl.trim()
        : null;

    const statements: D1PreparedStatement[] =
      [];

    statements.push(
      c.env.DB
        .prepare(`
          INSERT INTO student_lists (
            id,
            source_file_name,
            source_file_url,
            uploaded_by
          )
          VALUES (?, ?, ?, ?)
        `)
        .bind(
          studentListId,
          sourceFileName,
          sourceFileUrl,
          teacher.id
        )
    );

    for (const student of cleanedStudents) {
      statements.push(
        c.env.DB
          .prepare(`
            INSERT INTO students (
              id,
              student_list_id,
              roll_number,
              name
            )
            VALUES (?, ?, ?, ?)
          `)
          .bind(
            crypto.randomUUID(),
            studentListId,
            student.rollNumber,
            student.name
          )
      );
    }

    await c.env.DB.batch(
      statements
    );

    return c.json(
      success({
        studentListId,
        importedCount:
          cleanedStudents.length,
        sourceFileName,
        importedBy: {
          id: teacher.id,
          email: teacher.email,
          name: teacher.name,
        },
      }),
      201
    );
  } catch (error) {
    console.error(
      "Failed to import students:",
      error
    );

    return c.json(
      failure(
        "Unable to import students",
        error instanceof Error
          ? error.message
          : String(error)
      ),
      500
    );
  }
});

export default students;
