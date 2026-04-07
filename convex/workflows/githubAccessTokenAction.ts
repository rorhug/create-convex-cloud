"use node";

import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import {
  accessTokenExpiresAtMsFromOAuthTokens,
  githubAccessTokenNeedsRefresh,
} from "../lib/providers/github/platform";

type GithubRefreshResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
  error?: string;
  error_description?: string;
};

async function exchangeGithubRefreshToken(refreshToken: string): Promise<GithubRefreshResponse> {
  const clientId = process.env.AUTH_GITHUB_ID;
  const clientSecret = process.env.AUTH_GITHUB_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GitHub OAuth is not configured (AUTH_GITHUB_ID / AUTH_GITHUB_SECRET)");
  }
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = (await res.json()) as GithubRefreshResponse;
  if (typeof data.error === "string" && data.error.length > 0) {
    const desc =
      typeof data.error_description === "string" && data.error_description.length > 0
        ? data.error_description
        : data.error;
    throw new Error(`GitHub token refresh failed: ${desc}`);
  }
  if (!res.ok) {
    throw new Error(`GitHub token refresh failed: HTTP ${res.status}`);
  }
  if (typeof data.access_token !== "string" || data.access_token.length === 0) {
    throw new Error("GitHub token refresh returned no access_token");
  }
  return data;
}

async function ensureFreshGithubAccessTokenImpl(
  ctx: ActionCtx,
  args: { userId: Id<"users"> },
): Promise<{ accessToken: string; githubUsername: string | null }> {
  const row = await ctx.runQuery(internal.lib.providers.github.data.getGithubTokenRowForRefresh, {
    userId: args.userId,
  });
  if (!row) {
    throw new Error("GitHub access token not found for user");
  }
  if (!githubAccessTokenNeedsRefresh(row.accessTokenExpiresAt)) {
    return {
      accessToken: row.token,
      githubUsername: row.username ?? null,
    };
  }
  if (!row.refreshToken) {
    throw new Error(
      "GitHub access token expired or expiring and no refresh token is stored. Sign in with GitHub again.",
    );
  }
  const refreshed = await exchangeGithubRefreshToken(row.refreshToken);
  const accessTokenExpiresAt = accessTokenExpiresAtMsFromOAuthTokens(refreshed);
  await ctx.runMutation(internal.lib.providers.github.data.applyGithubOAuthRefresh, {
    githubUserId: row.githubUserId,
    accessToken: refreshed.access_token,
    ...(accessTokenExpiresAt !== undefined ? { accessTokenExpiresAt } : {}),
    ...(refreshed.refresh_token !== undefined && refreshed.refresh_token.length > 0
      ? { refreshToken: refreshed.refresh_token }
      : {}),
  });
  return {
    accessToken: refreshed.access_token,
    githubUsername: row.username ?? null,
  };
}

/**
 * Ensures the user's GitHub OAuth access token is valid for API use: refreshes via
 * `grant_type=refresh_token` when within the expiry buffer, updates `githubTokens`, then
 * returns credentials for Octokit.
 */
export const ensureFreshGithubAccessToken = internalAction({
  args: { userId: v.id("users") },
  returns: v.object({
    accessToken: v.string(),
    githubUsername: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => ensureFreshGithubAccessTokenImpl(ctx, args),
});
