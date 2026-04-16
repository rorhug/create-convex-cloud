"use node";

import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { Octokit } from "octokit";
import { DEFAULT_TEMPLATE_OWNER, DEFAULT_TEMPLATE_REPO } from "./templateConfig";
import { setStep } from "./stepUtils";

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
    const octokit = new Octokit({ auth: accessToken });
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
        headers: { "X-GitHub-Api-Version": "2022-11-28" },
      });
      repoCreated = true;

      const repoFullName: string = createRepoRes.data.full_name;
      const repoUrl: string = createRepoRes.data.html_url;
      createdRepoFullName = repoFullName;

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
            headers: { "X-GitHub-Api-Version": "2022-11-28" },
          });
        } catch (cleanupErr) {
          console.error("Failed to clean up repo after error:", cleanupErr);
        }
      }

      throw error;
    }
  },
});
