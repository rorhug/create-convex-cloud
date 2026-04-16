import { internal } from "../../../_generated/api";
import type { ActionCtx } from "../../../_generated/server";

/** Buffer before wall-clock expiry to refresh early (clock skew, network). */
export const GITHUB_ACCESS_TOKEN_REFRESH_BUFFER_MS = 5 * 60_000;

export type GithubInstallation = {
  id: string;
  accountId: number;
  accountLogin: string;
  accountType: string;
  accountAvatarUrl?: string;
  repositorySelection: string;
};

export class GithubApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GithubApiError";
  }
}

type TokenInvalidationCtx = Pick<ActionCtx, "runMutation">;

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
 * If expiry is unknown (`undefined`), returns false.
 */
export function githubAccessTokenNeedsRefresh(
  accessTokenExpiresAtMs: number | undefined,
  nowMs: number = Date.now(),
  bufferMs: number = GITHUB_ACCESS_TOKEN_REFRESH_BUFFER_MS,
): boolean {
  if (accessTokenExpiresAtMs === undefined) return false;
  return nowMs >= accessTokenExpiresAtMs - bufferMs;
}

export function getGithubAppSlug() {
  return process.env.AUTH_GITHUB_APP_SLUG?.trim() || "create-convex-cloud";
}

export function getGithubAppInstallUrl() {
  const appSlug = getGithubAppSlug();
  return `https://github.com/apps/${encodeURIComponent(appSlug)}/installations/new`;
}

/**
 * Deep-link to this app's GitHub App permissions for a specific user or org account
 * (matches `account.id` / `account.type` from installation listings).
 */
export function vercelGithubAppPermissionsUrlForAccount(accountId: number, accountType: string): string {
  const targetType = accountType.toLowerCase() === "organization" ? "Organization" : "User";
  const url = new URL(`https://github.com/apps/vercel/installations/new/permissions`);
  url.searchParams.set("target_id", String(accountId));
  url.searchParams.set("target_type", targetType);
  return url.href;
}

function httpStatusFromUnknown(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "status" in error) {
    const s = (error as { status?: number }).status;
    return typeof s === "number" ? s : undefined;
  }
  return undefined;
}

export function isGithubConnectionInvalidError(error: unknown): boolean {
  if (error instanceof GithubApiError) {
    return error.status === 401 || error.status === 403;
  }
  const status = httpStatusFromUnknown(error);
  if (status === 401 || status === 403) {
    return true;
  }
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("github token refresh failed") ||
      message.includes("no refresh token is stored") ||
      message.includes("http 401") ||
      message.includes("http 403")
    );
  }
  return false;
}

type GithubUserInstallationsResponse = {
  installations?: Array<{
    id: number;
    repository_selection: string;
    account?: {
      id?: number;
      login?: string;
      type?: string;
      avatar_url?: string;
    } | null;
  }>;
};

async function githubFetch(accessToken: string, url: string, ctx?: TokenInvalidationCtx) {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`,
        "X-GitHub-Api-Version": "2026-03-10",
      },
    });

    if (!response.ok) {
      throw new GithubApiError(`GitHub installations request failed: HTTP ${response.status}`, response.status);
    }

    return response;
  } catch (error) {
    if (ctx && isGithubConnectionInvalidError(error)) {
      await ctx.runMutation(internal.lib.providers.github.data.markGithubTokenInvalid, {
        token: accessToken,
      });
    }
    throw error;
  }
}

export async function fetchGithubInstallationsForAccessToken(
  accessToken: string,
  ctx?: TokenInvalidationCtx,
): Promise<GithubInstallation[]> {
  const installations: GithubInstallation[] = [];
  let page = 1;

  for (;;) {
    const response = await githubFetch(
      accessToken,
      `https://api.github.com/user/installations?per_page=100&page=${page}`,
      ctx,
    );

    const data = (await response.json()) as GithubUserInstallationsResponse;
    console.log("[refreshGithubInstallations] API user/installations full list:", JSON.stringify(data, null, 2));

    const pageInstallations: GithubInstallation[] = [];
    for (const installation of data.installations ?? []) {
      const accountId = installation.account?.id;
      const accountLogin = installation.account?.login?.trim();
      const accountType = installation.account?.type?.trim();
      if (accountId === undefined || !Number.isFinite(accountId) || !accountLogin || !accountType) {
        continue;
      }
      pageInstallations.push({
        id: String(installation.id),
        accountId,
        accountLogin,
        accountType,
        accountAvatarUrl: installation.account?.avatar_url,
        repositorySelection: installation.repository_selection,
      });
    }

    installations.push(...pageInstallations);

    if (pageInstallations.length < 100) {
      break;
    }
    page += 1;
  }

  return installations;
}
