import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    vercelUserId: v.optional(v.string()),
    vercelEmail: v.optional(v.string()),
    vercelName: v.optional(v.string()),
    vercelUsername: v.optional(v.string()),
    vercelAvatarUrl: v.optional(v.string()),
    convexTeamId: v.optional(v.string()),
    convexTeamAccessToken: v.optional(v.string()),
  }).index("email", ["email"]),
  apps: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    createdAt: v.number(),
  }).index("by_owner", ["ownerId"]),
});
