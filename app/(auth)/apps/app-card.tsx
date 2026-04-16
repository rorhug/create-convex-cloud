"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { AppStatus } from "@/convex/lib/appStatus";
import type { FunctionReturnType } from "convex/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemHeader,
  ItemTitle,
} from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";

const STATUS_VARIANT: Record<AppStatus, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "secondary",
  creating: "secondary",
  ready: "default",
  deleting: "outline",
  error: "destructive",
};

const APP_TITLE_SPINNER_STATUSES = new Set<AppStatus>(["pending", "creating", "deleting"]);

const STEP_LABELS: Record<string, string> = {
  github: "GitHub repo",
  convex: "Convex project",
  vercel: "Vercel deployment",
};

type AppSummary = {
  _id: Id<"apps">;
  name: string;
  status: AppStatus;
  createdAt: number;
};

export function AppList({
  apps,
  onDelete,
}: {
  apps: AppSummary[] | undefined;
  onDelete: (app: { id: Id<"apps">; name: string }) => void;
}) {
  return (
    <section>
      <h2 className="text-xl font-semibold">Your apps</h2>
      <div className="mt-4">
        {apps === undefined && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            Loading existing apps...
          </div>
        )}
        {apps?.length === 0 && (
          <p className="text-sm text-muted-foreground">No apps yet. Create your first one above.</p>
        )}
        <ItemGroup>
          {apps?.map((app) => (
            <AppCard key={app._id} app={app} onDelete={onDelete} />
          ))}
        </ItemGroup>
      </div>
    </section>
  );
}

function AppCard({ app, onDelete }: { app: AppSummary; onDelete: (app: { id: Id<"apps">; name: string }) => void }) {
  return (
    <Item variant="outline" className=" p-6">
      <ItemHeader className="items-start">
        <ItemContent>
          <ItemTitle>
            {APP_TITLE_SPINNER_STATUSES.has(app.status) && <Spinner className="size-3.5" />}
            {app.name}
            <Badge variant={STATUS_VARIANT[app.status]}>{app.status}</Badge>
          </ItemTitle>
          <ItemDescription>
            <DeploymentUrl appId={app._id} />
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button
            variant="secondary"
            size="sm"
            disabled={app.status === "deleting"}
            onClick={() => onDelete({ id: app._id, name: app.name })}
          >
            Delete
          </Button>
        </ItemActions>
      </ItemHeader>
      <ItemFooter>
        <DashboardLinks appId={app._id} />
      </ItemFooter>
      {app.status !== "ready" ? (
        <div className="w-full pt-1">
          <StepProgress appId={app._id} />
        </div>
      ) : null}
    </Item>
  );
}

function DeploymentUrl({ appId }: { appId: Id<"apps"> }) {
  const url = useQuery(api.client.apps.getAppDeploymentUrl, { appId });
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block text-xs text-primary hover:underline"
    >
      {url}
    </a>
  );
}

function DashboardLinks({ appId }: { appId: Id<"apps"> }) {
  const links = useQuery(api.client.apps.getAppDashboardLinks, { appId });
  const [hoveredHref, setHoveredHref] = useState<string | null>(null);
  if (!links) return null;
  const items: Array<{ label: string; href: string }> = [];
  if (links.github) items.push({ label: "GitHub", href: links.github });
  if (links.vercel) items.push({ label: "Vercel", href: links.vercel });
  if (links.convex) items.push({ label: "Convex", href: links.convex });
  if (items.length === 0) return null;
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="flex items-center shrink-0 text-muted-foreground">
        {items.map((item, i) => (
          <span key={item.label}>
            {i > 0 ? <span className="px-2">·</span> : null}
            <a
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium hover:text-foreground hover:underline"
              onMouseEnter={() => setHoveredHref(item.href)}
              onMouseLeave={() => setHoveredHref(null)}
            >
              {item.label}
            </a>
          </span>
        ))}
      </span>
      {hoveredHref ? <span className="truncate text-muted-foreground">{hoveredHref}</span> : null}
    </div>
  );
}

function StepIcon({ status }: { status: AppStatus }) {
  switch (status) {
    case "ready":
      return <span className="text-primary">&#10003;</span>;
    case "creating":
    case "deleting":
      return <Spinner className="size-3" />;
    case "error":
      return <span className="text-destructive">&#10007;</span>;
    default:
      return <span className="text-muted-foreground/50">&#9675;</span>;
  }
}

function StepProgress({ appId }: { appId: Id<"apps"> }) {
  const steps = useQuery(api.client.apps.getAppSteps, { appId });

  if (!steps || steps.length === 0) return null;

  return (
    <div className="space-y-1">
      {steps.map((s: FunctionReturnType<typeof api.client.apps.getAppSteps>[number]) => (
        <div key={s.step} className="flex items-start gap-2 text-xs">
          <StepIcon status={s.status} />
          <span
            className={
              s.status === "error"
                ? "text-destructive"
                : s.status === "ready"
                  ? "text-muted-foreground"
                  : s.status === "creating" || s.status === "deleting"
                    ? "text-foreground"
                    : "text-muted-foreground/50"
            }
          >
            {STEP_LABELS[s.step] ?? s.step}
            {s.message ? ` — ${s.message}` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}
