import type { OAuthConfig, OAuthUserConfig } from "@auth/core/providers";

export interface ConvexPlatformProfile {
  sub: string;
  teamId: string;
  [claim: string]: unknown;
}

function extractTeamFromToken(accessToken: string): string {
  // Token format: "team:my-team|AAAAAA=="
  const match = accessToken.match(/^team:([^|]+)\|/);
  return match?.[1] ?? "";
}

export default function ConvexPlatform(
  config: OAuthUserConfig<ConvexPlatformProfile> = {},
): OAuthConfig<ConvexPlatformProfile> {
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
      console.log("Convex OAuth profile callback:", {
        profileKeys: Object.keys(profile),
        profile,
        hasAccessToken: Boolean(tokens.access_token),
      });

      const accessToken = tokens.access_token ?? "";
      const teamSlug = extractTeamFromToken(accessToken);

      // Try multiple possible field names from token_details
      const teamId =
        teamSlug ||
        ((profile.teamId as string) ??
        (profile.team_id as string) ??
        (profile.sub as string) ??
        "");

      if (!teamId) {
        throw new Error("Could not determine team ID from Convex OAuth");
      }

      return {
        id: `convex-team-${teamId}`,
        name: `Convex Team ${teamId}`,
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
