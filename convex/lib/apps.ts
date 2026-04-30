"use node";

import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { appStatusValidator } from "./appStatus";
import { getGithubTokenDocForUser } from "./providers/github/data";
import { findConvexAuthAccountForUser } from "./providers/convex/data";
import { githubAccessTokenNeedsRefresh } from "./providers/github/platform";
import { requireVercelTokenDocForUser } from "./providers/vercel/data";

export const appSummaryValidator = v.object({
  _id: v.id("apps"),
  name: v.string(),
  status: appStatusValidator,
  workflowKind: v.optional(v.union(v.literal("create"), v.literal("delete"))),
  createdAt: v.number(),
});

export const deploymentTargetValidator = v.union(
  v.literal("vercel"),
  v.literal("github-pages"),
);

export const internalAppValidator = v.object({
  _id: v.id("apps"),
  ownerId: v.id("users"),
  name: v.string(),
  status: appStatusValidator,
  deploymentTarget: deploymentTargetValidator,
  vercelTeamId: v.optional(v.string()),
  githubInstallationId: v.string(),
  githubRepoPrivate: v.boolean(),
  githubRepoCreationMethod: v.union(v.literal("clone"), v.literal("template")),
  workflowKind: v.optional(v.union(v.literal("create"), v.literal("delete"))),
});

/**
 * Caller-provided deployment-target selection. Discriminated by `type`.
 * - `vercel`: deploy via Vercel using the saved token + chosen team.
 * - `github-pages`: deploy via GitHub Pages using the installed GitHub App.
 */
export type DeploymentTargetSelection =
  | { type: "vercel"; vercelTeamId: string }
  | { type: "github-pages" };

export async function validateCreateAppSelections(
  ctx: MutationCtx,
  userId: Id<"users">,
  args: {
    githubInstallationId: string;
    deploymentTarget: DeploymentTargetSelection;
  },
): Promise<{
  githubInstallationId: string;
  deploymentTarget: DeploymentTargetSelection;
}> {
  // GitHub installation: required for both targets (we always create a repo).
  const githubToken = await getGithubTokenDocForUser(ctx, userId);
  if (!githubToken) {
    throw new Error("GitHub access token not available. Please sign out and sign in again.");
  }
  if (githubToken.tokenStatus === "invalid") {
    throw new Error("GitHub access needs attention. Sign in with GitHub again.");
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

  // Convex token: required for both targets (the workflow always creates a Convex project).
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

  // Deployment-target-specific checks.
  if (args.deploymentTarget.type === "vercel") {
    const vercelToken = await requireVercelTokenDocForUser(ctx, userId);
    const vercelTeamId = args.deploymentTarget.vercelTeamId.trim();
    if (!vercelTeamId) {
      throw new Error("Select a Vercel team");
    }
    if (!vercelToken.teams.some((team) => team.id === vercelTeamId)) {
      throw new Error(
        "That Vercel team is not available for your account. Re-verify your Vercel token on the setup page.",
      );
    }
    return {
      githubInstallationId,
      deploymentTarget: { type: "vercel", vercelTeamId },
    };
  }

  // github-pages: nothing extra to check beyond the GitHub installation above.
  // (We deliberately do NOT require a `githubPagesPreferences` row — picking
  // GitHub Pages here is itself an explicit choice. The setup-page confirmation
  // is just a hint for the default selection.)
  return {
    githubInstallationId,
    deploymentTarget: { type: "github-pages" },
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
    deploymentTarget: (app.deploymentTarget ?? "vercel") as "vercel" | "github-pages",
    vercelTeamId: app.vercelTeamId,
    githubInstallationId: app.githubInstallationId,
    githubRepoPrivate: app.githubRepoPrivate ?? false,
    githubRepoCreationMethod: app.githubRepoCreationMethod,
    workflowKind: app.workflowKind,
  };
}
