import type { OAuthConfig, OAuthUserConfig } from "@auth/core/providers";
import type { User } from "@auth/core/types";

export interface VercelProfile {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  preferred_username?: string;
  picture?: string;
  [claim: string]: unknown;
}

export default function Vercel(
  config: OAuthUserConfig<VercelProfile> = {},
): OAuthConfig<VercelProfile> {
  return {
    id: "vercel",
    name: "Vercel",
    type: "oidc",
    issuer: "https://vercel.com",
    authorization: {
      url: "https://vercel.com/oauth/authorize",
      params: {
        scope: "openid email profile offline_access",
      },
    },
    token: "https://api.vercel.com/login/oauth/token",
    userinfo: "https://api.vercel.com/login/oauth/userinfo",
    checks: ["pkce", "state", "nonce"],
    profile(profile) {
      return {
        id: profile.sub,
        name: profile.name ?? profile.preferred_username ?? profile.email ?? "Vercel",
        email: profile.email ?? null,
        image: profile.picture ?? null,
        vercelUserId: profile.sub,
        vercelEmail: profile.email ?? null,
        vercelName: profile.name ?? null,
        vercelUsername: profile.preferred_username ?? null,
        vercelAvatarUrl: profile.picture ?? null,
      } satisfies User & {
        vercelUserId: string;
        vercelEmail: string | null;
        vercelName: string | null;
        vercelUsername: string | null;
        vercelAvatarUrl: string | null;
      };
    },
    style: {
      brandColor: "#000000",
      logo: "https://assets.vercel.com/image/upload/front/favicon/vercel/180x180.png",
    },
    options: config,
  };
}
