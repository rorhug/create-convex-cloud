"use node";

import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { Octokit } from "octokit";
import {
  DEFAULT_TEMPLATE_OWNER,
  DEFAULT_TEMPLATE_REPO,
  TEMPLATE_ONLY_FILES_TO_DELETE_AFTER_GENERATE,
} from "./templateConfig";
import { setStep } from "./stepUtils";

const GITHUB_API_VERSION = "2022-11-28";
const TEMPLATE_GENERATION_SETTLE_MS = 5_000;

function httpStatusFromUnknown(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: number }).status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}

async function sleepMs(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function deleteRepoFileIfPresent({
  octokit,
  owner,
  repo,
  path,
  branch,
}: {
  octokit: Octokit;
  owner: string;
  repo: string;
  path: string;
  branch: string;
}): Promise<boolean> {
  try {
    const getContentRes = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
      owner,
      repo,
      path,
      ref: branch,
    });

    if (Array.isArray(getContentRes.data) || typeof getContentRes.data.sha !== "string") {
      throw new Error(`Expected ${path} to be a file in ${owner}/${repo}`);
    }

    await octokit.request("DELETE /repos/{owner}/{repo}/contents/{path}", {
      owner,
      repo,
      path,
      branch,
      message: `Remove template-only file ${path}`,
      sha: getContentRes.data.sha,
    });
    return true;
  } catch (error) {
    if (httpStatusFromUnknown(error) === 404) {
      return false;
    }
    throw error;
  }
}

export const stepCreateGithubRepoTemplate = internalAction({
  args: { appId: v.id("apps") },
  returns: v.object({
    repoFullName: v.string(),
    repoUrl: v.string(),
  }),
  handler: async (ctx, args): Promise<{ repoFullName: string; repoUrl: string }> => {
    await setStep(ctx, args.appId, "github", "creating", "Creating GitHub repo from template...");

    const app = await ctx.runQuery(internal.client.apps.internalGetApp, { id: args.appId });
    if (!app) throw new Error("App not found");

    const githubConnection = await ctx.runQuery(internal.lib.providers.github.data.getGithubConnection, {
      userId: app.ownerId,
    });
    if (!githubConnection?.githubAccessToken) {
      await setStep(ctx, args.appId, "github", "error", "GitHub access token not found");
      throw new Error("GitHub access token not found for user");
    }
    const installation = githubConnection.githubInstallations.find(
      (candidate: { id: string }) => candidate.id === app.githubInstallationId,
    );
    if (!installation) {
      await setStep(ctx, args.appId, "github", "error", "GitHub installation not found");
      throw new Error("Selected GitHub installation not found. Refresh installations and try again.");
    }

    const { accessToken, githubUsername } = await ctx.runAction(
      internal.workflows.githubAccessTokenAction.ensureFreshGithubAccessToken,
      { userId: app.ownerId },
    );
    const octokit = new Octokit({
      auth: accessToken,
      request: {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": GITHUB_API_VERSION,
        },
      },
    });
    const owner = installation.accountLogin || githubUsername || "";
    let repoCreated = false;
    let createdRepoFullName: string | null = null;

    try {
      await setStep(
        ctx,
        args.appId,
        "github",
        "creating",
        `Creating repo in ${owner} from template ${DEFAULT_TEMPLATE_OWNER}/${DEFAULT_TEMPLATE_REPO}...`,
      );

      const createRepoRes = await octokit.request("POST /repos/{template_owner}/{template_repo}/generate", {
        template_owner: DEFAULT_TEMPLATE_OWNER,
        template_repo: DEFAULT_TEMPLATE_REPO,
        ...(owner ? { owner } : {}),
        name: app.name,
        description: "Created by https://createconvex.cloud",
        private: app.githubRepoPrivate ?? false,
      });
      repoCreated = true;

      const repoFullName: string = createRepoRes.data.full_name;
      const repoUrl: string = createRepoRes.data.html_url;
      const defaultBranch: string = createRepoRes.data.default_branch ?? "main";
      createdRepoFullName = repoFullName;

      const [repoOwner, repoName] = repoFullName.split("/");
      if (!repoOwner || !repoName) {
        throw new Error(`Could not determine owner/repo from ${repoFullName}`);
      }

      if (TEMPLATE_ONLY_FILES_TO_DELETE_AFTER_GENERATE.length > 0) {
        await setStep(ctx, args.appId, "github", "creating", "Waiting for GitHub template files...");
        await sleepMs(TEMPLATE_GENERATION_SETTLE_MS);
        await setStep(ctx, args.appId, "github", "creating", "Removing template-only files...");
        for (const path of TEMPLATE_ONLY_FILES_TO_DELETE_AFTER_GENERATE) {
          const deleted = await deleteRepoFileIfPresent({
            octokit,
            owner: repoOwner,
            repo: repoName,
            path,
            branch: defaultBranch,
          });
          if (!deleted) {
            console.warn(`Template-only file ${path} was not found in ${repoFullName}; skipped deletion.`);
          }
        }
      }

      await ctx.runMutation(internal.lib.providers.github.data.insertGithubRepo, {
        appId: args.appId,
        repoFullName,
        repoUrl,
      });

      await setStep(ctx, args.appId, "github", "ready", `Created ${repoFullName}`);
      return { repoFullName, repoUrl };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      await setStep(ctx, args.appId, "github", "error", msg);

      if (repoCreated) {
        try {
          const [cleanupOwner, cleanupRepo] = createdRepoFullName?.split("/") ?? [owner, app.name];
          await octokit.request("DELETE /repos/{owner}/{repo}", {
            owner: cleanupOwner!,
            repo: cleanupRepo!,
          });
        } catch (cleanupErr) {
          console.error("Failed to clean up repo after error:", cleanupErr);
        }
      }

      throw error;
    }
  },
});
