import { v } from "convex/values";
import { mutation } from "../../../_generated/server";
import { requireCurrentUserId } from "../../../lib/auth";
import { getGithubTokenDocForUser } from "../../../lib/providers/github/data";

/**
 * Public mutation: record the user's choice to deploy via GitHub Pages.
 * No external API call is needed — the GitHub App installed in Step 1 already
 * grants the access we need; this just persists the preference so the per-app
 * picker on /apps can default to it.
 */
export const confirmGithubPagesDeployment = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await requireCurrentUserId(ctx);

    // Sanity: we should only be able to confirm if the GitHub App is actually
    // installed. The UI button is gated, but enforce server-side too.
    const githubToken = await getGithubTokenDocForUser(ctx, userId);
    const installations = githubToken?.installations ?? [];
    if (installations.length === 0) {
      throw new Error("Install the GitHub App in Step 1 first.");
    }
    if (githubToken?.tokenStatus === "invalid") {
      throw new Error("GitHub access needs attention. Sign in with GitHub again.");
    }

    const existing = await ctx.db
      .query("githubPagesPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { confirmedAt: Date.now() });
    } else {
      await ctx.db.insert("githubPagesPreferences", {
        userId,
        confirmedAt: Date.now(),
      });
    }
    return null;
  },
});
