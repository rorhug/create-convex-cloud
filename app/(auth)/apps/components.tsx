"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type AppsGithubInstallation = {
  id: string;
  accountId: number;
  accountLogin: string;
  accountType: string;
  repositorySelection: string;
};

export type AppsVercelTeam = {
  id: string;
  name?: string | undefined;
  slug: string;
};

const GO_TO_SETUP_VALUE = "__go-to-setup__";

export function AppCreationSection({
  error,
  githubInstallationId,
  githubInstallations,
  githubRepoVisibility,
  isCreating,
  name,
  onGithubInstallationChange,
  onGithubRepoVisibilityChange,
  onNameChange,
  onSubmit,
  onVercelTeamChange,
  vercelTeamId,
  vercelTeams,
}: {
  error: string | null;
  githubInstallationId: string;
  githubInstallations: AppsGithubInstallation[];
  githubRepoVisibility: "" | "public" | "private";
  isCreating: boolean;
  name: string;
  onGithubInstallationChange: (value: string) => void;
  onGithubRepoVisibilityChange: (value: "" | "public" | "private") => void;
  onNameChange: (value: string) => void;
  onSubmit: () => void;
  onVercelTeamChange: (value: string) => void;
  vercelTeamId: string;
  vercelTeams: AppsVercelTeam[];
}) {
  const router = useRouter();
  const personalGithubInstallations = githubInstallations.filter(
    (installation) => installation.accountType.toLowerCase() !== "organization",
  );
  const organizationGithubInstallations = githubInstallations.filter(
    (installation) => installation.accountType.toLowerCase() === "organization",
  );
  const isCreateDisabled =
    isCreating ||
    name.trim().length === 0 ||
    githubInstallations.length === 0 ||
    githubInstallationId === "" ||
    vercelTeams.length === 0 ||
    vercelTeamId === "" ||
    (githubRepoVisibility !== "public" && githubRepoVisibility !== "private");

  return (
    <section className="border border-border bg-card p-6">
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="app-name">New App</Label>
          <Input
            id="app-name"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="my-demo-app"
            className="w-full"
          />
        </div>

        <div className="flex flex-col gap-4 md:flex-row">
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor="github-installation">GitHub Profile / Org</Label>
            <Select
              value={githubInstallationId}
              onValueChange={(value) => {
                if (value === GO_TO_SETUP_VALUE) {
                  router.push("/setup");
                  return;
                }
                onGithubInstallationChange(value);
              }}
            >
              <SelectTrigger id="github-installation" className="w-full">
                <SelectValue placeholder="Select an installation…" />
              </SelectTrigger>
              <SelectContent>
                {personalGithubInstallations.length > 0 ? (
                  <SelectGroup>
                    <SelectLabel>Personal</SelectLabel>
                    {personalGithubInstallations.map((installation) => (
                      <SelectItem key={installation.id} value={installation.id}>
                        {installation.accountLogin}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ) : null}
                {personalGithubInstallations.length > 0 && organizationGithubInstallations.length > 0 ? (
                  <SelectSeparator />
                ) : null}
                {organizationGithubInstallations.length > 0 ? (
                  <SelectGroup>
                    <SelectLabel>Orgs</SelectLabel>
                    {organizationGithubInstallations.map((installation) => (
                      <SelectItem key={installation.id} value={installation.id}>
                        {installation.accountLogin}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ) : null}
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>GitHub Access</SelectLabel>
                  <SelectItem value={GO_TO_SETUP_VALUE}>Go to setup</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor="github-visibility">GitHub repository</Label>
            <Select
              value={githubRepoVisibility}
              onValueChange={(value) => {
                onGithubRepoVisibilityChange(value === "public" || value === "private" ? value : "");
              }}
            >
              <SelectTrigger id="github-visibility" className="w-full">
                <SelectValue placeholder="Public or private…" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>GitHub repository visibility</SelectLabel>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor="vercel-team">Vercel team</Label>
            <Select
              value={vercelTeamId}
              onValueChange={(value) => {
                if (value === GO_TO_SETUP_VALUE) {
                  router.push("/setup");
                  return;
                }
                onVercelTeamChange(value);
              }}
            >
              <SelectTrigger id="vercel-team" className="w-full">
                <SelectValue placeholder={vercelTeams.length === 0 ? "No teams available" : "Select a team…"} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Vercel teams</SelectLabel>
                  {vercelTeams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>Vercel Access</SelectLabel>
                  <SelectItem value={GO_TO_SETUP_VALUE}>Go to setup</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        {githubInstallations.length === 0 ? (
          <div className="border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
            No GitHub App installations on file yet. Go to setup to add your personal account or an organization.
          </div>
        ) : null}

        {vercelTeams.length === 0 ? (
          <div className="border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
            No Vercel teams on file (your personal team should appear after you{" "}
            <Link href="/setup" className="underline hover:text-foreground">
              verify your Vercel token again
            </Link>
            ).
          </div>
        ) : null}

        <div>
          <Button className="w-full" disabled={isCreateDisabled} onClick={onSubmit}>
            {isCreating ? "Creating..." : "Create app"}
          </Button>
        </div>

        {error && (
          <div className="border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>
    </section>
  );
}
