import { customAction, customCtx, customMutation, customQuery } from "convex-helpers/server/customFunctions";
import { action, mutation, query } from "./_generated/server";
import { requireCurrentUser, requireCurrentUserId } from "./lib/auth";

export const userQuery = customQuery(
  query,
  customCtx(async (ctx) => {
    const user = await requireCurrentUser(ctx);
    return { user, userId: user._id };
  }),
);

export const userMutation = customMutation(
  mutation,
  customCtx(async (ctx) => {
    const user = await requireCurrentUser(ctx);
    return { user, userId: user._id };
  }),
);

export const userAction = customAction(
  action,
  customCtx(async (ctx) => {
    const userId = await requireCurrentUserId(ctx);
    return { userId };
  }),
);
