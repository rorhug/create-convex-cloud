"use node";

import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { Octokit } from "octokit";
import _sodium from "libsodium-wrappers";
import { setStep } from "./stepUtils";

const GITHUB_API_VERSION = "2022-11-28";

/**
 * GitHub Actions workflow that builds the Next.js static export and deploys
 * it to GitHub Pages. We wrap `pnpm run build` with `npx convex deploy` so
 * the Convex functions are pushed and `NEXT_PUBLIC_CONVEX_URL` is injected
 * into the build environment, mirroring the Vercel `buildCommand` recipe.
 *
 * Requirements on the generated repo:
 *   - Pages source set to `workflow` (this step does it via the API).
 *   - `CONVEX_DEPLOY_KEY` set as a repo Actions secret (this step does it).
 *   - The Next.js app should be configured for static export
 *     (`output: "export"` in next.config + `basePath` from PAGES_BASE_PATH).
 *     The current upstream template targets Vercel, so users may need to
 *     adjust their next.config.js for static export to actually succeed.
 */
const DEPLOY_WORKFLOW_YAML = `name: Deploy Next.js site to Pages

on:
  # Runs on pushes targeting the main branch
  push:
    branches:
      - main

  # Allows you to run this workflow manually from the Actions tab
  workflow_dispatch:

# Sets permissions of the GITHUB_TOKEN to allow deployment to GitHub Pages
permissions:
  contents: read
  pages: write
  id-token: write

# Allow only one concurrent deployment, skipping runs queued between the run in-progress and latest queued.
# However, do NOT cancel in-progress runs as we want to allow these production deployments to complete.
concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        name: Install pnpm
        with:
          version: 10
          run_install: false

      - name: Install Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Setup Pages
        id: setup_pages
        uses: actions/configure-pages@v5

      - name: Restore cache
        uses: actions/cache@v4
        with:
          path: |
            .next/cache
          # Generate a new cache whenever packages or source files change.
          key: \${{ runner.os }}-nextjs-\${{ hashFiles('**/pnpm-lock.yaml') }}-\${{ hashFiles('**.[jt]s', '**.[jt]sx') }}
          # If source files changed but packages didn't, rebuild from a prior cache.
          restore-keys: |
            \${{ runner.os }}-nextjs-\${{ hashFiles('**/pnpm-lock.yaml') }}-

      - name: Build with Next.js (and deploy Convex)
        run: npx convex deploy --cmd 'pnpm run build' --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL
        env:
          CONVEX_DEPLOY_KEY: \${{ secrets.CONVEX_DEPLOY_KEY }}
          PAGES_BASE_PATH: \${{ steps.setup_pages.outputs.base_path }}

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./out

  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
`;

function httpStatusFromUnknown(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: number }).status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}

async function commitDeployWorkflow({
  octokit,
  owner,
  repo,
  branch,
}: {
  octokit: Octokit;
  owner: string;
  repo: string;
  branch: string;
}): Promise<void> {
  const path = ".github/workflows/deploy.yml";
  const contentBase64 = Buffer.from(DEPLOY_WORKFLOW_YAML, "utf8").toString("base64");

  // If the file already exists (e.g. retry), include its sha so PUT updates it.
  let existingSha: string | undefined;
  try {
    const existing = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
      owner,
      repo,
      path,
      ref: branch,
    });
    if (!Array.isArray(existing.data) && typeof existing.data.sha === "string") {
      existingSha = existing.data.sha;
    }
  } catch (error) {
    if (httpStatusFromUnknown(error) !== 404) {
      throw error;
    }
  }

  await octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
    owner,
    repo,
    path,
    branch,
    message: "Add GitHub Pages deploy workflow",
    content: contentBase64,
    ...(existingSha ? { sha: existingSha } : {}),
  });
}

