import GitHub from "@auth/core/providers/github";
import { accessTokenExpiresAtMsFromOAuthTokens } from "../lib/providers/github/platform";

export type GithubProfileWithTokens = {
  /**
   * Convex Auth strips `id` from the profile before `createOrUpdateUser` (it becomes
   * `providerAccountId` on the OAuth path). Duplicate the GitHub user id here so it
   * still reaches our callback.
   */
  githubUserId?: string;
  id?: string;
  email: string | null;
  accessToken?: string;
  /** Unix ms when accessToken expires, if GitHub/Auth.js provided expiry. */
  accessTokenExpiresAt?: number;
  refreshToken?: string;
  githubUsername?: string | null;
  image: string;
  name: string;
  username: string;
};

export default function GitHubProvider() {
  return GitHub({
    allowDangerousEmailAccountLinking: false,
    clientId: process.env.AUTH_GITHUB_ID!,
    clientSecret: process.env.AUTH_GITHUB_SECRET!,
    profile(profile, tokens): GithubProfileWithTokens {
      const accessToken = tokens.access_token;
      const refreshToken = tokens.refresh_token;
      const accessTokenExpiresAt = accessTokenExpiresAtMsFromOAuthTokens(tokens);

      const githubUserId = String(profile.id);
      return {
        id: githubUserId,
        githubUserId,
        name: profile.name ?? profile.login,
        username: profile.login,
        email: profile.email,
        image: profile.avatar_url,
        accessToken,
        accessTokenExpiresAt,
        refreshToken,
      };
    },
  });
}
