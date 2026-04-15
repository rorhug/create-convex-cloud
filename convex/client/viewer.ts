import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireCurrentUser } from "../lib/auth";
import { getViewerState } from "../lib/onboarding";

const teamValidator = v.object({
  id: v.string(),
  name: v.optional(v.string()),
  slug: v.string(),
});

const githubInstallationValidator = v.object({
  id: v.string(),
  accountLogin: v.string(),
  accountName: v.optional(v.string()),
  accountType: v.string(),
  accountAvatarUrl: v.optional(v.string()),
  repositorySelection: v.string(),
});

const viewerStateValidator = v.object({
  user: v.object({
    name: v.union(v.string(), v.null()),
    email: v.union(v.string(), v.null()),
    image: v.union(v.string(), v.null()),
    githubUsername: v.union(v.string(), v.null()),
  }),
  github: v.object({
    installations: v.array(githubInstallationValidator),
    installUrl: v.string(),
    needsAttention: v.boolean(),
    issue: v.union(v.string(), v.null()),
  }),
  vercel: v.union(
    v.object({
      teams: v.array(teamValidator),
      tokenPreview: v.string(),
      isValid: v.boolean(),
      issue: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  convex: v.union(
    v.object({
      teamId: v.string(),
      tokenPreview: v.string(),
      isValid: v.boolean(),
      issue: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  onboarding: v.object({
    hasGitHubConnection: v.boolean(),
    hasVercelConnection: v.boolean(),
    hasConvexToken: v.boolean(),
    canAccessApps: v.boolean(),
    requiredActions: v.array(v.string()),
  }),
});

export const getViewer = query({
  args: {},
  returns: viewerStateValidator,
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    return await getViewerState(ctx, user);
  },
});
