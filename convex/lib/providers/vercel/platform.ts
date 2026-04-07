"use node";

import { Vercel } from "@vercel/sdk";
import type { VercelTeam } from "./data";

export function createVercelClient(bearerToken: string): Vercel {
  return new Vercel({ bearerToken: bearerToken.trim() });
}

export async function fetchVercelTeamsForToken(token: string): Promise<VercelTeam[]> {
  const trimmed = token.trim();
  if (trimmed.length < 10) {
    throw new Error("Vercel token looks too short");
  }

  const client = createVercelClient(trimmed);
  const teams: VercelTeam[] = [];
  let until: number | undefined;
  try {
    for (;;) {
      const page = await client.teams.getTeams({ limit: 100, until });
      for (const team of page.teams) {
        teams.push({
          id: team.id,
          name: team.name ?? team.slug,
          slug: team.slug,
        });
      }
      if (page.pagination.next === null) break;
      until = page.pagination.next;
    }
  } catch {
    throw new Error("Vercel token is invalid or expired");
  }

  if (teams.length === 0) {
    throw new Error("No Vercel teams found for this token. Check token access or your Vercel account.");
  }

  return teams;
}

export function getVercelErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }
  if (error && typeof error === "object") {
    const maybeMessage = Reflect.get(error, "message");
    if (typeof maybeMessage === "string" && maybeMessage.trim().length > 0) {
      return maybeMessage.trim();
    }
  }
  return "Unknown Vercel error";
}

export function isRetryableVercelGitError(error: unknown): boolean {
  const message = getVercelErrorMessage(error).toLowerCase();
  return (
    message.includes("try again later") ||
    message.includes("unable to find github repository") ||
    message.includes("could not create project") ||
    message.includes("internal_server_error")
  );
}

export async function sleepMs(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
