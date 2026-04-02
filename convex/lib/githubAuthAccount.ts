import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export async function findGithubAuthAccountForUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<Doc<"authAccounts"> | null> {
  return await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) => q.eq("userId", userId).eq("provider", "github"))
    .unique();
}

/**
 * GitHub OAuth token row for this user: resolve `authAccounts.providerAccountId` (GitHub user id string),
 * then load `githubTokens` by `githubUserId`.
 */
export async function getGithubTokenDocForUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<Doc<"githubTokens"> | null> {
  const account = await findGithubAuthAccountForUser(ctx, userId);
  if (account === null) return null;
  return await ctx.db
    .query("githubTokens")
    .withIndex("by_github_user_id", (q) => q.eq("githubUserId", account.providerAccountId))
    .first();
}
