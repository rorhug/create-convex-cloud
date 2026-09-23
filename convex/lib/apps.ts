"use node";

import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { appStatusValidator } from "./appStatus";
import { getGithubTokenDocForUser } from "./providers/github/data";
import { getConvexTokenDocForTeam } from "./providers/convex/data";
import { githubAccessTokenNeedsRefresh } from "./providers/github/platform";
import { requireVercelTokenDocForUser } from "./providers/vercel/data";

export const appSummaryValidator = v.object({
  _id: v.id("apps"),
  name: v.string(),
  status: appStatusValidator,
  workflowKind: v.optional(v.union(v.literal("create"), v.literal("delete"))),
  createdAt: v.number(),
});

export const internalAppValidator = v.object({
  _id: v.id("apps"),
  ownerId: v.id("users"),
  name: v.string(),
  status: appStatusValidator,
  vercelTeamId: v.string(),
  githubInstallationId: v.string(),
  githubRepoPrivate: v.boolean(),
  convexTeamId: v.optional(v.string()),
  githubRepoCreationMethod: v.union(v.literal("clone"), v.literal("template")),
  workflowKind: v.optional(v.union(v.literal("create"), v.literal("delete"))),
});

export async function validateCreateAppSelections(
  ctx: MutationCtx,
  userId: Id<"users">,
  args: {
    vercelTeamId: string;
    githubInstallationId: string;
    convexTeamId: string;
  },
) {
  const vercelToken = await requireVercelTokenDocForUser(ctx, userId);

  const vercelTeamId = args.vercelTeamId.trim();
  if (!vercelTeamId) {
    throw new Error("Select a Vercel team");
  }
  if (!vercelToken.teams.some((team) => team.id === vercelTeamId)) {
    throw new Error(
      "That Vercel team is not available for your account. Re-verify your Vercel token on the setup page.",
    );
  }

  const convexTeamId = args.convexTeamId.trim();
  if (!convexTeamId) {
    throw new Error("Select a Convex team");
  }
  const convexToken = await getConvexTokenDocForTeam(ctx, userId, convexTeamId);
  if (!convexToken) {
    throw new Error("That Convex team is not connected. Link it on the setup page.");
  }
  if (convexToken.tokenStatus === "invalid") {
    throw new Error(
      "The saved Convex token for that team is no longer valid. Reconnect Convex on the setup page.",
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
    convexTeamId,
  };
}

export function mapAppSummary(app: Doc<"apps">) {
  return {
    _id: app._id,
    name: app.name,
    status: app.status,
    workflowKind: app.workflowKind,
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
    convexTeamId: app.convexTeamId,
    githubRepoCreationMethod: app.githubRepoCreationMethod,
    workflowKind: app.workflowKind,
  };
}
