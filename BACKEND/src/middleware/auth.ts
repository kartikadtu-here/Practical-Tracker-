import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../types/env";

import {
  extractSessionToken,
  hashSessionToken,
} from "../lib/auth";

export type AuthVariables = {
  teacher: {
    id: string;
    email: string;
    name: string;
  };
};

export const requireAuth: MiddlewareHandler<{
  Bindings: AppEnv["Bindings"];
  Variables: AuthVariables;
}> = async (c, next) => {
  const token = extractSessionToken(
    c.req.header("Cookie")
  );

  if (!token) {
    return c.json(
      {
        success: false,
        message: "Authentication required",
      },
      401
    );
  }

  try {
    const tokenHash =
      await hashSessionToken(token);

    const session =
      await c.env.DB
        .prepare(`
          SELECT
            s.id AS session_id,
            s.teacher_id,
            s.expires_at,
            t.email,
            t.name
          FROM sessions s
          INNER JOIN teachers t
            ON t.id = s.teacher_id
          WHERE s.token_hash = ?
            AND s.expires_at > CURRENT_TIMESTAMP
        `)
        .bind(tokenHash)
        .first<{
          session_id: string;
          teacher_id: string;
          expires_at: string;
          email: string;
          name: string;
        }>();

    if (!session) {
      return c.json(
        {
          success: false,
          message: "Invalid or expired session",
        },
        401
      );
    }

    c.set("teacher", {
      id: session.teacher_id,
      email: session.email,
      name: session.name,
    });

    await next();
  } catch (error) {
    console.error(
      "Authentication middleware error:",
      error
    );

    return c.json(
      {
        success: false,
        message: "Authentication failed",
      },
      500
    );
  }
};
