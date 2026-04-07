import { v, Infer } from "convex/values";

export const stepStatusValidator = v.union(
  v.literal("pending"),
  v.literal("running"),
  v.literal("done"),
  v.literal("error"),
);

export const stepServiceValidator = v.union(v.literal("github"), v.literal("convex"), v.literal("vercel"));

export type StepService = Infer<typeof stepServiceValidator>;
export type StepStatus = Infer<typeof stepStatusValidator>;
