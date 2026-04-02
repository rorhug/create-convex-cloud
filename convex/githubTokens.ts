import type { MutationCtx } from "./_generated/server";
import type { GithubProfileWithTokens } from "./providers/github";

export type GithubTokenFields = {
  githubUserId: string;
  accessToken: string;
  accessTokenExpiresAt?: number;
  refreshToken?: string;
  username?: string;
};

export function githubTokenFieldsFromProfile(profile: GithubProfileWithTokens): GithubTokenFields {
  // `id` is stripped by Convex Auth before createOrUpdateUser; prefer `githubUserId`.
  const githubUserId =
    typeof profile.githubUserId === "string" && profile.githubUserId.length > 0
      ? profile.githubUserId
      : typeof profile.id === "string" && profile.id.length > 0
        ? profile.id
        : "";
  if (githubUserId.length === 0) {
    throw new Error("GitHub profile is missing githubUserId (and id was stripped by Convex Auth)");
  }

  const accessToken = profile.accessToken;
  if (typeof accessToken !== "string" || accessToken.length === 0) {
    throw new Error("GitHub OAuth did not return an access token");
  }

  return {
    githubUserId,
    accessToken,
    accessTokenExpiresAt:
      typeof profile.accessTokenExpiresAt === "number" && Number.isFinite(profile.accessTokenExpiresAt)
        ? profile.accessTokenExpiresAt
        : undefined,
    refreshToken:
      typeof profile.refreshToken === "string" && profile.refreshToken.length > 0
        ? profile.refreshToken
        : undefined,
    username: profile.username,
  };
}

export async function upsertGithubTokenForGithubUser(ctx: MutationCtx, fields: GithubTokenFields) {
  const existing = await ctx.db
    .query("githubTokens")
    .withIndex("by_github_user_id", (q) => q.eq("githubUserId", fields.githubUserId))
    .first();

  const tokenDoc = {
    githubUserId: fields.githubUserId,
    token: fields.accessToken,
    ...(fields.accessTokenExpiresAt !== undefined
      ? { accessTokenExpiresAt: fields.accessTokenExpiresAt }
      : {}),
    ...(fields.refreshToken !== undefined ? { refreshToken: fields.refreshToken } : {}),
    ...(fields.username !== undefined ? { username: fields.username } : {}),
  };

  if (existing) {
    await ctx.db.patch(existing._id, tokenDoc);
    return;
  }

  await ctx.db.insert("githubTokens", tokenDoc);
}
