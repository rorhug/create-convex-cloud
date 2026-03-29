import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  users: defineTable({
    // Standard auth fields (required because overriding authTables.users)
    name: v.optional(v.union(v.string(), v.null())),
    image: v.optional(v.union(v.string(), v.null())),
    email: v.optional(v.union(v.string(), v.null())),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    // GitHub OAuth fields (custom)
    githubAccessToken: v.optional(v.string()),
    githubUsername: v.optional(v.string()),
    convexAccessToken: v.optional(v.string()),
    convexTeamId: v.optional(v.string()),
  }).index("email", ["email"]),

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
    token: v.string(),
    teamId: v.string(),
  }).index("by_user", ["userId"]),

  // Apps
  apps: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
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
    prodDeploymentName: v.string(),
    prodDeployKey: v.string(),
    previewDeployKey: v.string(),
  }).index("by_app", ["appId"]),

  vercelProjects: defineTable({
    appId: v.id("apps"),
    projectId: v.string(),
    projectName: v.string(),
    teamId: v.optional(v.string()),
    deploymentUrl: v.optional(v.string()),
  }).index("by_app", ["appId"]),
});
