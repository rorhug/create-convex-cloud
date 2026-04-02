import GitHub from "@auth/core/providers/github";
import { accessTokenExpiresAtMsFromOAuthTokens } from "../lib/githubAccessToken";

// export type GitHubOAuthProfile = {
//   id?: string | number;
//   email?: string;
//   githubAccessToken?: string | null;
//   githubUsername?: string | null;
//   image?: string;
//   name?: string;
// };

export type GithubProfileWithTokens = {
  /**
   * Convex Auth strips `id` from the profile before `createOrUpdateUser` (it becomes
   * `providerAccountId` on the OAuth path). Duplicate the GitHub user id here so it
   * still reaches our callback — see `@convex-dev/auth` OAuth callback `profileFromCallback`.
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
    clientId: process.env.AUTH_GITHUB_ID!,
    clientSecret: process.env.AUTH_GITHUB_SECRET!,
    authorization: {
      params: {
        scope: "repo delete_repo read:user user:email",
      },
    },
    // profile(profile, tokens) {
    //   return {
    //     ...profile,
    //     id: String(profile.id),
    //     githubAccessToken: tokens.access_token ?? null,
    //     githubUsername: typeof profile.login === "string" ? profile.login : null,
    //   };
    // },
    profile(profile, tokens): GithubProfileWithTokens {
      const accessToken = tokens.access_token;
      const refreshToken = tokens.refresh_token;
      const accessTokenExpiresAt = accessTokenExpiresAtMsFromOAuthTokens(tokens);
      console.log("[GitHub OAuth profile]", {
        githubUserId: profile.id,
        login: profile.login,
        hasAccessToken: typeof accessToken === "string" && accessToken.length > 0,
        accessTokenLength: typeof accessToken === "string" ? accessToken.length : 0,
        hasRefreshToken: typeof refreshToken === "string" && refreshToken.length > 0,
        refreshTokenLength: typeof refreshToken === "string" ? refreshToken.length : 0,
        accessTokenExpiresAtMs: accessTokenExpiresAt ?? null,
        tokenResponseKeys: tokens && typeof tokens === "object" ? Object.keys(tokens as object) : [],
      });

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
