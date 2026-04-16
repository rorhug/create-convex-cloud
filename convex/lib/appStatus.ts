import { v, type Infer } from "convex/values";

/** Shared by `apps.status` and `appSteps.status`. */
export const APP_STATUS_VALUES = [
  "pending",
  "creating",
  "ready",
  "deleting",
  "error",
] as const;

export const appStatusValidator = v.union(
  v.literal("pending"),
  v.literal("creating"),
  v.literal("ready"),
  v.literal("deleting"),
  v.literal("error"),
);

export type AppStatus = Infer<typeof appStatusValidator>;
