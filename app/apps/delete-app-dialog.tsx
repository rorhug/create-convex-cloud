"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

function joinCommaAnd(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function deleteConfirmationSureLabel(
  deleteGithub: boolean,
  deleteConvex: boolean,
  deleteVercel: boolean,
): string {
  const deleteParts: string[] = [];
  if (deleteGithub) deleteParts.push("the repo on GitHub");
  if (deleteConvex) deleteParts.push("the Convex project");
  if (deleteVercel) deleteParts.push("the Vercel project");

  const leaveParts: string[] = [];
  if (!deleteGithub) leaveParts.push("the GitHub repo");
  if (!deleteConvex) leaveParts.push("the Convex project");
  if (!deleteVercel) leaveParts.push("the Vercel project");

  const toRemove = [...deleteParts, "metadata from this product"];
  let main = `I am sure I want to delete ${joinCommaAnd(toRemove)}`;

  if (leaveParts.length > 0) {
    main += `, but leave ${joinCommaAnd(leaveParts)} intact`;
  }

  return main;
}

export function DeleteAppDialog({
  target,
  onClose,
}: {
  target: { id: Id<"apps">; name: string } | null;
  onClose: () => void;
}) {
  const deleteApp = useAction(api.client.apps.deleteApp);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [deleteGithub, setDeleteGithub] = useState(true);
  const [deleteConvex, setDeleteConvex] = useState(true);
  const [deleteVercel, setDeleteVercel] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function handleOpenChange(open: boolean) {
    if (!open && !isDeleting) {
      resetAndClose();
    }
  }

  function resetAndClose() {
    setConfirmChecked(false);
    setDeleteGithub(true);
    setDeleteConvex(true);
    setDeleteVercel(true);
    setIsDeleting(false);
    setDeleteError(null);
    onClose();
  }

  async function handleDelete() {
    if (!target) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteApp({
        id: target.id,
        deleteGithubRepo: deleteGithub,
        deleteConvexProject: deleteConvex,
        deleteVercelProject: deleteVercel,
      });
      resetAndClose();
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Could not delete the app",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Dialog open={target !== null} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete &ldquo;{target?.name}&rdquo;</DialogTitle>
          <DialogDescription>
            This will permanently delete the app and its resources.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-3 border border-border bg-muted/50 p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Resources to delete
            </p>
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={deleteGithub}
                onCheckedChange={(checked) => setDeleteGithub(checked === true)}
              />
              <span className="text-sm">Git repo</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={deleteConvex}
                onCheckedChange={(checked) => setDeleteConvex(checked === true)}
              />
              <span className="text-sm">Convex project</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={deleteVercel}
                onCheckedChange={(checked) => setDeleteVercel(checked === true)}
              />
              <span className="text-sm">Vercel project</span>
            </label>
          </div>

          <label className="flex cursor-pointer items-start gap-3">
            <Checkbox
              className="mt-0.5"
              checked={confirmChecked}
              onCheckedChange={(checked) => setConfirmChecked(checked === true)}
            />
            <span className="text-sm font-medium leading-snug">
              {deleteConfirmationSureLabel(
                deleteGithub,
                deleteConvex,
                deleteVercel,
              )}
            </span>
          </label>

          {deleteError && (
            <div className="border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {deleteError}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!confirmChecked || isDeleting}
            onClick={() => {
              void handleDelete();
            }}
          >
            {isDeleting ? "Deleting..." : "Confirm delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
