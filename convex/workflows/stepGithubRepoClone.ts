"use node";

// Currently unused. We prefer the template-based GitHub flow because this clone-and-upload
// path is slow and unreliable: blob uploads often fail because GitHub is not ready yet.

import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { Octokit } from "octokit";
import {
  CLONE_TEMPLATE_SOURCE_OWNER,
  CLONE_TEMPLATE_SOURCE_REPO,
  CLONE_TEMPLATE_FOLDER,
  TEMPLATE_SKIP_FILES,
  SUPPLEMENTARY_FILES,
} from "./templateConfig";
import { setStep } from "./stepUtils";

export const stepCreateGithubRepoClone = internalAction({
  args: { appId: v.id("apps") },
  returns: v.object({
    repoFullName: v.string(),
    repoUrl: v.string(),
  }),
  handler: async (ctx, args): Promise<{ repoFullName: string; repoUrl: string }> => {
    await setStep(ctx, args.appId, "github", "running", "Creating GitHub repo...");

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
    const owner: string = installation.accountLogin || githubUsername || "";
    let repoCreated = false;

    try {
      await setStep(ctx, args.appId, "github", "running", "Fetching template from get-convex/templates...");

      const upstreamTreeRes = await octokit.request("GET /repos/{owner}/{repo}/git/trees/{tree_sha}", {
        owner: CLONE_TEMPLATE_SOURCE_OWNER,
        repo: CLONE_TEMPLATE_SOURCE_REPO,
        tree_sha: "main",
        recursive: "1",
        headers: { "X-GitHub-Api-Version": "2022-11-28" },
      });

      const prefix = `${CLONE_TEMPLATE_FOLDER}/`;
      const upstreamEntries: Array<{ path: string; sha: string; mode: string }> = upstreamTreeRes.data.tree
        .filter(
          (entry) =>
            entry.type === "blob" &&
            entry.path?.startsWith(prefix) &&
            !TEMPLATE_SKIP_FILES.has(entry.path.slice(prefix.length)),
        )
        .map((entry) => ({
          path: entry.path.slice(prefix.length),
          sha: entry.sha as string,
          mode: entry.mode as string,
        }));

      await setStep(ctx, args.appId, "github", "running", "Downloading template files...");

      const upstreamFiles = await Promise.all(
        upstreamEntries.map(async (entry) => {
          const blobRes = await octokit.request("GET /repos/{owner}/{repo}/git/blobs/{file_sha}", {
            owner: CLONE_TEMPLATE_SOURCE_OWNER,
            repo: CLONE_TEMPLATE_SOURCE_REPO,
            file_sha: entry.sha,
            headers: { "X-GitHub-Api-Version": "2022-11-28" },
          });
          return {
            path: entry.path,
            content: blobRes.data.content as string,
            encoding: blobRes.data.encoding as string,
            executable: entry.mode === "100755",
          };
        }),
      );

      const supplementaryPaths = new Set(SUPPLEMENTARY_FILES.map((file) => file.path));
      const allFiles = [
        ...upstreamFiles.filter((file) => !supplementaryPaths.has(file.path)),
        ...SUPPLEMENTARY_FILES.map((file) => ({
          path: file.path,
          content: file.content,
          encoding: "utf-8" as const,
          executable: file.executable,
        })),
      ];

      await setStep(ctx, args.appId, "github", "running", "Creating GitHub repo...");

      const createRepoRes = installation.accountType.toLowerCase() === "organization"
        ? await octokit.request("POST /orgs/{org}/repos", {
            org: owner,
            name: app.name,
            description: "Created by create-convex-cloud",
            private: app.githubRepoPrivate ?? false,
            auto_init: true,
            headers: { "X-GitHub-Api-Version": "2022-11-28" },
          })
        : await octokit.request("POST /user/repos", {
            name: app.name,
            description: "Created by create-convex-cloud",
            private: app.githubRepoPrivate ?? false,
            auto_init: true,
            headers: { "X-GitHub-Api-Version": "2022-11-28" },
          });
      repoCreated = true;

      const repoFullName: string = createRepoRes.data.full_name;
      const repoUrl: string = createRepoRes.data.html_url;
      const defaultBranch: string = createRepoRes.data.default_branch ?? "main";

      await setStep(ctx, args.appId, "github", "running", "Uploading files...");

      const blobShas: string[] = await Promise.all(
        allFiles.map(async (file) => {
          const blobRes = await octokit.request("POST /repos/{owner}/{repo}/git/blobs", {
            owner,
            repo: app.name,
            content: file.content,
            encoding: file.encoding,
            headers: { "X-GitHub-Api-Version": "2022-11-28" },
          });
          return blobRes.data.sha as string;
        }),
      );

      await setStep(ctx, args.appId, "github", "running", "Building file tree...");

      const tree = allFiles.map((file, index) => ({
        path: file.path,
        mode: (file.executable ? "100755" : "100644") as "100755" | "100644",
        type: "blob" as const,
        sha: blobShas[index],
      }));

      const treeRes = await octokit.request("POST /repos/{owner}/{repo}/git/trees", {
        owner,
        repo: app.name,
        tree,
        headers: { "X-GitHub-Api-Version": "2022-11-28" },
      });
      const treeSha: string = treeRes.data.sha;

      const commitRes = await octokit.request("POST /repos/{owner}/{repo}/git/commits", {
        owner,
        repo: app.name,
        message: "Initial commit",
        tree: treeSha,
        parents: [],
        headers: { "X-GitHub-Api-Version": "2022-11-28" },
      });
      const commitSha: string = commitRes.data.sha;

      await octokit.request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", {
        owner,
        repo: app.name,
        ref: `heads/${defaultBranch}`,
        sha: commitSha,
        force: true,
        headers: { "X-GitHub-Api-Version": "2022-11-28" },
      });

      await ctx.runMutation(internal.lib.providers.github.data.insertGithubRepo, {
        appId: args.appId,
        repoFullName,
        repoUrl,
      });

      await setStep(ctx, args.appId, "github", "done", `Created ${repoFullName}`);
      return { repoFullName, repoUrl };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      await setStep(ctx, args.appId, "github", "error", msg);

      if (repoCreated) {
        try {
          await octokit.request("DELETE /repos/{owner}/{repo}", {
            owner,
            repo: app.name,
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
