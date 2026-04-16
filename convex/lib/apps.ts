"use node";

import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { getGithubTokenDocForUser } from "./providers/github/data";
import { findConvexAuthAccountForUser } from "./providers/convex/data";
import { githubAccessTokenNeedsRefresh } from "./providers/github/platform";

export const appSummaryValidator = v.object({
  _id: v.id("apps"),
  name: v.string(),
  status: v.string(),
  createdAt: v.number(),
});

export const internalAppValidator = v.object({
  _id: v.id("apps"),
  ownerId: v.id("users"),
  name: v.string(),
  status: v.string(),
  vercelTeamId: v.string(),
  githubInstallationId: v.string(),
  githubRepoPrivate: v.boolean(),
  githubRepoCreationMethod: v.union(v.literal("clone"), v.literal("template")),
});

export async function validateCreateAppSelections(
  ctx: MutationCtx,
  userId: Id<"users">,
  args: {
    vercelTeamId: string;
    githubInstallationId: string;
  },
) {
  const vercelToken = await ctx.db
    .query("vercelTokens")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  if (!vercelToken) {
    throw new Error("Connect your Vercel account before creating apps");
  }
  if (vercelToken.tokenStatus === "invalid") {
    throw new Error(
      "The saved Vercel token is no longer valid. Paste a new token on the setup page.",
    );
  }

  const vercelTeamId = args.vercelTeamId.trim();
  if (!vercelTeamId) {
    throw new Error("Select a Vercel team");
  }
  if (!vercelToken.teams.some((team) => team.id === vercelTeamId)) {
    throw new Error(
      "That Vercel team is not available for your account. Re-verify your Vercel token on the setup page.",
    );
  }

  const convexAccount = await findConvexAuthAccountForUser(ctx, userId);
  const convexToken = convexAccount
    ? await ctx.db
        .query("convexTokens")
        .withIndex("by_provider_account", (q) => q.eq("providerAccountId", convexAccount.providerAccountId))
        .first()
    : null;
  if (!convexToken) {
    throw new Error("Connect your Convex account before creating apps");
  }
  if (convexToken.tokenStatus === "invalid") {
    throw new Error(
      "The saved Convex token is no longer valid. Reconnect Convex on the setup page.",
    );
  }

  const githubToken = await getGithubTokenDocForUser(ctx, userId);
  if (!githubToken) {
    throw new Error("GitHub access token not available. Please sign out and sign in again.");
  }
  if (githubToken.tokenStatus === "invalid") {
    throw new Error(
      "GitHub access needs attention. Sign in with GitHub again.",
    );
  }
  if (
    githubAccessTokenNeedsRefresh(githubToken.accessTokenExpiresAt) &&
    !githubToken.refreshToken
  ) {
    throw new Error(
      "GitHub access token expired or expiring and cannot be refreshed automatically. Sign in with GitHub again.",
    );
  }

  const githubInstallationId = args.githubInstallationId.trim();
  if (!githubInstallationId) {
    throw new Error("Select a GitHub installation");
  }
  if (
    !githubToken.installations.some(
      (installation) => installation.id === githubInstallationId,
    )
  ) {
    throw new Error(
      "That GitHub installation is not available for your account. Refresh installations or re-install the GitHub App.",
    );
  }

  return {
    githubInstallationId,
    vercelTeamId,
  };
}

export function mapAppSummary(app: Doc<"apps">) {
  return {
    _id: app._id,
    name: app.name,
    status: app.status,
    createdAt: app.createdAt,
  };
}

export function mapInternalApp(app: Doc<"apps">) {
  return {
    _id: app._id,
    ownerId: app.ownerId,
    name: app.name,
    status: app.status,
    vercelTeamId: app.vercelTeamId,
    githubInstallationId: app.githubInstallationId,
    githubRepoPrivate: app.githubRepoPrivate ?? false,
    githubRepoCreationMethod: app.githubRepoCreationMethod,
  };
}
