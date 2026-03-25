import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireCurrentUser } from "./lib/auth";
import { createAppForUser, listAppsForUser } from "./lib/onboarding";

const appValidator = v.object({
  _id: v.id("apps"),
  name: v.string(),
  createdAt: v.number(),
});

export const listApps = query({
  args: {},
  returns: v.array(appValidator),
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    ensureAppsUnlocked(user);

    const apps = await listAppsForUser(ctx, user._id);
    return apps.map((app) => ({
      _id: app._id,
      name: app.name,
      createdAt: app.createdAt,
    }));
  },
});

export const createApp = mutation({
  args: {
    name: v.string(),
  },
  returns: v.id("apps"),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    ensureAppsUnlocked(user);
    return await createAppForUser(ctx, user._id, args.name);
  },
});

function ensureAppsUnlocked(user: {
  vercelUserId?: string;
  convexTeamAccessToken?: string;
  convexTeamId?: string;
}) {
  if (!user.vercelUserId) {
    throw new Error("Connect your Vercel account before using apps");
  }
  if (!user.convexTeamAccessToken || !user.convexTeamId) {
    throw new Error("Save a Convex team access token before using apps");
  }
}
