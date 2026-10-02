import { Hono } from "hono";
import * as XLSX from "xlsx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { requireAuth } from "../middleware/auth";
import { success, failure } from "../lib/response";

const exportsRoute = new Hono<{
  Bindings: {
    DB: D1Database;
  };
  Variables: {
    teacher: {
      id: string;
      email: string;
      name: string;
    };
  };
}>();

exportsRoute.use("*", requireAuth);

/**
 * GET /api/exports/students/excel
 *
 * Export all students to Excel.
 */
exportsRoute.get("/students/excel", async (c) => {
  try {
    const students = await c.env.DB
      .prepare(`
        SELECT
          roll_number AS "Roll Number",
          name AS "Student Name"
        FROM students
        ORDER BY roll_number ASC
      `)
      .all<{
        "Roll Number": string;
        "Student Name": string;
      }>();

    const worksheet = XLSX.utils.json_to_sheet(
      students.results
    );

    worksheet["!cols"] = [
      { wch: 15 },
      { wch: 30 },
    ];

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Students"
    );

    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    return new Response(
      new Uint8Array(buffer),
      {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition":
            'attachment; filename="dbms-students.xlsx"',
        },
      }
    );
  } catch (error) {
    console.error(
      "Student Excel export failed:",
      error
    );

    return c.json(
      failure("Unable to export students"),
      500
    );
  }
});

/**
 * GET /api/exports/submissions/excel?practicalId=...
 *
 * Export submission status for one practical.
 */
