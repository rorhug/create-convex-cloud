import { v, type Infer } from "convex/values";
import { appStatusValidator, type AppStatus } from "../lib/appStatus";

export { appStatusValidator, APP_STATUS_VALUES, type AppStatus } from "../lib/appStatus";

/** Same as `appStatusValidator` — use either name. */
export const stepStatusValidator = appStatusValidator;

export type StepStatus = AppStatus;

export const stepServiceValidator = v.union(
  v.literal("github"),
  v.literal("convex"),
  v.literal("vercel"),
  v.literal("github-pages"),
);

export type StepService = Infer<typeof stepServiceValidator>;
