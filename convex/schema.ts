import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  /** OAuth tokens; `githubUserId` matches `authAccounts.providerAccountId` for provider `github`. */
  githubTokens: defineTable({
    githubUserId: v.string(),
    token: v.string(),
    /** Unix ms when `token` expires; omit if provider did not send expiry (e.g. non-expiring classic token). */
    accessTokenExpiresAt: v.optional(v.number()),
    refreshToken: v.optional(v.string()),
    username: v.optional(v.string()),
  }).index("by_github_user_id", ["githubUserId"]),

  // Vercel personal access token (pasted by user)
  vercelTokens: defineTable({
    userId: v.id("users"),
    token: v.string(),
    teams: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        slug: v.string(),
      }),
    ),
  }).index("by_user", ["userId"]),

  // Convex OAuth team-scoped application token
  convexTokens: defineTable({
    userId: v.id("users"),
    providerAccountId: v.optional(v.string()),
    token: v.string(),
    teamId: v.string(),
  }).index("by_user", ["userId"]),

  // Apps
  apps: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    /** Vercel team id (includes personal/hobby via default team id). */
    vercelTeamId: v.string(),
    status: v.string(), // "creating" | "ready" | "deleting" | "error"
    workflowId: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_owner", ["ownerId"]),

  // Step-by-step progress tracking for app creation/deletion
  appSteps: defineTable({
    appId: v.id("apps"),
    step: v.string(), // "github" | "convex" | "vercel"
    status: v.string(), // "pending" | "running" | "done" | "error"
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
