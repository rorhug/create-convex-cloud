import { convexAuth } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import ConvexPlatform, { type ConvexPlatformProfile } from "./authProviders/convexPlatform";
import GitHubProvider, { type GithubProfileWithTokens } from "./authProviders/github";
import {
  getGithubTokenDocForUser,
  githubTokenFieldsFromProfile,
  upsertGithubTokenForGithubUser,
} from "./lib/providers/github/data";
import { upsertConvexToken } from "./lib/providers/convex/data";
import { extractTeamSlugFromToken } from "./lib/providers/convex/platform";
import { fetchGithubInstallationsForAccessToken } from "./lib/providers/github/platform";

type CreateOrUpdateUserArgs = {
  existingUserId: Id<"users"> | null;
  authUserId: Id<"users"> | null;
  profile: Record<string, unknown>;
  provider: { id: string };
  type: "oauth" | "credentials" | "email" | "phone" | "verification";
};

async function upsertConvexTokenFromProfile(ctx: MutationCtx, profile: ConvexPlatformProfile) {
  const token = profile.convexAccessToken;
  const teamId = profile.convexTeamId;
  if (typeof token !== "string" || token.length === 0 || typeof teamId !== "string" || teamId.length === 0) {
    throw new Error("Convex OAuth did not return the expected team token");
  }
  const providerAccountId = `convex-team-${teamId}`;
  const teamSlug =
    typeof profile.convexTeamSlug === "string" ? profile.convexTeamSlug : extractTeamSlugFromToken(token);

  await upsertConvexToken(ctx, {
    providerAccountId,
    token,
    teamId,
    teamSlug,
  });
}

async function createOrUpdateGithubUser(ctx: MutationCtx, args: CreateOrUpdateUserArgs) {
  const authUserId = args.authUserId;
  const profile = args.profile as GithubProfileWithTokens;

  if (authUserId !== null && args.existingUserId === null) {
    throw new Error("GitHub account linking is not supported. Sign out before connecting a different GitHub account");
  }
  if (authUserId !== null && args.existingUserId !== null && args.existingUserId !== authUserId) {
    throw new Error("This GitHub account is already linked to a different user. Sign out first to switch accounts");
  }

  const userDoc = {
    email: profile.email ?? undefined,
    image: profile.image ?? undefined,
    name: profile.name ?? undefined,
  };
  const userId = args.existingUserId ?? (await ctx.db.insert("users", userDoc));

  if (args.existingUserId !== null) {
    await ctx.db.patch(args.existingUserId, userDoc);
  }

  const tokenFields = githubTokenFieldsFromProfile(profile);
  let installations = undefined;
  try {
    installations = await fetchGithubInstallationsForAccessToken(tokenFields.accessToken);
  } catch (error) {
    const existingToken = await getGithubTokenDocForUser(ctx, userId);
    installations = existingToken?.installations ?? [];
    console.error("Failed to refresh GitHub installations during sign-in:", error);
  }

  await upsertGithubTokenForGithubUser(ctx, {
    ...tokenFields,
    installations,
  });
  return userId;
}

async function createOrUpdateConvexUser(ctx: MutationCtx, args: CreateOrUpdateUserArgs) {
  const authUserId = args.authUserId;
  const profile = args.profile as ConvexPlatformProfile;

  if (authUserId === null) {
    throw new Error("Sign in with GitHub before linking a Convex account");
  }
  if (args.existingUserId !== null && args.existingUserId !== authUserId) {
    throw new Error("This Convex account is already linked to a different user");
  }

  await upsertConvexTokenFromProfile(ctx, profile);
  return authUserId;
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    GitHubProvider(),
    ConvexPlatform({
      clientId: process.env.AUTH_CONVEX_ID!,
      clientSecret: process.env.AUTH_CONVEX_SECRET!,
    }),
  ],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      if (args.type !== "oauth") {
        throw new Error("Only OAuth authentication is supported");
      }
      switch (args.provider.id) {
        case "github":
          return await createOrUpdateGithubUser(ctx, args);
        case "convex":
          return await createOrUpdateConvexUser(ctx, args);
        default:
          throw new Error(`Unsupported auth provider: ${args.provider.id}`);
      }
    },
  },
});
