"use client";

import { useState } from "react";
import { GithubLogoIcon, TriangleIcon } from "@phosphor-icons/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GitHubPagesDeploymentTab } from "./github-pages-setup-step";
import { StepCard } from "./step-card";
import { VercelDeploymentTab } from "./vercel-setup-step";
import type { SetupBusyState, SetupGithubInstallation, SetupVercelTeam } from "./types";

type DeploymentProvider = "vercel" | "github-pages";

export function DeploymentTargetStep({
  complete,
  vercel,
  vercelToken,
  showReplaceVercelToken,
  busy,
  vercelIssue,
  githubInstallations,
  onVercelTokenChange,
  onVercelRefresh,
  onVercelSave,
  onToggleReplaceVercelToken,
}: {
  complete: boolean;
  vercel: {
    teams: SetupVercelTeam[];
    tokenPreview: string;
    isValid: boolean;
    issue: string | null;
  } | null;
  vercelToken: string;
  showReplaceVercelToken: boolean;
  busy: SetupBusyState;
  vercelIssue: string | null;
  githubInstallations: SetupGithubInstallation[];
  onVercelTokenChange: (value: string) => void;
  onVercelRefresh: () => void;
  onVercelSave: () => void;
  onToggleReplaceVercelToken: () => void;
}) {
  const [provider, setProvider] = useState<DeploymentProvider>("vercel");
  const [githubPagesToken, setGithubPagesToken] = useState("");
  const [githubPagesUsername, setGithubPagesUsername] = useState("");

  return (
    <StepCard
      step="2"
      title="Deployment target"
      description="Pick where to deploy your apps. You can switch providers at any time."
      complete={complete}
    >
      <Tabs
        value={provider}
        onValueChange={(value) => setProvider(value as DeploymentProvider)}
        className="mt-4"
      >
        <TabsList variant="line" className="w-full justify-start gap-6 border-b border-border">
          <TabsTrigger
            value="vercel"
            className="text-base after:!bg-primary data-active:text-foreground"
          >
            <TriangleIcon weight="fill" className="size-4" />
            Vercel
          </TabsTrigger>
          <TabsTrigger
            value="github-pages"
            className="text-base after:!bg-primary data-active:text-foreground"
          >
            <GithubLogoIcon weight="fill" className="size-4" />
            GitHub Pages
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vercel" className="pt-6">
          <VercelDeploymentTab
            vercel={vercel}
            vercelToken={vercelToken}
            showReplaceToken={showReplaceVercelToken}
            busy={busy}
            issue={vercelIssue}
            githubInstallations={githubInstallations}
            onTokenChange={onVercelTokenChange}
            onRefresh={onVercelRefresh}
            onSave={onVercelSave}
            onToggleReplaceToken={onToggleReplaceVercelToken}
          />
        </TabsContent>

        <TabsContent value="github-pages" className="pt-6">
          <GitHubPagesDeploymentTab
            token={githubPagesToken}
            username={githubPagesUsername}
            onTokenChange={setGithubPagesToken}
            onUsernameChange={setGithubPagesUsername}
          />
        </TabsContent>
      </Tabs>
    </StepCard>
  );
}
