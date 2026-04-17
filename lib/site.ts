/** Public GitHub template repo used for new apps (see `convex/workflows/templateConfig.ts`). */
export const CCC_TEMPLATE_REPO_URL = "https://github.com/rorhug/ccc-template";

/** Issues for this product; override via env if the repo URL differs. */
export const GITHUB_ISSUES_URL =
  process.env.NEXT_PUBLIC_GITHUB_ISSUES_URL ?? "https://github.com/rorhug/create-convex-cloud/issues";

/** Pre-filled URL for the feature_request.yml issue template in `.github/ISSUE_TEMPLATE/`. */
export const GITHUB_FEATURE_REQUEST_URL = `${GITHUB_ISSUES_URL}/new?template=feature_request.yml`;

/**
 * Same URL as `vercelGithubAppPermissionsUrlForAccount` in `convex/lib/providers/github/platform.ts`:
 * Vercel’s GitHub App permissions for a user/org (`target_id` / `target_type`).
 */
export function vercelGithubAppPermissionsUrlForAccount(accountId: number, accountType: string): string {
  const targetType = accountType.toLowerCase() === "organization" ? "Organization" : "User";
  const url = new URL("https://github.com/apps/vercel/installations/new/permissions");
  url.searchParams.set("target_id", String(accountId));
  url.searchParams.set("target_type", targetType);
  return url.href;
}
