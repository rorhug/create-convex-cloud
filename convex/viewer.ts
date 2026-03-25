import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { requireCurrentUser, requireCurrentUserId } from "./lib/auth";
import { getViewerState } from "./lib/onboarding";

const viewerStateValidator = v.object({
  user: v.object({
    name: v.union(v.string(), v.null()),
    email: v.union(v.string(), v.null()),
    image: v.union(v.string(), v.null()),
  }),
  vercel: v.union(
    v.object({
      name: v.union(v.string(), v.null()),
      email: v.union(v.string(), v.null()),
      username: v.union(v.string(), v.null()),
      avatarUrl: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  convex: v.union(
    v.object({
      teamId: v.string(),
      tokenPreview: v.string(),
    }),
    v.null(),
  ),
  onboarding: v.object({
    hasGitHubConnection: v.boolean(),
    hasVercelConnection: v.boolean(),
    hasConvexTeamAccessToken: v.boolean(),
    canAccessApps: v.boolean(),
  }),
});

export const getViewer = query({
  args: {},
  returns: viewerStateValidator,
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    return getViewerState(user);
  },
});

export const saveConvexTeamAccessToken = mutation({
  args: {
    token: v.string(),
    teamId: v.string(),
  },
  returns: v.object({
    teamId: v.string(),
    tokenPreview: v.string(),
  }),
  handler: async (ctx, args) => {
    const userId = await requireCurrentUserId(ctx);
    const token = args.token.trim();
    const teamId = args.teamId.trim();

    if (token.length < 10) {
      throw new Error("Convex team access token looks too short");
    }
    if (teamId.length === 0) {
      throw new Error("Missing Convex team ID");
    }

    await ctx.db.patch(userId, {
      convexTeamAccessToken: token,
      convexTeamId: teamId,
    });

    return {
      teamId,
      tokenPreview: `${token.slice(0, 4)}...${token.slice(-4)}`,
    };
  },
});

export const verifyConvexTeamAccessToken = action({
  args: {
    token: v.string(),
  },
  returns: v.object({
    teamId: v.string(),
    projectCount: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireCurrentUserId(ctx);
    const token = args.token.trim();
    if (token.length < 10) {
      throw new Error("Convex team access token looks too short");
    }

    const tokenDetailsResponse = await fetch(
      "https://api.convex.dev/v1/token_details",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!tokenDetailsResponse.ok) {
      throw new Error("Convex team access token is invalid");
    }

    const tokenDetails = (await tokenDetailsResponse.json()) as Record<
      string,
      unknown
    >;
    const teamId = getFirstString(tokenDetails, ["teamId", "team_id"]);

    if (!teamId) {
      throw new Error("Convex did not return a team ID for this token");
    }

    const projectsResponse = await fetch(
      `https://api.convex.dev/v1/teams/${teamId}/list_projects`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!projectsResponse.ok) {
      throw new Error("Convex token could not list projects for its team");
    }

    const projectsPayload = (await projectsResponse.json()) as unknown;

    return {
      teamId,
      projectCount: countProjects(projectsPayload),
    };
  },
});

function getFirstString(
  value: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }
  }
  return null;
}

function countProjects(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload.length;
  }

  if (payload && typeof payload === "object") {
    const projects = (payload as { projects?: unknown }).projects;
    if (Array.isArray(projects)) {
      return projects.length;
    }
  }

  return 0;
}
