import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";

export const importSearchStatusValidator = v.union(
  v.literal("idle"),
  v.literal("searching"),
  v.literal("ready"),
  v.literal("error"),
);

export const existingProjectInputValidator = v.object({
  vercelProjectId: v.string(),
  vercelProjectName: v.string(),
  vercelTeamId: v.string(),
  vercelTeamSlug: v.string(),
  deploymentUrl: v.optional(v.string()),
  gitProvider: v.optional(v.string()),
  githubRepoFullName: v.optional(v.string()),
  githubRepoUrl: v.optional(v.string()),
  githubRepoPrivate: v.optional(v.boolean()),
  githubInstallationId: v.optional(v.string()),
  prodDeployKey: v.optional(v.string()),
  previewDeployKey: v.optional(v.string()),
  convexProjectId: v.optional(v.string()),
  convexTeamId: v.optional(v.string()),
  convexTeamSlug: v.optional(v.string()),
  convexProjectSlug: v.optional(v.string()),
  convexProdDeploymentName: v.optional(v.string()),
});

const nullableString = v.union(v.string(), v.null());

export const existingProjectSummaryValidator = v.object({
  _id: v.id("existingProjects"),
  vercelProjectId: v.string(),
  vercelProjectName: v.string(),
  vercelTeamSlug: v.string(),
  vercelUrl: v.string(),
  githubRepoFullName: nullableString,
  githubRepoUrl: nullableString,
  convexProjectSlug: nullableString,
  convexUrl: nullableString,
  importable: v.boolean(),
  reasons: v.array(v.string()),
});

export const existingProjectsViewValidator = v.object({
  status: importSearchStatusValidator,
  message: nullableString,
  updatedAt: v.union(v.number(), v.null()),
  projects: v.array(existingProjectSummaryValidator),
});

export type ExistingProjectRecord = Doc<"existingProjects">;

export type ExistingProjectMatchSets = {
  vercelProjectIds: Set<string>;
  githubRepoFullNames: Set<string>;
  convexProjectIds: Set<string>;
};

export type ExistingProjectReadyForImport = ExistingProjectRecord & {
  githubRepoFullName: string;
  githubRepoUrl: string;
  githubRepoPrivate: boolean;
  githubInstallationId: string;
  prodDeployKey: string;
  convexProjectId: string;
  convexTeamId: string;
  convexTeamSlug: string;
  convexProjectSlug: string;
  convexProdDeploymentName: string;
};

export function normalizeGithubRepoFullName(value: string) {
  return value.trim().toLowerCase();
}

export function getExistingProjectBlockingReasons(
  project: ExistingProjectRecord,
  matches: ExistingProjectMatchSets,
): string[] {
  const reasons: string[] = [];

  if (!project.gitProvider) {
    reasons.push("No Git repository is linked in Vercel.");
  } else if (project.gitProvider !== "github") {
    reasons.push("The linked Vercel repository is not on GitHub.");
  }

  if (project.gitProvider === "github" && !project.githubRepoFullName) {
    reasons.push("The linked GitHub repository could not be identified.");
  }

  if (project.githubRepoFullName && !project.githubInstallationId) {
    reasons.push("The linked GitHub repository is not accessible through your connected GitHub App.");
  }

  if (!project.prodDeployKey) {
    reasons.push("Missing a production CONVEX_DEPLOY_KEY in Vercel.");
  } else if (
    !project.convexProjectId ||
    !project.convexTeamId ||
    !project.convexTeamSlug ||
    !project.convexProjectSlug ||
    !project.convexProdDeploymentName
  ) {
    reasons.push("The production CONVEX_DEPLOY_KEY could not be resolved to a Convex project.");
  }

  if (matches.vercelProjectIds.has(project.vercelProjectId)) {
    reasons.push("This Vercel project is already imported.");
  }

  if (
    project.githubRepoFullName &&
    matches.githubRepoFullNames.has(normalizeGithubRepoFullName(project.githubRepoFullName))
  ) {
    reasons.push("This GitHub repository is already imported.");
  }

  if (project.convexProjectId && matches.convexProjectIds.has(project.convexProjectId)) {
    reasons.push("This Convex project is already imported.");
  }

  return reasons;
}

export function isExistingProjectReadyForImport(
  project: ExistingProjectRecord,
  matches: ExistingProjectMatchSets,
): project is ExistingProjectReadyForImport {
  return (
    getExistingProjectBlockingReasons(project, matches).length === 0 &&
    typeof project.githubRepoFullName === "string" &&
    typeof project.githubRepoUrl === "string" &&
    typeof project.githubRepoPrivate === "boolean" &&
    typeof project.githubInstallationId === "string" &&
    typeof project.prodDeployKey === "string" &&
    typeof project.convexProjectId === "string" &&
    typeof project.convexTeamId === "string" &&
    typeof project.convexTeamSlug === "string" &&
    typeof project.convexProjectSlug === "string" &&
    typeof project.convexProdDeploymentName === "string"
  );
}

export function toExistingProjectSummary(
  project: ExistingProjectRecord,
  matches: ExistingProjectMatchSets,
) {
  const reasons = getExistingProjectBlockingReasons(project, matches);
  const convexUrl =
    project.convexTeamSlug && project.convexProjectSlug
      ? `https://dashboard.convex.dev/t/${project.convexTeamSlug}/${project.convexProjectSlug}`
      : null;

  return {
    _id: project._id,
    vercelProjectId: project.vercelProjectId,
    vercelProjectName: project.vercelProjectName,
    vercelTeamSlug: project.vercelTeamSlug,
    vercelUrl: `https://vercel.com/${project.vercelTeamSlug}/${project.vercelProjectName}`,
    githubRepoFullName: project.githubRepoFullName ?? null,
    githubRepoUrl: project.githubRepoUrl ?? null,
    convexProjectSlug: project.convexProjectSlug ?? null,
    convexUrl,
    importable: reasons.length === 0,
    reasons,
  };
}
