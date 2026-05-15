"use node";

import { v } from "convex/values";
import { internal } from "../../../_generated/api";
import { userAction } from "../../../functions";
import { githubInstallationValidator } from "../../../lib/providers/github/data";
import type { GithubInstallation } from "../../../lib/providers/github/platform";

export const refreshGithubInstallations = userAction({
  args: {},
  returns: v.object({
    installations: v.array(githubInstallationValidator),
  }),
  handler: async (ctx): Promise<{ installations: GithubInstallation[] }> => {
    return await ctx.runAction(internal.workflows.githubAccessTokenAction.refreshGithubInstallations, {
      userId: ctx.userId,
    });
  },
});
