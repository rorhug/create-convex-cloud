import { internal } from "../../../_generated/api";
import type { ActionCtx } from "../../../_generated/server";

export function extractTeamSlugFromToken(accessToken: string): string {
  const match = accessToken.match(/^team:([^|]+)\|/);
  return match?.[1] ?? "";
}

export class ConvexPlatformApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ConvexPlatformApiError";
  }
}

export function formatConvexPlatformError(response: Response, error: unknown) {
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object") {
    return JSON.stringify(error);
  }
  return response.statusText || `Request failed with status ${response.status}`;
}

type TokenInvalidationCtx = Pick<ActionCtx, "runMutation">;

async function maybeMarkConvexTokenInvalid(
  ctx: TokenInvalidationCtx | undefined,
  token: string,
  error: unknown,
) {
  if (ctx && isConvexTokenInvalidError(error)) {
    await ctx.runMutation(internal.lib.providers.convex.data.markConvexTokenInvalid, {
      token: token.trim(),
    });
  }
}

export async function unwrapConvexPlatformResult<T>(
  ctx: TokenInvalidationCtx | undefined,
  token: string,
  result:
    | { data: T; error?: never; response: Response }
    | { data?: never; error: unknown; response: Response },
  message: string,
): Promise<T> {
  if ("error" in result && result.error !== undefined) {
    const error = new ConvexPlatformApiError(
      `${message}: ${formatConvexPlatformError(result.response, result.error)}`,
      result.response.status,
    );
    await maybeMarkConvexTokenInvalid(ctx, token, error);
    throw error;
  }
  if (result.data === undefined) {
    throw new Error(`${message}: Missing response data`);
  }
  return result.data;
}

export async function assertConvexPlatformResultOk(
  ctx: TokenInvalidationCtx | undefined,
  token: string,
  result:
    | { data?: unknown; error?: never; response: Response }
    | { data?: never; error: unknown; response: Response },
  message: string,
): Promise<void> {
  if ("error" in result && result.error !== undefined) {
    const error = new ConvexPlatformApiError(
      `${message}: ${formatConvexPlatformError(result.response, result.error)}`,
      result.response.status,
    );
    await maybeMarkConvexTokenInvalid(ctx, token, error);
    throw error;
  }
}

export function isConvexTokenInvalidError(error: unknown): boolean {
  if (error instanceof ConvexPlatformApiError) {
    return error.status === 401 || error.status === 403;
  }
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("invalid or expired") ||
      message.includes("unauthorized") ||
      message.includes("forbidden")
    );
  }
  return false;
}

export async function getConvexTokenDetails(
  token: string,
  ctx?: TokenInvalidationCtx,
): Promise<{
  teamId: string;
  teamName: string;
  teamSlug: string;
}> {
  const trimmed = token.trim();
  if (trimmed.length < 10) {
    throw new Error("Token looks too short");
  }

  try {
    const response = await fetch("https://api.convex.dev/v1/token_details", {
      headers: {
        Authorization: `Bearer ${trimmed}`,
      },
    });

    if (!response.ok) {
      throw new ConvexPlatformApiError(
        "Convex token is invalid or expired",
        response.status,
      );
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
  } catch (error) {
    await maybeMarkConvexTokenInvalid(ctx, trimmed, error);
    throw error;
  }
}
