import { Hono } from "hono";

import type { AppEnv } from "../types/env";

import {
  createSessionToken,
  getClearSessionCookie,
  getSessionCookie,
  getSessionExpiry,
  hashPassword,
  hashSessionToken,
} from "../lib/auth";

import {
  requireAuth,
  type AuthVariables,
} from "../middleware/auth";

const auth = new Hono<{
  Bindings: AppEnv["Bindings"];
  Variables: AuthVariables;
}>();

auth.post("/login", async (c) => {
  try {
    const body = await c.req.json();

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    if (!email || !password) {
      return c.json(
        {
          success: false,
          message: "Email and password are required",
        },
        400
      );
    }

    console.log("LOGIN STEP 1: looking up teacher");

    const teacher =
      await c.env.DB
        .prepare(`
          SELECT
            id,
            email,
            name,
            password_hash,
            is_admin
          FROM teachers
          WHERE email = ?
        `)
        .bind(email)
        .first<{
          id: string;
          email: string;
          name: string;
          password_hash: string;
          is_admin: number;
        }>();

    if (!teacher) {
      console.log("LOGIN STEP 2: teacher not found");

      return c.json(
        {
          success: false,
          message: "Invalid email or password",
        },
        401
      );
    }

    console.log(
      "LOGIN STEP 2: teacher found:",
      teacher.email
    );

    console.log("LOGIN STEP 3: hashing password");

    const passwordHash =
      await hashPassword(password);

    console.log(
      "LOGIN STEP 3: password hash generated:",
      passwordHash
    );

    if (passwordHash !== teacher.password_hash) {
      console.log("LOGIN STEP 4: password mismatch");

      return c.json(
        {
          success: false,
          message: "Invalid email or password",
        },
        401
      );
    }

    console.log("LOGIN STEP 4: password verified");

    console.log("LOGIN STEP 5: creating session token");

    const sessionToken =
      await createSessionToken();

    const tokenHash =
      await hashSessionToken(sessionToken);

    const expiresAt =
      getSessionExpiry();

    const sessionId =
      crypto.randomUUID();

    console.log(
      "LOGIN STEP 5: session values generated"
    );

    console.log(
      "LOGIN STEP 6: inserting session"
    );

    await c.env.DB
      .prepare(`
        INSERT INTO sessions (
          id,
          teacher_id,
          token_hash,
          expires_at
        )
        VALUES (?, ?, ?, ?)
      `)
      .bind(
        sessionId,
        teacher.id,
        tokenHash,
        expiresAt
      )
      .run();

    console.log(
      "LOGIN STEP 6: session inserted successfully"
    );

    c.header(
      "Set-Cookie",
      getSessionCookie(sessionToken)
    );

    console.log(
      "LOGIN STEP 7: login successful"
    );

    return c.json({
      success: true,
      message: "Login successful",
      teacher: {
        id: teacher.id,
        email: teacher.email,
        name: teacher.name,
        is_admin: teacher.is_admin === 1,
      },
      expiresAt,
    });
  } catch (error) {
    console.error(
      "LOGIN FAILED WITH ERROR:",
      error
    );

    return c.json(
      {
        success: false,
        message: "Login failed",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      500
    );
  }
});

auth.post("/logout", async (c) => {
  try {
    const cookieHeader =
      c.req.header("Cookie");

    if (cookieHeader) {
      const token =
        cookieHeader
          .split(";")
          .map((cookie) => cookie.trim())
          .find((cookie) =>
            cookie.startsWith("session=")
          )
          ?.split("=")[1];

      if (token) {
        const tokenHash =
          await hashSessionToken(token);

        await c.env.DB
          .prepare(`
            DELETE FROM sessions
            WHERE token_hash = ?
          `)
          .bind(tokenHash)
          .run();
      }
    }

    c.header(
      "Set-Cookie",
      getClearSessionCookie()
    );

    return c.json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error(
      "Logout failed:",
      error
    );

    c.header(
      "Set-Cookie",
      getClearSessionCookie()
    );

    return c.json({
      success: true,
      message: "Logout successful",
    });
  }
});

auth.get(
  "/me",
  requireAuth,
  (c) => {
    const teacher = c.get("teacher");

    return c.json({
      success: true,
      teacher,
    });
  }
);

auth.post("/invite", requireAuth, async (c) => {
  try {
    const teacher = c.get("teacher");
    const body = await c.req.json();
    if (!teacher.is_admin) {
      return c.json({ success: false, message: "Only administrators can invite teachers" }, 403);
    }

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email) {
      return c.json({ success: false, message: "Email is required" }, 400);
    }

    const token = await createSessionToken(); // using this as a secure random string generator
    const tokenHash = await hashSessionToken(token);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(); // 7 days
    const id = crypto.randomUUID();

    await c.env.DB.prepare(`
      INSERT INTO invitations (id, email, token_hash, expires_at, created_by)
      VALUES (?, ?, ?, ?, ?)
    `)
    .bind(id, email, tokenHash, expiresAt, teacher.id)
    .run();

    if (c.env.RESEND_API_KEY && c.env.RESEND_FROM_EMAIL) {
      const frontendUrl = c.env.FRONTEND_URL || "https://dbms-practical-tracker-frontend.kartikadtu.workers.dev";
      const inviteUrl = `${frontendUrl}/#/invite/${token}`;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${c.env.RESEND_API_KEY}`
        },
        body: JSON.stringify({
          from: c.env.RESEND_FROM_EMAIL,
          to: email,
          subject: "You've been invited to PracticalTracker",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Welcome to PracticalTracker</h2>
              <p>${teacher.name} has invited you to join the workspace as a teacher.</p>
              <p>Click the link below to accept your invitation and set up your account:</p>
              <a href="${inviteUrl}" style="display: inline-block; background-color: #7b9971; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 16px;">Accept Invitation</a>
              <p style="margin-top: 32px; font-size: 12px; color: #666;">If you have trouble clicking the button, copy and paste this link into your browser: <br/> ${inviteUrl}</p>
            </div>
          `
        })
      });
    }

    return c.json({
      success: true,
      message: "Invitation created and sent",
      token // still returned just in case email is not configured
    });
  } catch (error) {
    return c.json({
      success: false,
      message: "Could not create invitation. Is the email already invited?"
    }, 500);
  }
});