async function setActionsSecret({
  octokit,
  owner,
  repo,
  secretName,
  secretValue,
}: {
  octokit: Octokit;
  owner: string;
  repo: string;
  secretName: string;
  secretValue: string;
}): Promise<void> {
  // 1. Fetch the repo's public key for Actions secrets.
  const publicKeyRes = await octokit.request(
    "GET /repos/{owner}/{repo}/actions/secrets/public-key",
    { owner, repo },
  );
  const { key: publicKeyBase64, key_id: keyId } = publicKeyRes.data;

  // 2. Encrypt the secret with libsodium's sealed box (X25519 + XSalsa20-Poly1305),
  //    base64-encode the ciphertext per GitHub's spec.
  await _sodium.ready;
  const sodium = _sodium;
  const binKey = sodium.from_base64(publicKeyBase64, sodium.base64_variants.ORIGINAL);
  const binSecret = sodium.from_string(secretValue);
  const encrypted = sodium.crypto_box_seal(binSecret, binKey);
  const encryptedValue = sodium.to_base64(encrypted, sodium.base64_variants.ORIGINAL);

  // 3. PUT the encrypted secret to the repo. (Idempotent — same path overwrites.)
  await octokit.request("PUT /repos/{owner}/{repo}/actions/secrets/{secret_name}", {
    owner,
    repo,
    secret_name: secretName,
    encrypted_value: encryptedValue,
    key_id: keyId,
  });
}

async function enablePagesWithWorkflowSource({
  octokit,
  owner,
  repo,
}: {
  octokit: Octokit;
  owner: string;
  repo: string;
}): Promise<void> {
  // Check whether Pages is already configured.
  let alreadyConfigured = false;
  try {
    const get = await octokit.request("GET /repos/{owner}/{repo}/pages", { owner, repo });
    if (get.status === 200) {
      alreadyConfigured = true;
    }
  } catch (error) {
    if (httpStatusFromUnknown(error) !== 404) {
      throw error;
    }
  }

  if (alreadyConfigured) {
    // Make sure the build_type is "workflow" (PUT supports updating it).
    await octokit.request("PUT /repos/{owner}/{repo}/pages", {
      owner,
      repo,
      build_type: "workflow",
    });
    return;
  }

  await octokit.request("POST /repos/{owner}/{repo}/pages", {
    owner,
    repo,
    build_type: "workflow",
  });
}

export const stepCreateGithubPagesDeployment = internalAction({
  args: {
    appId: v.id("apps"),
    repoFullName: v.string(),
    prodDeployKey: v.string(),
  },
  returns: v.object({
    pagesUrl: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args): Promise<{ pagesUrl: string | null }> => {
    await setStep(
      ctx,
      args.appId,
      "github-pages",
      "creating",
      "Configuring GitHub Pages deployment...",
    );

    const app = await ctx.runQuery(internal.client.apps.internalGetApp, { id: args.appId });
    if (!app) throw new Error("App not found");

    const [owner, repo] = args.repoFullName.split("/");
    if (!owner || !repo) {
      throw new Error(`Could not determine owner/repo from ${args.repoFullName}`);
    }

    const { accessToken } = await ctx.runAction(
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

    try {
      await setStep(
        ctx,
        args.appId,
        "github-pages",
        "creating",
        "Setting CONVEX_DEPLOY_KEY repo secret...",
      );
      await setActionsSecret({
        octokit,
        owner,
        repo,
        secretName: "CONVEX_DEPLOY_KEY",
        secretValue: args.prodDeployKey,
      });

      await setStep(
        ctx,
        args.appId,
        "github-pages",
        "creating",
        "Adding .github/workflows/deploy.yml to the repo...",
      );
      // The repo was created from a template using the default branch (main).
      await commitDeployWorkflow({ octokit, owner, repo, branch: "main" });

      await setStep(
        ctx,
        args.appId,
        "github-pages",
        "creating",
        "Enabling GitHub Pages (source: GitHub Actions)...",
      );
      await enablePagesWithWorkflowSource({ octokit, owner, repo });

      // Predict the Pages URL. The actual URL is also returned by GET /repos/{owner}/{repo}/pages
      // once the site is live, but at this point the first deployment is still queued.
      const pagesUrl = `https://${owner}.github.io/${repo}/`;

      await setStep(
        ctx,
        args.appId,
        "github-pages",
        "ready",
        `Pages workflow committed and configured. First build will be visible at ${pagesUrl}`,
      );
      return { pagesUrl };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      await setStep(ctx, args.appId, "github-pages", "error", msg);
      throw error;
    }
  },
});
