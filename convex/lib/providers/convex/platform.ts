export function extractTeamSlugFromToken(accessToken: string): string {
  const match = accessToken.match(/^team:([^|]+)\|/);
  return match?.[1] ?? "";
}

export async function getConvexTokenDetails(token: string): Promise<{
  teamId: string;
  teamName: string;
  teamSlug: string;
}> {
  const trimmed = token.trim();
  if (trimmed.length < 10) {
    throw new Error("Token looks too short");
  }

  const response = await fetch("https://api.convex.dev/v1/token_details", {
    headers: {
      Authorization: `Bearer ${trimmed}`,
    },
  });

  if (!response.ok) {
    throw new Error("Convex token is invalid or expired");
  }

  const data = (await response.json()) as {
    teamId?: number;
    name?: string;
  };
  const teamSlug = extractTeamSlugFromToken(trimmed);
  const teamId = teamSlug || String(data.teamId ?? "");
  const teamName = data.name ?? teamId;

  if (!teamId) {
    throw new Error("Could not determine team ID from token");
  }

  return { teamId, teamName, teamSlug };
}
