import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
import { appStatusValidator } from "./lib/appStatus";

export default defineSchema({
  ...authTables,

  /** GitHub OAuth tokens. Linked to `authAccounts` via `providerAccountId`. */
  githubTokens: defineTable({
    providerAccountId: v.string(),
    token: v.string(),
    /** Unix ms when `token` expires; omit if provider did not send expiry (e.g. non-expiring classic token). */
    accessTokenExpiresAt: v.optional(v.number()),
    refreshToken: v.optional(v.string()),
    username: v.optional(v.string()),
    tokenStatus: v.union(v.literal("valid"), v.literal("invalid")),
    installations: v.array(
      v.object({
        id: v.string(),
        /** GitHub user or organization id (`account.id` on installation). */
        accountId: v.number(),
        accountLogin: v.string(),
        accountType: v.string(),
        accountAvatarUrl: v.optional(v.string()),
        repositorySelection: v.string(),
      }),
    ),
  })
    .index("by_provider_account", ["providerAccountId"])
    .index("by_token", ["token"]),

  // Vercel personal access token (pasted by user)
  vercelTokens: defineTable({
    userId: v.id("users"),
    token: v.string(),
    tokenStatus: v.union(v.literal("valid"), v.literal("invalid")),
    teams: v.array(
      v.object({
        id: v.string(),
        name: v.optional(v.string()),
        slug: v.string(),
      }),
    ),
  })
    .index("by_user", ["userId"])
    .index("by_token", ["token"]),

  /** Convex OAuth team-scoped application token. Linked to `authAccounts` via `providerAccountId`. */
  convexTokens: defineTable({
    providerAccountId: v.string(),
    token: v.string(),
    teamId: v.string(),
    teamSlug: v.string(),
    tokenStatus: v.union(v.literal("valid"), v.literal("invalid")),
  })
    .index("by_provider_account", ["providerAccountId"])
    .index("by_token", ["token"]),

  // Apps
  apps: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    /** Vercel team id (includes personal/hobby via default team id). */
    vercelTeamId: v.string(),
    /** GitHub App installation to use for repo access and ownership. */
    githubInstallationId: v.string(),
    /** GitHub repo visibility at creation time (`false` = public). */
    githubRepoPrivate: v.boolean(),
    /** GitHub repo setup strategy. */
    githubRepoCreationMethod: v.union(v.literal("clone"), v.literal("template")),
    status: appStatusValidator,
    workflowId: v.optional(v.string()),
    /** Last scheduled workflow: create vs delete (retry only applies to create). */
    workflowKind: v.optional(v.union(v.literal("create"), v.literal("delete"))),
    createdAt: v.number(),
  }).index("by_owner", ["ownerId"]),

  // Step-by-step progress tracking for app creation/deletion
  appSteps: defineTable({
    appId: v.id("apps"),
    step: v.string(), // "github" | "convex" | "vercel"
    status: appStatusValidator,
    message: v.optional(v.string()),
  }).index("by_app", ["appId"]),

  // Resources created per app
  githubRepos: defineTable({
    appId: v.id("apps"),
    repoFullName: v.string(), // "username/repo-name"
    repoUrl: v.string(),
  }).index("by_app", ["appId"]),

  convexProjects: defineTable({
    appId: v.id("apps"),
    projectId: v.string(),
    teamId: v.string(),
    /** Dashboard URLs: /t/{teamSlug}/{projectSlug} */
    teamSlug: v.string(),
    projectSlug: v.string(),
    prodDeploymentName: v.string(),
    prodDeployKey: v.string(),
    previewDeployKey: v.string(),
  }).index("by_app", ["appId"]),

  vercelProjects: defineTable({
    appId: v.id("apps"),
    projectId: v.string(),
    projectName: v.string(),
    teamId: v.string(),
    /** Scope in vercel.com/{teamSlug}/{projectName} (team slug or personal username). */
    teamSlug: v.string(),
    deploymentUrl: v.optional(v.string()),
  }).index("by_app", ["appId"]),
});
