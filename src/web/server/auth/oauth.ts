import { randomBytes } from "node:crypto";
import { Hono } from "hono";
import { getEnv } from "../config/env.js";
import { setSessionCookie, clearSessionCookie } from "./session.js";
import { getCookie } from "./cookies.js";

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_USER_URL = "https://api.github.com/user";

const STATE_COOKIE = "oauth_state";
const RETURN_TO_COOKIE = "return_to";

export const authRoutes = new Hono();

/**
 * GET /api/auth/login
 * Redirects to GitHub authorize URL with a random state parameter.
 * Stores the return-to path so we can redirect back after login.
 */
authRoutes.get("/login", (c) => {
  const env = getEnv();
  const state = randomBytes(16).toString("hex");
  const returnTo = c.req.query("return_to") || "/";

  const params = new URLSearchParams({
    client_id: env.GITHUB_OAUTH_CLIENT_ID,
    redirect_uri: `${env.APP_BASE_URL}/api/auth/callback`,
    scope: "read:user",
    state,
  });

  const isProduction = process.env.NODE_ENV === "production";
  const cookieFlags = `Path=/; HttpOnly; SameSite=Lax; Max-Age=600${isProduction ? "; Secure" : ""}`;

  c.header("Set-Cookie", `${STATE_COOKIE}=${state}; ${cookieFlags}`);
  c.header("Set-Cookie", `${RETURN_TO_COOKIE}=${encodeURIComponent(returnTo)}; ${cookieFlags}`, {
    append: true,
  });

  return c.redirect(`${GITHUB_AUTHORIZE_URL}?${params.toString()}`);
});

/**
 * GET /api/auth/callback
 * Exchanges the code for a token, fetches user info, checks allowlist.
 */
authRoutes.get("/callback", async (c) => {
  const env = getEnv();
  const code = c.req.query("code");
  const state = c.req.query("state");

  // Verify state
  const storedState = getCookie(c.req, STATE_COOKIE);
  if (!state || !storedState || state !== storedState) {
    return c.text("Invalid OAuth state", 403);
  }

  if (!code) {
    return c.text("Missing authorization code", 400);
  }

  // Exchange code for access token
  const tokenRes = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: env.GITHUB_OAUTH_CLIENT_ID,
      client_secret: env.GITHUB_OAUTH_CLIENT_SECRET,
      code,
    }),
  });

  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
  };

  if (!tokenData.access_token) {
    return c.text("GitHub token exchange failed", 502);
  }

  // Fetch user info
  const userRes = await fetch(GITHUB_USER_URL, {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: "application/json",
    },
  });

  if (!userRes.ok) {
    return c.text("Failed to fetch GitHub user", 502);
  }

  const user = (await userRes.json()) as { login?: string };
  if (!user.login) {
    return c.text("GitHub user response missing login", 502);
  }

  // Check allowlist
  const allowedLogins = env.ADMIN_GITHUB_LOGINS.split(",").map((s) =>
    s.trim().toLowerCase()
  );
  if (!allowedLogins.includes(user.login.toLowerCase())) {
    return c.text("Forbidden: user not in admin allowlist", 403);
  }

  // Set session cookie
  setSessionCookie(c, user.login);

  // Clear OAuth cookies and redirect
  const isProduction = process.env.NODE_ENV === "production";
  const clearFlags = `Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProduction ? "; Secure" : ""}`;
  c.header("Set-Cookie", `${STATE_COOKIE}=; ${clearFlags}`, { append: true });
  c.header("Set-Cookie", `${RETURN_TO_COOKIE}=; ${clearFlags}`, {
    append: true,
  });

  const returnTo = decodeURIComponent(getCookie(c.req, RETURN_TO_COOKIE) || "/");
  return c.redirect(returnTo);
});

/**
 * POST /api/auth/logout
 * Clears the session cookie.
 */
authRoutes.post("/logout", (c) => {
  clearSessionCookie(c);
  return c.json({ ok: true });
});

