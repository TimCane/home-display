import { createHmac, timingSafeEqual } from "node:crypto";
import type { Context } from "hono";
import { getEnv } from "../config/env.js";

export interface SessionPayload {
  login: string;
  iat: number;
}

const COOKIE_NAME = "session";
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

function sign(payload: SessionPayload): string {
  const data = JSON.stringify(payload);
  const encoded = Buffer.from(data).toString("base64url");
  const mac = createHmac("sha256", getEnv().SESSION_SECRET)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${mac}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const dotIndex = token.indexOf(".");
  if (dotIndex === -1) return null;

  const encoded = token.slice(0, dotIndex);
  const mac = token.slice(dotIndex + 1);

  const expected = createHmac("sha256", getEnv().SESSION_SECRET)
    .update(encoded)
    .digest("base64url");

  const macBuf = Buffer.from(mac);
  const expectedBuf = Buffer.from(expected);
  if (macBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(macBuf, expectedBuf)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString()
    ) as SessionPayload;

    // Check expiry
    const age = Date.now() / 1000 - payload.iat;
    if (age > MAX_AGE_SECONDS || age < 0) return null;

    return payload;
  } catch {
    return null;
  }
}

/**
 * Parse the session cookie from the request. Returns null if absent or invalid.
 */
export function getSession(c: Context): SessionPayload | null {
  const raw = getCookie(c, COOKIE_NAME);
  if (!raw) return null;
  return verifySessionToken(raw);
}

/**
 * Set a signed session cookie on the response.
 */
export function setSessionCookie(c: Context, login: string): void {
  const payload: SessionPayload = { login, iat: Math.floor(Date.now() / 1000) };
  const token = sign(payload);
  const isProduction = process.env.NODE_ENV === "production";

  c.header(
    "Set-Cookie",
    [
      `${COOKIE_NAME}=${token}`,
      `Path=/`,
      `HttpOnly`,
      `SameSite=Lax`,
      `Max-Age=${MAX_AGE_SECONDS}`,
      ...(isProduction ? ["Secure"] : []),
    ].join("; ")
  );
}

/**
 * Clear the session cookie.
 */
export function clearSessionCookie(c: Context): void {
  c.header(
    "Set-Cookie",
    [
      `${COOKIE_NAME}=`,
      `Path=/`,
      `HttpOnly`,
      `SameSite=Lax`,
      `Max-Age=0`,
    ].join("; ")
  );
}

/** Simple cookie parser — extracts a single cookie by name. */
function getCookie(c: Context, name: string): string | undefined {
  const header = c.req.header("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return undefined;
}
