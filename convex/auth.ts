import GitHub from "@auth/core/providers/github";
import { convexAuth } from "@convex-dev/auth/server";

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
      profile(profile: Record<string, unknown>, tokens: { access_token?: string }) {
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
  ],
  callbacks: {
    async afterUserCreatedOrUpdated(ctx, { userId, type, profile }) {
      if (type !== "oauth") return;

      const githubAccessToken = profile.githubAccessToken as
        | string
        | undefined;
      const githubUsername = profile.githubUsername as string | undefined;
      if (githubAccessToken) {
        await ctx.db.patch(userId, {
          githubAccessToken,
          githubUsername: githubUsername ?? undefined,
        });
      }
    },
  },
});
