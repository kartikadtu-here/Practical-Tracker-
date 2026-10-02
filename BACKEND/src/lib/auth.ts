const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function base64UrlEncode(bytes: Uint8Array): string {
  return bytesToBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded =
    value.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (value.length % 4)) % 4);

  return base64ToBytes(padded);
}

export async function hashPassword(
  password: string
): Promise<string> {
  const encoder = new TextEncoder();

  const hash = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(password)
  );

  return base64UrlEncode(new Uint8Array(hash));
}

export async function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  const candidateHash = await hashPassword(password);

  return candidateHash === passwordHash;
}

export async function createSessionToken(): Promise<string> {
  const bytes = crypto.getRandomValues(
    new Uint8Array(32)
  );

  return base64UrlEncode(bytes);
}

export async function hashSessionToken(
  token: string
): Promise<string> {
  const encoder = new TextEncoder();

  const hash = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(token)
  );

  return base64UrlEncode(new Uint8Array(hash));
}

export function getSessionExpiry(): string {
  return new Date(
    Date.now() +
      SESSION_DURATION_SECONDS * 1000
  ).toISOString();
}

export function getSessionCookie(
  token: string
): string {
  return [
    `session=${token}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Path=/",
    `Max-Age=${SESSION_DURATION_SECONDS}`,
  ].join("; ");
}

export function getClearSessionCookie(): string {
  return [
    "session=",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Path=/",
    "Max-Age=0",
  ].join("; ");
}

export function extractSessionToken(
  cookieHeader: string | undefined
): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim());

  for (const cookie of cookies) {
    const separatorIndex = cookie.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const name = cookie.slice(0, separatorIndex);
    const value = cookie.slice(separatorIndex + 1);

    if (name === "session" && value) {
      return value;
    }
  }

  return null;
}
