export type Bindings = {
  DB: D1Database;
  AI: Ai;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  FRONTEND_URL?: string;
};

export type AppEnv = {
  Bindings: Bindings;
};