exportsRoute.get(
  "/submissions/excel",
  async (c) => {
    const practicalId =
      c.req.query("practicalId");

    if (!practicalId) {
      return c.json(
        failure(
          "practicalId query parameter is required"
        ),
        400
      );
    }

    try {
      const practical =
        await c.env.DB
          .prepare(`
            SELECT
              id,
              practical_number,
              title
            FROM practicals
            WHERE id = ?
          `)
          .bind(practicalId)
          .first<{
            id: string;
            practical_number: number;
            title: string;
          }>();

      if (!practical) {
        return c.json(
          failure("Practical not found"),
          404
        );
      }

      const students =
        await c.env.DB
          .prepare(`
            SELECT
              s.roll_number AS "Roll Number",
              s.name AS "Student Name",
              CASE
                WHEN sub.submitted = 1
                THEN 'Submitted'
                ELSE 'Pending'
              END AS "Status",
              sub.submitted_at AS "Submitted At"
            FROM students s
            LEFT JOIN submissions sub
              ON sub.student_id = s.id
              AND sub.practical_id = ?
            ORDER BY s.roll_number ASC
          `)
          .bind(practicalId)
          .all<{
            "Roll Number": string;
            "Student Name": string;
            Status: string;
            "Submitted At": string | null;
          }>();

      const worksheet =
        XLSX.utils.json_to_sheet(
          students.results
        );

      worksheet["!cols"] = [
        { wch: 15 },
        { wch: 30 },
        { wch: 15 },
        { wch: 25 },
      ];

      const workbook =
        XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Submissions"
      );

      const buffer = XLSX.write(
        workbook,
        {
          type: "buffer",
          bookType: "xlsx",
        }
      );

      const safeTitle =
        practical.title
          .replace(/[^a-zA-Z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .toLowerCase();

      return new Response(
        new Uint8Array(buffer),
        {
          status: 200,
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="practical-${practical.practical_number}-${safeTitle}.xlsx"`,
          },
        }
      );
    } catch (error) {
      console.error(
        "Submission Excel export failed:",
        error
      );

      return c.json(
        failure(
          "Unable to export submissions"
        ),
        500
      );
    }
  }
);

/**
 * GET /api/exports/report/pdf?practicalId=...
 *
 * Generate a printable PDF report for one practical.
 */
exportsRoute.get(
  "/report/pdf",
  async (c) => {
    const practicalId =
      c.req.query("practicalId");

    if (!practicalId) {
      return c.json(
        failure(
          "practicalId query parameter is required"
        ),
        400
      );
    }

    try {
      /**
       * Get practical information.
       */
      const practical =
        await c.env.DB
          .prepare(`
            SELECT
              id,
              practical_number,
              title,
              description
            FROM practicals
            WHERE id = ?
          `)
          .bind(practicalId)
          .first<{
            id: string;
            practical_number: number;
            title: string;
            description: string | null;
          }>();

      if (!practical) {
        return c.json(
          failure("Practical not found"),
          404
        );
      }

      /**
       * Get students + submission status.
       */
      const students =
        await c.env.DB
          .prepare(`
            SELECT
              s.roll_number,
              s.name,
              CASE
                WHEN sub.submitted = 1
                THEN 1
                ELSE 0
              END AS submitted,
              sub.submitted_at
            FROM students s
            LEFT JOIN submissions sub
              ON sub.student_id = s.id
              AND sub.practical_id = ?
            ORDER BY s.roll_number ASC
          `)
          .bind(practicalId)
          .all<{
            roll_number: string;
            name: string;
            submitted: number;
            submitted_at: string | null;
          }>();

      const totalStudents =
        students.results.length;

      const submittedCount =
        students.results.filter(
          (student) =>
            student.submitted === 1
        ).length;

      const pendingCount =
        totalStudents - submittedCount;

      const progress =
        totalStudents > 0
          ? Number(
              (
                (submittedCount /
                  totalStudents) *
                100
              ).toFixed(1)
            )
          : 0;

      /**
       * Create PDF.
       */
      const pdfDoc =
        await PDFDocument.create();

      const regularFont =
        await pdfDoc.embedFont(
          StandardFonts.Helvetica
        );

      const boldFont =
        await pdfDoc.embedFont(
          StandardFonts.HelveticaBold
        );

      let page =
        pdfDoc.addPage([595.28, 841.89]);

      const pageWidth =
        page.getWidth();

      const pageHeight =
        page.getHeight();

      const margin = 40;

      let y = pageHeight - margin;

      /**
       * Helper: create new page.
       */
      const addPage = () => {
        page =
          pdfDoc.addPage([
            595.28,
            841.89,
          ]);

        y = page.getHeight() - margin;
      };

      /**
       * Helper: draw text.
       */
      const drawText = (
        text: string,
        x: number,
        size: number,
        font = regularFont
      ) => {
        page.drawText(text, {
          x,
          y,
          size,
          font,
          color: rgb(0.12, 0.12, 0.12),
        });
      };

      /**
       * Header.
       */
      drawText(
        "DBMS PRACTICAL TRACKER",
        margin,
        20,
        boldFont
      );

      y -= 30;

      drawText(
        `Practical ${practical.practical_number}: ${practical.title}`,
        margin,
        15,
        boldFont
      );

      y -= 22;

      if (practical.description) {
        drawText(
          practical.description,
          margin,
          10
        );

        y -= 18;
      }

      /**
       * Report date.
       */
      drawText(
        `Generated: ${new Date().toLocaleString(
          "en-IN"
        )}`,
        margin,
        9
      );

      y -= 30;

      /**
       * Summary.
       */
      drawText(
        "Submission Summary",
        margin,
        13,
        boldFont
      );

      y -= 22;

      drawText(
        `Total Students: ${totalStudents}`,
        margin,
        10
      );

      y -= 16;

      drawText(
        `Submitted: ${submittedCount}`,
        margin,
        10
      );

      y -= 16;

      drawText(
        `Pending: ${pendingCount}`,
        margin,
        10
      );

      y -= 16;

      drawText(
        `Progress: ${progress}%`,
        margin,
        10,
        boldFont
      );

      y -= 30;

      /**
       * Table.
       */
      drawText(
        "Student Submission Details",
        margin,
        13,
        boldFont
      );

      y -= 25;

      const tableX = margin;
      const rollX = tableX;
      const nameX = tableX + 75;
      const statusX = tableX + 330;
      const dateX = tableX + 420;

      drawText(
        "Roll No.",
        rollX,
        9,
        boldFont
      );

      drawText(
        "Student Name",
        nameX,
        9,
        boldFont
      );

      drawText(
        "Status",
        statusX,
        9,
        boldFont
      );

      drawText(
        "Submitted At",
        dateX,
        9,
        boldFont
      );

      y -= 18;

      page.drawLine({
        start: {
          x: margin,
          y,
        },
        end: {
          x: pageWidth - margin,
          y,
        },
        thickness: 1,
        color: rgb(
          0.5,
          0.5,
          0.5
        ),
      });

      y -= 15;

      /**
       * Student rows.
       */
      for (const student of students.results) {
        if (y < 45) {
          addPage();

          drawText(
            "Student Submission Details",
            margin,
            13,
            boldFont
          );

          y -= 25;

          drawText(
            "Roll No.",
            rollX,
            9,
            boldFont
          );

          drawText(
            "Student Name",
            nameX,
            9,
            boldFont
          );

          drawText(
            "Status",
            statusX,
            9,
            boldFont
          );

          drawText(
            "Submitted At",
            dateX,
            9,
            boldFont
          );

          y -= 25;
        }

        drawText(
          student.roll_number,
          rollX,
          8
        );

        drawText(
          student.name.slice(0, 35),
          nameX,
          8
        );

        drawText(
          student.submitted === 1
            ? "Submitted"
            : "Pending",
          statusX,
          8,
          student.submitted === 1
            ? boldFont
            : regularFont
        );

        const submittedDate =
          student.submitted_at
            ? new Date(
                student.submitted_at
              ).toLocaleString("en-IN")
            : "-";

        drawText(
          submittedDate.slice(0, 22),
          dateX,
          7
        );

        y -= 18;
      }

      /**
       * Footer on the final page.
       */
      y = 30;

      page.drawText(
        "Generated by DBMS Practical Tracker",
        {
          x: margin,
          y,
          size: 8,
          font: regularFont,
          color: rgb(
            0.45,
            0.45,
            0.45
          ),
        }
      );

      const pdfBytes =
        await pdfDoc.save();

      const safeTitle =
        practical.title
          .replace(/[^a-zA-Z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .toLowerCase();

      return new Response(
        pdfBytes,
        {
          status: 200,
          headers: {
            "Content-Type":
              "application/pdf",
            "Content-Disposition": `attachment; filename="practical-${practical.practical_number}-${safeTitle}.pdf"`,
          },
        }
      );
    } catch (error) {
      console.error(
        "PDF report generation failed:",
        error
      );

      return c.json(
        failure(
          "Unable to generate PDF report"
        ),
        500
      );
    }
  }
);

export default exportsRoute;