"use client";

import { Button } from "@/components/ui/button";

type GitHubInstallationActionsProps = {
  installUrl: string;
  isRefreshing: boolean;
  disabled?: boolean;
  onRefresh: () => void;
  layout?: "row" | "column";
  size?: "default" | "sm";
};

export function GitHubInstallationActions({
  installUrl,
  isRefreshing,
  disabled = false,
  onRefresh,
  layout = "row",
  size = "default",
}: GitHubInstallationActionsProps) {
  const buttonClassName =
    layout === "column" ? "w-full justify-start" : undefined;

  return (
    <div
      className={
        layout === "column" ? "flex flex-col gap-2" : "flex flex-wrap gap-3"
      }
    >
      <Button
        variant="outline"
        size={size}
        className={buttonClassName}
        disabled={disabled}
        onClick={onRefresh}
      >
        {isRefreshing ? "Refreshing..." : "Refresh"}
      </Button>
      <Button asChild size={size} className={buttonClassName}>
        <a
          href={installUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Add orgs / repos
        </a>
      </Button>
    </div>
  );
}
