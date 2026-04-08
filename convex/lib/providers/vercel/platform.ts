"use node";

import type { VercelTeam } from "./data";

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
    return response.statusText || `Request failed with status ${response.status}`;
  }
  try {
    const payload = JSON.parse(text) as VercelErrorPayload;
    return (
      payload.error?.message ??
      payload.message ??
      response.statusText ??
      `Request failed with status ${response.status}`
    );
  } catch {
    return text;
  }
}

async function vercelFetch<TResponse>(
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
  const timeout = setTimeout(
    () => controller.abort(),
    options?.timeoutMs ?? VERCEL_REQUEST_TIMEOUT_MS,
  );

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
      throw new Error(await readVercelError(response));
    }

    if (response.status === 204) {
      return undefined as TResponse;
    }

    return (await response.json()) as TResponse;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Vercel request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchVercelTeamsForToken(token: string): Promise<VercelTeam[]> {
  const trimmed = token.trim();
  if (trimmed.length < 10) {
    throw new Error("Vercel token looks too short");
  }

  const teams: VercelTeam[] = [];
  let until: number | undefined;

  try {
    for (;;) {
      const page = await vercelFetch<VercelTeamsPage>(trimmed, "/v2/teams", {
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
  } catch {
    throw new Error("Vercel token is invalid or expired");
  }

  if (teams.length === 0) {
    throw new Error("No Vercel teams found for this token. Check token access or your Vercel account.");
  }

  return teams;
}

export async function createVercelProject(
  token: string,
  teamId: string,
  requestBody: VercelCreateProjectRequest,
) {
  return await vercelFetch<VercelProjectResponse>(token, "/v10/projects", {
    method: "POST",
    params: { teamId },
    body: requestBody,
  });
}

export async function createVercelDeployment(
  token: string,
  teamId: string,
  requestBody: VercelCreateDeploymentRequest,
) {
  return await vercelFetch<VercelCreateDeploymentResponse>(token, "/v13/deployments", {
    method: "POST",
    params: { teamId },
    body: requestBody,
  });
}

export async function getVercelDeployment(
  token: string,
  deploymentId: string,
  teamId: string,
) {
  return await vercelFetch<VercelDeploymentResponse>(
    token,
    `/v13/deployments/${encodeURIComponent(deploymentId)}`,
    {
      params: { teamId },
    },
  );
}

export async function deleteVercelProject(token: string, projectId: string, teamId: string) {
  await vercelFetch<void>(token, `/v9/projects/${encodeURIComponent(projectId)}`, {
    method: "DELETE",
    params: { teamId },
  });
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
