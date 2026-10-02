import { Hono } from "hono";

import { requireAuth } from "../middleware/auth";
import { failure, success } from "../lib/response";

const ocr = new Hono<{
  Bindings: {
    DB: D1Database;
    AI: Ai;
  };

  Variables: {
    teacher: {
      id: string;
      email: string;
      name: string;
    };
  };
}>();

ocr.use("*", requireAuth);

const MAX_FILE_SIZE = 8 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type OCRStudent = {
  rollNumber: string;
  name: string;
};

type MoondreamResult = {
  result?: {
    answer?: string;
    caption?: string | null;
    reasoning?: unknown;
    finish_reason?: string;
    metrics?: {
      decode_time_ms?: number;
      input_tokens?: number;
      output_tokens?: number;
      prefill_time_ms?: number;
      ttft_ms?: number;
    };
  };

  usage?: unknown;
};

/**
 * Parse compact OCR output.
 *
 * Example:
 *
 * 01|Rahul Sharma
 * 02|Aman Das
 * 03|Rohan Singh
 */
function parseCompactOCR(
  text: string
): OCRStudent[] {
  const students: OCRStudent[] = [];

  const lines = text
    .replace(/```/g, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const separatorIndex =
      line.indexOf("|");

    if (separatorIndex === -1) {
      continue;
    }

    const rollNumber =
      line
        .slice(0, separatorIndex)
        .trim();

    const name =
      line
        .slice(separatorIndex + 1)
        .trim()
        .replace(/\s+/g, " ");

    if (
      !rollNumber ||
      !name
    ) {
      continue;
    }

    if (
      rollNumber.length > 20 ||
      name.length > 150
    ) {
      continue;
    }

    students.push({
      rollNumber,
      name,
    });
  }

  return students.slice(0, 500);
}

/**
 * JSON fallback.
 *
 * This keeps the endpoint compatible if the model
 * unexpectedly returns JSON instead of compact rows.
 */
function parseJSONFallback(
  text: string
): OCRStudent[] {
  let cleaned =
    text.trim();

  cleaned = cleaned
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: unknown;

  try {
    parsed =
      JSON.parse(cleaned);
  } catch {
    const firstBrace =
      cleaned.indexOf("{");

    const lastBrace =
      cleaned.lastIndexOf("}");

    if (
      firstBrace === -1 ||
      lastBrace === -1 ||
      lastBrace <= firstBrace
    ) {
      return [];
    }

    try {
      parsed =
        JSON.parse(
          cleaned.slice(
            firstBrace,
            lastBrace + 1
          )
        );
    } catch {
      return [];
    }
  }

  if (
    !parsed ||
    typeof parsed !== "object"
  ) {
    return [];
  }

  const rawStudents =
    (
      parsed as {
        students?: unknown;
      }
    ).students;

  if (
    !Array.isArray(
      rawStudents
    )
  ) {
    return [];
  }

  const students:
    OCRStudent[] = [];

  for (
    const item of rawStudents
  ) {
    if (
      !item ||
      typeof item !== "object"
    ) {
      continue;
    }

    const row =
      item as {
        rollNumber?: unknown;
        name?: unknown;
      };

    if (
      typeof row.rollNumber !==
      "string" ||
      typeof row.name !==
      "string"
    ) {
      continue;
    }

    const rollNumber =
      row.rollNumber.trim();

    const name =
      row.name
        .trim()
        .replace(/\s+/g, " ");

    if (
      !rollNumber ||
      !name
    ) {
      continue;
    }

    students.push({
      rollNumber,
      name,
    });
  }

  return students.slice(0, 500);
}

/**
 * Parse model output.
 *
 * Compact format is preferred because it produces
 * much fewer output tokens.
 *
 * JSON remains as a fallback.
 */
function parseOCR(
  answer: string
): OCRStudent[] {
  const compact =
    parseCompactOCR(answer);

  if (
    compact.length > 0
  ) {
    return compact;
  }

  return parseJSONFallback(
    answer
  );
}

/**
 * POST /api/ocr/students
 *
 * Extract students from an uploaded image.
 *
 * IMPORTANT:
 * This endpoint NEVER writes OCR results directly
 * into the students table.
 *
 * Teacher confirmation is required before import.
 */
ocr.post(
  "/students",
  async (c) => {
    const requestStartedAt =
      Date.now();

    try {
      console.log(
        "[OCR] OCR request started"
      );

      // ==================================================
      // 1. Validate image type
      // ==================================================

      const contentType =
        c.req.header(
          "Content-Type"
        ) || "";

      console.log(
        `[OCR] Content-Type: ${contentType}`
      );

      if (
        !ALLOWED_TYPES.has(
          contentType
        )
      ) {
        return c.json(
          failure(
            "Only JPG, PNG, and WebP images are supported"
          ),
          400
        );
      }

      // ==================================================
      // 2. Read image
      // ==================================================

      const body =
        await c.req.arrayBuffer();

      const imageReadTime =
        Date.now() -
        requestStartedAt;

      console.log(
        `[OCR] Image read in ${imageReadTime}ms`
      );

      if (
        body.byteLength === 0
      ) {
        return c.json(
          failure(
            "Image file is empty"
          ),
          400
        );
      }

      if (
        body.byteLength >
        MAX_FILE_SIZE
      ) {
        return c.json(
          failure(
            "Image is too large. Maximum size is 8 MB"
          ),
          400
        );
      }

      console.log(
        `[OCR] Image size: ${(
          body.byteLength /
          1024 /
          1024
        ).toFixed(2)} MB`
      );

      // ==================================================
      // 3. Convert image to base64
      // ==================================================

      const bytes =
        new Uint8Array(body);

      let binary = "";

      const CHUNK_SIZE =
        0x8000;

      for (
        let i = 0;
        i < bytes.length;
        i += CHUNK_SIZE
      ) {
        const chunk =
          bytes.subarray(
            i,
            Math.min(
              i + CHUNK_SIZE,
              bytes.length
            )
          );

        binary +=
          String.fromCharCode(
            ...chunk
          );
      }

      const base64 =
        btoa(binary);

      const imageDataUri =
        `data:${contentType};base64,${base64}`;

      const imagePreparedTime =
        Date.now() -
        requestStartedAt;

      console.log(
        `[OCR] Image prepared in ${imagePreparedTime}ms`
      );

      // ==================================================
      // 4. OCR prompt
      // ==================================================

      const prompt = `
Read the ENTIRE student list in this image.

You MUST scan the image from top to bottom and extract EVERY clearly visible student row.

Return ONLY one student per line in this exact format:

01|Rahul Sharma
02|Aman Das
03|Rohan Singh

Rules:
- Extract ALL visible student rows.
- Do not stop after the first few rows.
- Continue until the entire list has been scanned.
- One student per line.
- Roll number first.
- Then the | character.
- Then the complete student name.
- Keep the original order.
- Preserve roll numbers exactly as visible.
- Preserve names exactly as visible.
- Do not invent students.
- If a row is genuinely unreadable, skip only that row.
- Do not include headings.
- Do not include teachers.
- Do not include dates.
- Do not include phone numbers.
- Do not include email addresses.
- Do not include signatures.
- Do not include explanations.
- Do not return JSON.
- Do not return markdown.

IMPORTANT:
Do not stop early.
Scan the complete image before answering.
`;

      // ==================================================
      // 5. Run Moondream
      // ==================================================

      const aiStartedAt =
        Date.now();

      console.log(
        "[OCR] Starting Moondream..."
      );

      const result =
        (await c.env.AI.run(
          "@cf/moondream/moondream3.1-9B-A2B",
          {
            task: "query",

            image:
              imageDataUri,

            question:
              prompt,

            reasoning:
              false,

            stream:
              false,

            temperature:
              0.1,

            /*
             * 512 is still much smaller than
             * the original 4096, but gives the
             * model enough room for larger lists.
             */
            max_tokens:
              512,
          }
        )) as MoondreamResult;

      const aiFinishedAt =
        Date.now();

      const aiTimeMs =
        aiFinishedAt -
        aiStartedAt;

      console.log(
        `[OCR] Moondream finished in ${aiTimeMs}ms`
      );

      // ==================================================
      // 6. Model metrics
      // ==================================================

      const metrics =
        result?.result?.metrics;

      if (metrics) {
        console.log(
          "[OCR] Model metrics:",
          JSON.stringify(
            metrics
          )
        );
      }

      console.log(
        "[OCR] Finish reason:",
        result?.result
          ?.finish_reason
      );

      // ==================================================
      // 7. Extract model answer
      // ==================================================

      const answer =
        result?.result?.answer;

      if (
        typeof answer !== "string"
      ) {
        console.error(
          "[OCR] Unexpected model response:",
          JSON.stringify(
            result
          )
        );

        return c.json(
          failure(
            "OCR model returned an unexpected response",
            {
              availableFields:
                result &&
                  typeof result ===
                  "object"
                  ? Object.keys(
                    result
                  )
                  : [],

              resultFields:
                result?.result &&
                  typeof result.result ===
                  "object"
                  ? Object.keys(
                    result.result
                  )
                  : [],

              aiTimeMs,

              totalTimeMs:
                Date.now() -
                requestStartedAt,
            }
          ),
          502
        );
      }

      console.log(
        "[OCR] Raw answer:"
      );

      console.log(
        answer
      );

      // ==================================================
      // 8. Parse students
      // ==================================================

      const students =
        parseOCR(answer);

      console.log(
        `[OCR] Parsed ${students.length} students`
      );

      // ==================================================
      // 9. No students found
      // ==================================================

      if (
        students.length === 0
      ) {
        const totalTimeMs =
          Date.now() -
          requestStartedAt;

        console.error(
          "[OCR] No students could be parsed"
        );

        return c.json(
          failure(
            "No students could be extracted from the image",
            {
              rawAnswer:
                answer.slice(
                  0,
                  2000
                ),

              aiTimeMs,

              totalTimeMs,
            }
          ),
          422
        );
      }

      // ==================================================
      // 10. Detect duplicate roll numbers
      // ==================================================

      const seenRollNumbers =
        new Set<string>();

      const duplicateRollNumbers:
        string[] = [];

      for (
        const student of students
      ) {
        if (
          seenRollNumbers.has(
            student.rollNumber
          )
        ) {
          duplicateRollNumbers.push(
            student.rollNumber
          );
        }

        seenRollNumbers.add(
          student.rollNumber
        );
      }

      // ==================================================
      // 11. Final performance
      // ==================================================

      const totalTimeMs =
        Date.now() -
        requestStartedAt;

      console.log(
        `[OCR] Successfully extracted ${students.length} students`
      );

      console.log(
        `[OCR] AI time: ${aiTimeMs}ms`
      );

      console.log(
        `[OCR] Total time: ${totalTimeMs}ms`
      );

      // ==================================================
      // 12. Return result
      // ==================================================

      return c.json(
        success({
          students,

          count:
            students.length,

          duplicateRollNumbers,

          requiresConfirmation:
            true,

          performance: {
            mode:
              "turbo-complete-list",

            model:
              "@cf/moondream/moondream3.1-9B-A2B",

            aiTimeMs,

            totalTimeMs,

            modelMetrics:
              metrics ?? null,
          },
        })
      );
    } catch (error) {
      const totalTimeMs =
        Date.now() -
        requestStartedAt;

      console.error(
        "[OCR] Student OCR failed:",
        error
      );

      console.error(
        `[OCR] Failed after ${totalTimeMs}ms`
      );

      return c.json(
        failure(
          "Unable to process the student list image",
          {
            totalTimeMs,
          }
        ),
        500
      );
    }
  }
);

export default ocr;