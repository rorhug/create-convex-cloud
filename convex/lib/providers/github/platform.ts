/** Buffer before wall-clock expiry to refresh early (clock skew, network). */
export const GITHUB_ACCESS_TOKEN_REFRESH_BUFFER_MS = 5 * 60_000;

export type GithubInstallation = {
  id: string;
  accountLogin: string;
  accountName?: string;
  accountType: string;
  accountAvatarUrl?: string;
  repositorySelection: string;
};

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

type GithubUserInstallationsResponse = {
  installations?: Array<{
    id: number;
    repository_selection: string;
    account?: {
      login?: string;
      name?: string | null;
      type?: string;
      avatar_url?: string;
    } | null;
  }>;
};

export function getGithubAppSlug() {
  return process.env.AUTH_GITHUB_APP_SLUG?.trim() || "create-convex-cloud";
}

export function getGithubAppInstallUrl() {
  const appSlug = getGithubAppSlug();
  return `https://github.com/apps/${encodeURIComponent(appSlug)}/installations/new`;
}

export async function fetchGithubInstallationsForAccessToken(
  accessToken: string,
): Promise<GithubInstallation[]> {
  const installations: GithubInstallation[] = [];
  let page = 1;

  for (;;) {
    const response = await fetch(
      `https://api.github.com/user/installations?per_page=100&page=${page}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${accessToken}`,
          "X-GitHub-Api-Version": "2026-03-10",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`GitHub installations request failed: HTTP ${response.status}`);
    }

    const data = (await response.json()) as GithubUserInstallationsResponse;
    const pageInstallations: GithubInstallation[] = [];
    for (const installation of data.installations ?? []) {
      const accountLogin = installation.account?.login?.trim();
      const accountType = installation.account?.type?.trim();
      if (!accountLogin || !accountType) {
        continue;
      }
      pageInstallations.push({
        id: String(installation.id),
        accountLogin,
        accountName: installation.account?.name ?? undefined,
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
