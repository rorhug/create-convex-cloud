"use node";

import { internal } from "../../../_generated/api";
import type { ActionCtx } from "../../../_generated/server";
import type { VercelTeam } from "./data";
import { VERCEL_GITHUB_APP_ACCESS_URL } from "../../vercelLinks";

const VERCEL_API_BASE_URL = "https://api.vercel.com";
const VERCEL_REQUEST_TIMEOUT_MS = 10_000;

type VercelProjectEnvironmentVariable = {
  key: string;
  value: string;
  target: string[];
  type: "encrypted";
};

type VercelCreateProjectRequest = {
  name: string;
  framework: "nextjs";
  gitRepository: {
    type: "github";
    repo: string;
  };
  environmentVariables: VercelProjectEnvironmentVariable[];
};

type VercelProjectResponse = {
  id: string;
  name: string;
};

type VercelCreateDeploymentRequest = {
  name: string;
  target: "production";
  gitSource: {
    type: "github";
    org: string;
    repo: string;
    ref: string;
  };
};

type VercelCreateDeploymentResponse = {
  id: string;
};

type VercelDeploymentResponse = {
  readyState: string;
  alias?: string[];
};

type VercelErrorPayload = {
  error?: {
    code?: string;
    message?: string;
  };
  message?: string;
};

type ParsedVercelError = {
  code?: string;
  message: string;
};

type VercelTeamsPage = {
  teams: Array<{
    id: string;
    name?: string | null;
    slug: string;
  }>;
  pagination?: {
    next?: number | null;
  };
};

function buildVercelUrl(path: string, params?: Record<string, string | number | undefined>) {
  const url = new URL(path, VERCEL_API_BASE_URL);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url;
}

async function readVercelError(response: Response) {
  const text = await response.text();
  if (!text.trim()) {
    return {
      message: response.statusText || `Request failed with status ${response.status}`,
    } satisfies ParsedVercelError;
  }
  try {
    const payload = JSON.parse(text) as VercelErrorPayload;
    return {
      code: payload.error?.code,
      message:
        payload.error?.message ??
        payload.message ??
        response.statusText ??
        `Request failed with status ${response.status}`,
    } satisfies ParsedVercelError;
  } catch {
    return { message: text } satisfies ParsedVercelError;
  }
}

export class VercelApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "VercelApiError";
  }
}

type TokenInvalidationCtx = Pick<ActionCtx, "runMutation">;

async function vercelFetch<TResponse>(
  ctx: TokenInvalidationCtx | undefined,
  token: string,
  path: string,
  options?: {
    method?: "GET" | "POST" | "DELETE";
    params?: Record<string, string | number | undefined>;
    body?: unknown;
    timeoutMs?: number;
  },
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options?.timeoutMs ?? VERCEL_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(buildVercelUrl(path, options?.params), {
      method: options?.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        Accept: "application/json",
        ...(options?.body ? { "Content-Type": "application/json" } : {}),
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = await readVercelError(response);
      throw new VercelApiError(error.message, response.status, error.code);
    }

    if (response.status === 204) {
      return undefined as TResponse;
    }

    return (await response.json()) as TResponse;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Vercel request timed out");
    }
    if (ctx && isVercelTokenInvalidError(error)) {
      await ctx.runMutation(internal.lib.providers.vercel.data.markVercelTokenInvalid, {
        token: token.trim(),
      });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchVercelTeamsForToken(token: string, ctx?: TokenInvalidationCtx): Promise<VercelTeam[]> {
  const trimmed = token.trim();
  if (trimmed.length < 10) {
    throw new Error("Vercel token looks too short");
  }

  const teams: VercelTeam[] = [];
  let until: number | undefined;

  for (;;) {
    const page = await vercelFetch<VercelTeamsPage>(ctx, trimmed, "/v2/teams", {
      params: {
        limit: 100,
        until,
      },
    });
    for (const team of page.teams) {
      teams.push({
        id: team.id,
        name: team.name ?? team.slug,
        slug: team.slug,
      });
    }
    if (page.pagination?.next == null) {
      break;
    }
    until = page.pagination.next;
  }

  if (teams.length === 0) {
    throw new Error("No Vercel teams found for this token. Check token access or your Vercel account.");
  }

  return teams;
}

export async function createVercelProject(
  ctx: TokenInvalidationCtx,
  token: string,
  teamId: string,
  requestBody: VercelCreateProjectRequest,
) {
  return await vercelFetch<VercelProjectResponse>(ctx, token, "/v10/projects", {
    method: "POST",
    params: { teamId },
    body: requestBody,
  });
}

export async function createVercelDeployment(
  ctx: TokenInvalidationCtx,
  token: string,
  teamId: string,
  requestBody: VercelCreateDeploymentRequest,
) {
  return await vercelFetch<VercelCreateDeploymentResponse>(ctx, token, "/v13/deployments", {
    method: "POST",
    params: { teamId },
    body: requestBody,
  });
}

export async function getVercelDeployment(
  ctx: TokenInvalidationCtx,
  token: string,
  deploymentId: string,
  teamId: string,
) {
  return await vercelFetch<VercelDeploymentResponse>(
    ctx,
    token,
    `/v13/deployments/${encodeURIComponent(deploymentId)}`,
    {
      params: { teamId },
    },
  );
}

export async function deleteVercelProject(ctx: TokenInvalidationCtx, token: string, projectId: string, teamId: string) {
  await vercelFetch<void>(ctx, token, `/v9/projects/${encodeURIComponent(projectId)}`, {
    method: "DELETE",
    params: { teamId },
  });
}

export function getVercelErrorMessage(error: unknown): string {
  if (error instanceof VercelApiError && error.message.trim().length > 0) {
    return error.message.trim();
  }
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

export function isVercelTokenInvalidError(error: unknown): boolean {
  if (error instanceof VercelApiError) {
    return error.status === 401 || error.status === 403;
  }
  const message = getVercelErrorMessage(error).toLowerCase();
  return message.includes("invalid or expired") || message.includes("unauthorized") || message.includes("forbidden");
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

export { VERCEL_GITHUB_APP_ACCESS_URL } from "../../vercelLinks";

/** Log structured Vercel API errors (status/code/message) for debugging in Convex dashboards. */
export function logVercelErrorDetail(context: string, error: unknown): void {
  if (error instanceof VercelApiError) {
    console.error(`[Vercel] ${context}`, {
      status: error.status,
      code: error.code,
      message: error.message,
    });
    return;
  }
  console.error(`[Vercel] ${context}`, error);
}

export function isVercelGithubAppRepoAccessError(error: unknown): boolean {
  if (!(error instanceof VercelApiError)) {
    return false;
  }
  const message = getVercelErrorMessage(error).toLowerCase();
  // full message from vercel: "To link a GitHub repository, you need to install the GitHub integration first. Make sure there aren't any typos and that you have access to the repository if it's private."
  const isGithub = message.includes("install the github");
  return isGithub;
}

export function formatVercelCreateProjectUserMessage(
  error: unknown,
  context: { teamLabel: string; repoFullName: string },
): string {
  if (isVercelGithubAppRepoAccessError(error)) {
    return (
      `The Vercel team ${context.teamLabel} is unable to access the new repo ${context.repoFullName}. ` +
      `Either add it to the selected access list or grant access to all repositories. ` +
      `Update Vercel access: ${VERCEL_GITHUB_APP_ACCESS_URL}`
    );
  }
  return getVercelErrorMessage(error);
}

export async function sleepMs(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
