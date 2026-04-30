import { v } from "convex/values";
import { internalMutation, internalQuery } from "../../../_generated/server";

export const upsertGithubPagesPreference = internalMutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("githubPagesPreferences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { confirmedAt: Date.now() });
      return null;
    }
    await ctx.db.insert("githubPagesPreferences", {
      userId: args.userId,
      confirmedAt: Date.now(),
    });
    return null;
  },
});

export const getGithubPagesPreferenceForUser = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    v.object({
      confirmedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const pref = await ctx.db
      .query("githubPagesPreferences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (!pref) return null;
    return { confirmedAt: pref.confirmedAt };
  },
});
