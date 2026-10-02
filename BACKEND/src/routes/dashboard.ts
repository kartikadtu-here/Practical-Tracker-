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

const dashboard = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

dashboard.use("*", requireAuth);

/**
 * GET /api/dashboard/summary
 *
 * Returns the complete dashboard summary.
 *
 * Progress is calculated from:
 *
 * total students × active practicals
 *
 * rather than only existing submission rows.
 */
dashboard.get("/summary", async (c) => {
  try {
    const studentCount = await c.env.DB
      .prepare(`
        SELECT COUNT(*) AS count
        FROM students
      `)
      .first<{ count: number }>();

    const practicalCount = await c.env.DB
      .prepare(`
        SELECT COUNT(*) AS count
        FROM practicals
        WHERE is_active = 1
      `)
      .first<{ count: number }>();

    const activePractical = await c.env.DB
      .prepare(`
        SELECT
          id,
          practical_number,
          title,
          description,
          is_active
        FROM practicals
        WHERE is_active = 1
        ORDER BY practical_number DESC
        LIMIT 1
      `)
      .first<{
        id: string;
        practical_number: number;
        title: string;
        description: string | null;
        is_active: number;
      }>();

    const practicalProgress = await c.env.DB
      .prepare(`
        SELECT
          p.id,
          p.practical_number,
          p.title,
          p.description,
          COUNT(s.id) AS submitted,
          (
            SELECT COUNT(*)
            FROM students
          ) AS total_students
        FROM practicals p
        LEFT JOIN submissions s
          ON s.practical_id = p.id
          AND s.submitted = 1
        WHERE p.is_active = 1
        GROUP BY
          p.id,
          p.practical_number,
          p.title,
          p.description
        ORDER BY p.practical_number ASC
      `)
      .all<{
        id: string;
        practical_number: number;
        title: string;
        description: string | null;
        submitted: number;
        total_students: number;
      }>();

    const totalStudents =
      Number(studentCount?.count ?? 0);

    const totalPracticals =
      Number(practicalCount?.count ?? 0);

    const totalPossibleSubmissions =
      totalStudents * totalPracticals;

    const totalSubmitted =
      practicalProgress.results.reduce(
        (sum, practical) =>
          sum + Number(practical.submitted ?? 0),
        0
      );

    const totalPending =
      Math.max(
        totalPossibleSubmissions -
          totalSubmitted,
        0
      );

    const overallProgress =
      totalPossibleSubmissions > 0
        ? Number(
            (
              (totalSubmitted /
                totalPossibleSubmissions) *
              100
            ).toFixed(1)
          )
        : 0;

    const practicals =
      practicalProgress.results.map(
        (practical) => {
          const submitted =
            Number(practical.submitted ?? 0);

          const pending =
            Math.max(
              Number(
                practical.total_students ?? 0
              ) - submitted,
              0
            );

          const progress =
            totalStudents > 0
              ? Number(
                  (
                    (submitted /
                      totalStudents) *
                    100
                  ).toFixed(1)
                )
              : 0;

          return {
            id: practical.id,
            practicalNumber:
              practical.practical_number,
            title: practical.title,
            description:
              practical.description,
            submitted,
            pending,
            totalStudents,
            progress,
          };
        }
      );

    return c.json(
      success({
        students: {
          total: totalStudents,
        },

        practicals: {
          total: totalPracticals,
        },

        activePractical:
          activePractical
            ? {
                id: activePractical.id,
                practicalNumber:
                  activePractical.practical_number,
                title:
                  activePractical.title,
                description:
                  activePractical.description,
                isActive:
                  activePractical.is_active === 1,
              }
            : null,

        submissions: {
          totalPossible:
            totalPossibleSubmissions,
          submitted: totalSubmitted,
          pending: totalPending,
          progress: overallProgress,
        },

        practicalProgress: practicals,
      })
    );
  } catch (error) {
    console.error(
      "Failed to fetch dashboard summary:",
      error
    );

    return c.json(
      failure(
        "Unable to fetch dashboard summary"
      ),
      500
    );
  }
});

export default dashboard;
