/** Buffer before wall-clock expiry to refresh early (clock skew, network). */
const DEFAULT_REFRESH_BUFFER_MS = 60_000;

/**
 * Auth.js passes OAuth token fields on the `tokens` argument to `profile()`.
 * `expires_at` is Unix seconds; `expires_in` is seconds until expiry from token response time.
 */
export function accessTokenExpiresAtMsFromOAuthTokens(tokens: {
  expires_at?: number;
  expires_in?: number;
}): number | undefined {
  if (typeof tokens.expires_at === "number" && Number.isFinite(tokens.expires_at)) {
    return tokens.expires_at * 1000;
  }
  if (typeof tokens.expires_in === "number" && Number.isFinite(tokens.expires_in)) {
    return Date.now() + tokens.expires_in * 1000;
  }
  return undefined;
}

/**
 * Returns true when the access token should be refreshed before use (or is already stale).
 * If expiry is unknown (`undefined`), returns false — caller cannot rely on rotation by time alone.
 */
export function githubAccessTokenNeedsRefresh(
  accessTokenExpiresAtMs: number | undefined,
  nowMs: number = Date.now(),
  bufferMs: number = DEFAULT_REFRESH_BUFFER_MS,
): boolean {
  if (accessTokenExpiresAtMs === undefined) return false;
  return nowMs >= accessTokenExpiresAtMs - bufferMs;
}
