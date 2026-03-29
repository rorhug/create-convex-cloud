import GitHub from "@auth/core/providers/github";
import { convexAuth } from "@convex-dev/auth/server";
import ConvexPlatform from "./providers/convexPlatform";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
      authorization: {
        params: {
          scope: "repo delete_repo read:user user:email",
        },
      },
      profile(
        profile: Record<string, unknown>,
        tokens: { access_token?: string },
      ) {
        return {
          id: String(profile.id ?? profile.sub),
          name: (profile.name as string) ?? (profile.login as string) ?? null,
          email: (profile.email as string) ?? null,
          image: (profile.avatar_url as string) ?? null,
          githubAccessToken: tokens.access_token ?? null,
          githubUsername: (profile.login as string) ?? null,
        };
      },
    }),
    ConvexPlatform({
      clientId: process.env.AUTH_CONVEX_ID!,
      clientSecret: process.env.AUTH_CONVEX_SECRET!,
    }),
  ],
  callbacks: {
    // todo : this needs to be updated anyway because accounts are not linking
    // createOrUpdateUser(ctx, args) {
    //   const { id, email, emailVerified, name, image } = args.profile;
    //   const newArgs = {
    //     ...args,
    //     profile: {
    //       id,
    //       email,
    //       emailVerified,
    //       name,
    //       image,
    //     },
    //   };
    //   // return super.createOrUpdateUser(ctx, newArgs);
    //   // defaultCreateOrUpdateUser;
    // },
    async afterUserCreatedOrUpdated(ctx, { userId, type, profile }) {
      if (type !== "oauth") return;

      const githubAccessToken = profile.githubAccessToken as string | undefined;
      const githubUsername = profile.githubUsername as string | undefined;
      if (githubAccessToken) {
        await ctx.db.patch(userId, {
          githubAccessToken,
          githubUsername: githubUsername ?? undefined,
        });
      }

      const convexAccessToken = profile.convexAccessToken as string | undefined;
      const convexTeamId = profile.convexTeamId as string | undefined;
      if (convexAccessToken && convexTeamId) {
        const existingConvexToken = await ctx.db
          .query("convexTokens")
          // @ts-expect-error - for some reason types are not working here
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .first();

        if (existingConvexToken) {
          console.log(
            "updating existing convex token",
            existingConvexToken._id,
            convexAccessToken,
            convexTeamId,
          );
          await ctx.db.patch("convexTokens", existingConvexToken._id, {
            token: convexAccessToken,
            teamId: convexTeamId,
          });
        } else {
          console.log(
            "inserting new convex token",
            userId,
            convexAccessToken,
            convexTeamId,
          );
          await ctx.db.insert("convexTokens", {
            userId,
            token: convexAccessToken,
            teamId: convexTeamId,
          });
        }
      }
    },
  },
});