auth.get("/invite/:token", async (c) => {
  const token = c.req.param("token");
  if (!token) {
    return c.json({ success: false, message: "Token is required" }, 400);
  }

  const tokenHash = await hashSessionToken(token);
  
  const invite = await c.env.DB.prepare(`
    SELECT email, expires_at, used_at FROM invitations WHERE token_hash = ?
  `)
  .bind(tokenHash)
  .first<{email: string, expires_at: string, used_at: string | null}>();

  if (!invite) {
    return c.json({ success: false, message: "Invalid invitation" }, 400);
  }
  
  if (invite.used_at) {
    return c.json({ success: false, message: "Invitation already used" }, 400);
  }
  
  if (new Date(invite.expires_at) < new Date()) {
    return c.json({ success: false, message: "Invitation expired" }, 400);
  }

  const existingTeacher = await c.env.DB.prepare(`
    SELECT id FROM teachers WHERE email = ?
  `)
  .bind(invite.email)
  .first();

  return c.json({
    success: true,
    email: invite.email,
    isExistingUser: !!existingTeacher
  });
});

auth.post("/invite/accept", async (c) => {
  try {
    const body = await c.req.json();
    const token = typeof body.token === "string" ? body.token : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!token || !password) {
      return c.json({ success: false, message: "Missing required fields" }, 400);
    }

    const tokenHash = await hashSessionToken(token);
    
    const invite = await c.env.DB.prepare(`
      SELECT id, email, expires_at, used_at FROM invitations WHERE token_hash = ?
    `)
    .bind(tokenHash)
    .first<{id: string, email: string, expires_at: string, used_at: string | null}>();

    if (!invite || invite.used_at || new Date(invite.expires_at) < new Date()) {
      return c.json({ success: false, message: "Invalid or expired invitation" }, 400);
    }

    const passwordHash = await hashPassword(password);
    
    const existingTeacher = await c.env.DB.prepare(`
      SELECT id, email, name FROM teachers WHERE email = ?
    `)
    .bind(invite.email)
    .first<{id: string, email: string, name: string}>();

    let teacherId = existingTeacher?.id;
    let finalName = existingTeacher?.name || name;

    if (existingTeacher) {
      await c.env.DB.prepare(`
        UPDATE teachers SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `)
      .bind(passwordHash, existingTeacher.id)
      .run();
    } else {
      if (!name) {
        return c.json({ success: false, message: "Name is required for new accounts" }, 400);
      }
      teacherId = crypto.randomUUID();
      await c.env.DB.prepare(`
        INSERT INTO teachers (id, email, password_hash, name)
        VALUES (?, ?, ?, ?)
      `)
      .bind(teacherId, invite.email, passwordHash, name)
      .run();
    }

    await c.env.DB.prepare(`
      UPDATE invitations SET used_at = CURRENT_TIMESTAMP WHERE id = ?
    `)
    .bind(invite.id)
    .run();

    // Log them in immediately
    const sessionToken = await createSessionToken();
    const sessionTokenHash = await hashSessionToken(sessionToken);
    const expiresAt = getSessionExpiry();
    const sessionId = crypto.randomUUID();

    await c.env.DB.prepare(`
      INSERT INTO sessions (id, teacher_id, token_hash, expires_at)
      VALUES (?, ?, ?, ?)
    `)
    .bind(sessionId, teacherId, sessionTokenHash, expiresAt)
    .run();

    c.header("Set-Cookie", getSessionCookie(sessionToken));

    return c.json({
      success: true,
      message: "Invitation accepted and logged in",
      teacher: {
        id: teacherId,
        email: invite.email,
        name: finalName
      }
    });

  } catch (error) {
    return c.json({ success: false, message: "Failed to accept invitation" }, 500);
  }
});

export default auth;
