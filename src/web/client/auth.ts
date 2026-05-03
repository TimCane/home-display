/**
 * Redirect the browser to the OAuth login flow.
 * Called on 401 responses from tRPC.
 */
export function redirectToLogin() {
  const returnTo = encodeURIComponent(window.location.pathname);
  window.location.href = `/api/auth/login?return_to=${returnTo}`;
}

/**
 * Log the current user out by posting to the logout endpoint,
 * then redirect to login.
 */
export async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  redirectToLogin();
}
