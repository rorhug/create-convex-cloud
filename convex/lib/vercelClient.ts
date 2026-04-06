"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireCurrentUserId } from "./auth";
import { teamValidator } from "../vercel";
import { Vercel } from "@vercel/sdk";

type VercelTeam = { id: string; name: string; slug: string };

export function createVercelClient(bearerToken: string): Vercel {
  return new Vercel({ bearerToken: bearerToken.trim() });
}

async function fetchVercelTeamsForToken(token: string): Promise<VercelTeam[]> {
  const trimmed = token.trim();
  if (trimmed.length < 10) {
    throw new Error("Vercel token looks too short");
  }

  const client = createVercelClient(trimmed);
  const teams: VercelTeam[] = [];
  let until: number | undefined = undefined;
  try {
    for (;;) {
      const page = await client.teams.getTeams({ limit: 100, until });
      for (const t of page.teams) {
        teams.push({
          id: t.id,
          name: t.name ?? t.slug,
          slug: t.slug,
        });
      }
      if (page.pagination.next === null) break;
      until = page.pagination.next;
    }
  } catch {
    throw new Error("Vercel token is invalid or expired");
  }

  if (teams.length === 0) {
    throw new Error("No Vercel teams found for this token. Check token access or your Vercel account.");
  }

  return teams;
}

export const verifyVercelToken = action({
  args: { token: v.string() },
  returns: v.object({
    teams: v.array(teamValidator),
  }),
  handler: async (ctx, args) => {
    await requireCurrentUserId(ctx);
    const teams = await fetchVercelTeamsForToken(args.token);
    return { teams };
  },
});

export const saveVercelToken = action({
  args: {
    token: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireCurrentUserId(ctx);
    const teams = await fetchVercelTeamsForToken(args.token);
    await ctx.runMutation(internal.vercel.internalUpsertVercelToken, {
      userId,
      token: args.token,
      teams,
    });
    return null;
  },
});
