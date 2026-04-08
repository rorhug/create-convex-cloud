"use client";

type GitHubInstallationActionsProps = {
  installUrl: string;
  isRefreshing: boolean;
  disabled?: boolean;
  onRefresh: () => void;
};

export function GitHubInstallationActions({
  installUrl,
  isRefreshing,
  disabled = false,
  onRefresh,
}: GitHubInstallationActionsProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
        disabled={disabled}
        onClick={onRefresh}
      >
        {isRefreshing ? "Refreshing..." : "Refresh"}
      </button>
      <a
        href={installUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-slate-200"
      >
        Add orgs / repos
      </a>
    </div>
  );
}
