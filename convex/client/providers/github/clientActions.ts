"use node";

import { v } from "convex/values";
import { action } from "../../../_generated/server";
import { internal } from "../../../_generated/api";
import { requireCurrentUserId } from "../../../lib/auth";
import { githubInstallationValidator } from "../../../lib/providers/github/data";
import type { GithubInstallation } from "../../../lib/providers/github/platform";

export const refreshGithubInstallations = action({
  args: {},
  returns: v.object({
    installations: v.array(githubInstallationValidator),
  }),
  handler: async (ctx): Promise<{ installations: GithubInstallation[] }> => {
    const userId = await requireCurrentUserId(ctx);
    return await ctx.runAction(internal.workflows.githubAccessTokenAction.refreshGithubInstallations, {
      userId,
    });
  },
});
