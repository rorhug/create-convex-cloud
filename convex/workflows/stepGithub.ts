"use node";

import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { Octokit } from "octokit";
import {
  TEMPLATE_SOURCE_OWNER,
  TEMPLATE_SOURCE_REPO,
  DEFAULT_TEMPLATE_FOLDER,
  TEMPLATE_SKIP_FILES,
  SUPPLEMENTARY_FILES,
} from "./templateConfig";
import { setStep } from "./stepUtils";

export const stepCreateGithubRepo = internalAction({
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

    const { accessToken, githubUsername } = await ctx.runAction(
      internal.workflows.githubAccessTokenAction.ensureFreshGithubAccessToken,
      { userId: app.ownerId },
    );

    const octokit = new Octokit({ auth: accessToken });
    const owner: string = githubUsername ?? "";
    let repoCreated = false;

    try {
      // 1. Fetch the upstream template tree from get-convex/templates.
      //    We reuse the user's authenticated Octokit so we stay well within
      //    GitHub's 5000 req/hour authenticated rate limit.
      await setStep(ctx, args.appId, "github", "running", "Fetching template from get-convex/templates...");

      const upstreamTreeRes = await octokit.request("GET /repos/{owner}/{repo}/git/trees/{tree_sha}", {
        owner: TEMPLATE_SOURCE_OWNER,
        repo: TEMPLATE_SOURCE_REPO,
        tree_sha: "main",
        recursive: "1",
        headers: { "X-GitHub-Api-Version": "2022-11-28" },
      });

      // Keep only blob entries (no directories) under the template folder,
      // minus files we explicitly skip (e.g. package-lock.json).
      const prefix = `${DEFAULT_TEMPLATE_FOLDER}/`;
      const upstreamEntries: Array<{ path: string; sha: string; mode: string }> = upstreamTreeRes.data.tree
        .filter(
          (e) =>
            e.type === "blob" && e.path?.startsWith(prefix) && !TEMPLATE_SKIP_FILES.has(e.path.slice(prefix.length)),
        )
        .map((e) => ({
          path: e.path.slice(prefix.length), // strip "template-nextjs-convexauth/"
          sha: e.sha as string,
          mode: e.mode as string,
        }));

      // 2. Fetch all blob contents in parallel from the upstream repo.
      await setStep(ctx, args.appId, "github", "running", "Downloading template files...");

      const upstreamFiles = await Promise.all(
        upstreamEntries.map(async (entry) => {
          const blobRes = await octokit.request("GET /repos/{owner}/{repo}/git/blobs/{file_sha}", {
            owner: TEMPLATE_SOURCE_OWNER,
            repo: TEMPLATE_SOURCE_REPO,
            file_sha: entry.sha,
            headers: { "X-GitHub-Api-Version": "2022-11-28" },
          });
          return {
            path: entry.path,
            content: blobRes.data.content as string, // base64-encoded
            encoding: blobRes.data.encoding as string, // "base64"
            executable: entry.mode === "100755",
          };
        }),
      );

      // 3. Merge supplementary files on top (they override any upstream file
      //    with the same path, e.g. vercel.json).
      const supplementaryPaths = new Set(SUPPLEMENTARY_FILES.map((f) => f.path));
      const allFiles = [
        ...upstreamFiles.filter((f) => !supplementaryPaths.has(f.path)),
        ...SUPPLEMENTARY_FILES.map((f) => ({
          path: f.path,
          content: f.content,
          encoding: "utf-8" as const,
          executable: f.executable,
        })),
      ];

      // 4. Create the destination repo (auto_init:true initialises the git db
      //    so blob/tree/commit API calls don't fail with "empty repository").
      await setStep(ctx, args.appId, "github", "running", "Creating GitHub repo...");

      const createRepoRes = await octokit.request("POST /user/repos", {
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

      // 5. Upload all files as blobs to the new repo (in parallel).
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

      // 6. Create a git tree referencing all blobs.
      await setStep(ctx, args.appId, "github", "running", "Building file tree...");

      const tree = allFiles.map((file, i) => ({
        path: file.path,
        mode: (file.executable ? "100755" : "100644") as "100755" | "100644",
        type: "blob" as const,
        sha: blobShas[i],
      }));

      const treeRes = await octokit.request("POST /repos/{owner}/{repo}/git/trees", {
        owner,
        repo: app.name,
        tree,
        headers: { "X-GitHub-Api-Version": "2022-11-28" },
      });
      const treeSha: string = treeRes.data.sha;

      // 7. Create an orphan commit (no parents) so history has exactly one
      //    clean "Initial commit" instead of two (auto_init + ours).
      const commitRes = await octokit.request("POST /repos/{owner}/{repo}/git/commits", {
        owner,
        repo: app.name,
        message: "Initial commit",
        tree: treeSha,
        parents: [],
        headers: { "X-GitHub-Api-Version": "2022-11-28" },
      });
      const commitSha: string = commitRes.data.sha;

      // 8. Force-update the default branch to our orphan commit.
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

      // Clean up the partially-created repo so the user doesn't end up with
      // an empty orphaned repository in their GitHub account.
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
