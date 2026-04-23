import { internal } from "../../../_generated/api";
import type { ActionCtx } from "../../../_generated/server";
import { createManagementClient } from "@convex-dev/platform";

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

async function maybeMarkConvexTokenInvalid(ctx: TokenInvalidationCtx | undefined, token: string, error: unknown) {
  if (ctx && isConvexTokenInvalidError(error)) {
    await ctx.runMutation(internal.lib.providers.convex.data.markConvexTokenInvalid, {
      token: token.trim(),
    });
  }
}

export async function unwrapConvexPlatformResult<T>(
  ctx: TokenInvalidationCtx | undefined,
  token: string,
  result: { data: T; error?: never; response: Response } | { data?: never; error: unknown; response: Response },
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
  result: { data?: unknown; error?: never; response: Response } | { data?: never; error: unknown; response: Response },
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
    return message.includes("invalid or expired") || message.includes("unauthorized") || message.includes("forbidden");
  }
  return false;
}

type ParsedConvexDeployKey =
  | {
      kind: "deployment";
      deploymentName: string;
    }
  | {
      kind: "project";
      teamSlug: string;
      projectSlug: string;
    };

export type ResolvedConvexProject = {
  projectId: string;
  teamSlug: string;
  projectSlug: string;
  prodDeploymentName: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function readStringField(value: unknown, key: string): string | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  const field = record[key];
  if (typeof field === "string" && field.trim().length > 0) {
    return field.trim();
  }
  if (typeof field === "number" && Number.isFinite(field)) {
    return String(field);
  }
  return null;
}

function readProjectId(value: unknown): string | null {
  return readStringField(value, "projectId") ?? readStringField(value, "id");
}

function parseConvexDeployKey(deployKey: string): ParsedConvexDeployKey | null {
  console.log("deployKey", deployKey);
  const prefix = deployKey.trim().split("|")[0];
  if (!prefix) {
    return null;
  }

  if (prefix.startsWith("prod:") || prefix.startsWith("dev:")) {
    const deploymentName = prefix.slice(prefix.indexOf(":") + 1).trim();
    if (!deploymentName) {
      return null;
    }
    return {
      kind: "deployment",
      deploymentName,
    };
  }

  if (prefix.startsWith("preview:") || prefix.startsWith("project:")) {
    const parts = prefix.split(":");
    if (parts.length < 3) {
      return null;
    }
    const teamSlug = parts[1]?.trim();
    const projectSlug = parts[2]?.trim();
    if (!teamSlug || !projectSlug) {
      return null;
    }
    return {
      kind: "project",
      teamSlug,
      projectSlug,
    };
  }

  return null;
}

export async function resolveConvexProjectFromDeployKey(
  token: string,
  deployKey: string,
  ctx?: TokenInvalidationCtx,
): Promise<ResolvedConvexProject> {
  const parsed = parseConvexDeployKey(deployKey);
  if (!parsed) {
    throw new Error("Unsupported Convex deploy key format");
  }

  const convexPlatform = createManagementClient(token.trim());

  if (parsed.kind === "deployment") {
    const deploymentResult = await convexPlatform.GET("/deployments/{deployment_name}", {
      params: { path: { deployment_name: parsed.deploymentName } },
    });
    const deployment = await unwrapConvexPlatformResult(
      ctx,
      token,
      deploymentResult,
      "Failed to load Convex deployment",
    );
    const projectId = readProjectId(deployment);
    if (!projectId) {
      throw new Error("Convex deployment details are missing a project ID");
    }

    const numericProjectId = Number(projectId);
    if (!Number.isFinite(numericProjectId)) {
      throw new Error(`Convex project ID is not numeric: ${projectId}`);
    }

    const projectResult = await convexPlatform.GET("/projects/{project_id}", {
      params: { path: { project_id: numericProjectId } },
    });
    const project = await unwrapConvexPlatformResult(ctx, token, projectResult, "Failed to load Convex project");
    const teamSlug = readStringField(project, "teamSlug");
    const projectSlug = readStringField(project, "slug");
    if (!teamSlug || !projectSlug) {
      throw new Error("Convex project details are missing teamSlug or slug");
    }

    return {
      projectId,
      teamSlug,
      projectSlug,
      prodDeploymentName: parsed.deploymentName,
    };
  }

  const projectResult = await convexPlatform.GET("/teams/{team_id_or_slug}/projects/{project_slug}", {
    params: {
      path: {
        team_id_or_slug: parsed.teamSlug,
        project_slug: parsed.projectSlug,
      },
    },
  });
  const project = await unwrapConvexPlatformResult(ctx, token, projectResult, "Failed to load Convex project by slug");
  const projectId = readProjectId(project);
  if (!projectId) {
    throw new Error("Convex project details are missing an ID");
  }

  const deploymentResult = await convexPlatform.GET("/teams/{team_id_or_slug}/projects/{project_slug}/deployment", {
    params: {
      path: {
        team_id_or_slug: parsed.teamSlug,
        project_slug: parsed.projectSlug,
      },
    },
  });
  const deployment = await unwrapConvexPlatformResult(
    ctx,
    token,
    deploymentResult,
    "Failed to load Convex project deployment",
  );
  const prodDeploymentName = readStringField(deployment, "name");
  if (!prodDeploymentName) {
    throw new Error("Convex deployment details are missing a name");
  }

  return {
    projectId,
    teamSlug: readStringField(project, "teamSlug") ?? parsed.teamSlug,
    projectSlug: readStringField(project, "slug") ?? parsed.projectSlug,
    prodDeploymentName,
  };
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
      throw new ConvexPlatformApiError("Convex token is invalid or expired", response.status);
    }

    const data = (await response.json()) as {
      teamId?: number;
      name?: string;
    };
    const teamSlug = extractTeamSlugFromToken(trimmed);
    const teamId = String(data.teamId ?? "");

    if (!teamId) {
      throw new Error("Could not determine team ID from token");
    }

    const teamName = data.name ?? (teamSlug || teamId);

    return { teamId, teamName, teamSlug };
  } catch (error) {
    await maybeMarkConvexTokenInvalid(ctx, trimmed, error);
    throw error;
  }
}
