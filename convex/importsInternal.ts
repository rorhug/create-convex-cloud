import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { existingProjectInputValidator, importSearchStatusValidator } from "./lib/imports";

export const setExistingProjectSearchState = internalMutation({
  args: {
    userId: v.id("users"),
    status: importSearchStatusValidator,
    message: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("existingProjectSearches")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.userId))
      .first();

    const patch = {
      status: args.status,
      updatedAt: Date.now(),
      ...(args.message !== undefined ? { message: args.message } : {}),
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return null;
    }

    await ctx.db.insert("existingProjectSearches", {
      ownerId: args.userId,
      ...patch,
    });
    return null;
  },
});

export const replaceExistingProjectsForUser = internalMutation({
  args: {
    userId: v.id("users"),
    rows: v.array(existingProjectInputValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existingRows = await ctx.db
      .query("existingProjects")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.userId))
      .collect();
    for (const row of existingRows) {
      await ctx.db.delete(row._id);
    }

    const scannedAt = Date.now();
    for (const row of args.rows) {
      const cleanRow = Object.fromEntries(
        Object.entries(row).filter(([, value]) => value !== undefined),
      ) as typeof row;
      await ctx.db.insert("existingProjects", {
        ownerId: args.userId,
        scannedAt,
        ...cleanRow,
      });
    }
    return null;
  },
});
