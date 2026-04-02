import GitHub, { GitHubProfile } from "@auth/core/providers/github";

// export type GitHubOAuthProfile = {
//   id?: string | number;
//   email?: string;
//   githubAccessToken?: string | null;
//   githubUsername?: string | null;
//   image?: string;
//   name?: string;
// };

export type GithubProfileWithTokens = {
  id: string;
  email: string | null;
  accessToken?: string;
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
      return {
        id: String(profile.id),
        name: profile.name ?? profile.login,
        username: profile.login,
        email: profile.email,
        image: profile.avatar_url,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      };
    },
  });
}
