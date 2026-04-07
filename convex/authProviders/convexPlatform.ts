import type { OAuthConfig, OAuthUserConfig } from "@auth/core/providers";
import { extractTeamSlugFromToken } from "../lib/providers/convex/platform";

interface ConvexPlatformUserInfo {
  sub?: string;
  teamId?: number | string;
  team_id?: number | string;
  name?: string;
  [claim: string]: unknown;
}

export type ConvexPlatformProfile = {
  convexAccessToken?: string | null;
  convexTeamId?: string | null;
  email?: string | null;
  id?: string;
  image?: string | null;
  name?: string | null;
};

export default function ConvexPlatform(
  config: OAuthUserConfig<ConvexPlatformUserInfo> = {},
): OAuthConfig<ConvexPlatformUserInfo> {
  return {
    id: "convex",
    name: "Convex",
    type: "oauth",
    authorization: {
      url: "https://dashboard.convex.dev/oauth/authorize/team",
      params: {
        response_type: "code",
      },
    },
    token: {
      url: "https://api.convex.dev/oauth/token",
    },
    client: {
      token_endpoint_auth_method: "client_secret_post",
    },
    userinfo: {
      url: "https://api.convex.dev/v1/token_details",
    },
    checks: ["pkce", "state"],
    profile(profile, tokens) {
      const accessToken = tokens.access_token ?? "";
      const teamId =
        profile.teamId !== undefined
          ? String(profile.teamId)
          : profile.team_id !== undefined
            ? String(profile.team_id)
            : "";
      const teamSlug = extractTeamSlugFromToken(accessToken);

      if (!teamId) {
        throw new Error("Could not determine team ID from Convex OAuth");
      }

      return {
        id: `convex-team-${teamId}`,
        name:
          (typeof profile.name === "string" && profile.name) ||
          (teamSlug ? `Convex Team ${teamSlug}` : `Convex Team ${teamId}`),
        email: null,
        image: null,
        convexAccessToken: accessToken,
        convexTeamId: teamId,
      };
    },
    style: {
      brandColor: "#8B5CF6",
      logo: "https://convex.dev/favicon.ico",
    },
    options: config,
  };
}
