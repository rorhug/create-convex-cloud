"use client";

export function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border border-border bg-background px-4 py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
