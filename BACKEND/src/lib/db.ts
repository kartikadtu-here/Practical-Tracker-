import type { Bindings } from "../types/env";

export function getDB(env: Bindings): D1Database {
  return env.DB;
}
