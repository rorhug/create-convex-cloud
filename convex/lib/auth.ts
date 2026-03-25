import { getAuthUserId } from "@convex-dev/auth/server";
import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";

type AuthCtx = QueryCtx | MutationCtx | ActionCtx;

export async function requireCurrentUserId(ctx: AuthCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error("Not authenticated");
  }
  return userId;
}

export async function requireCurrentUser(ctx: QueryCtx | MutationCtx) {
  const userId = await requireCurrentUserId(ctx);
  const user = await ctx.db.get(userId);
  if (user === null) {
    throw new Error("User not found");
  }
  return user;
}
