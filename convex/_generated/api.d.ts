/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as authProviders_convexPlatform from "../authProviders/convexPlatform.js";
import type * as authProviders_github from "../authProviders/github.js";
import type * as client_apps from "../client/apps.js";
import type * as client_imports from "../client/imports.js";
import type * as client_providers_convex_clientActions from "../client/providers/convex/clientActions.js";
import type * as client_providers_githubPages_clientActions from "../client/providers/githubPages/clientActions.js";
import type * as client_providers_github_clientActions from "../client/providers/github/clientActions.js";
import type * as client_providers_vercel_clientActions from "../client/providers/vercel/clientActions.js";
import type * as client_viewer from "../client/viewer.js";
import type * as http from "../http.js";
import type * as importsActions from "../importsActions.js";
import type * as importsInternal from "../importsInternal.js";
import type * as lib_appStatus from "../lib/appStatus.js";
import type * as lib_apps from "../lib/apps.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_imports from "../lib/imports.js";
import type * as lib_onboarding from "../lib/onboarding.js";
import type * as lib_providers_convex_data from "../lib/providers/convex/data.js";
import type * as lib_providers_convex_platform from "../lib/providers/convex/platform.js";
import type * as lib_providers_githubPages_data from "../lib/providers/githubPages/data.js";
import type * as lib_providers_github_data from "../lib/providers/github/data.js";
import type * as lib_providers_github_platform from "../lib/providers/github/platform.js";
import type * as lib_providers_vercel_data from "../lib/providers/vercel/data.js";
import type * as lib_providers_vercel_platform from "../lib/providers/vercel/platform.js";
import type * as workflows_createApp from "../workflows/createApp.js";
import type * as workflows_createAppHelpers from "../workflows/createAppHelpers.js";
import type * as workflows_deleteApp from "../workflows/deleteApp.js";
import type * as workflows_githubAccessTokenAction from "../workflows/githubAccessTokenAction.js";
import type * as workflows_retryCreateApp from "../workflows/retryCreateApp.js";
import type * as workflows_stepConvex from "../workflows/stepConvex.js";
import type * as workflows_stepGithubRepoClone from "../workflows/stepGithubRepoClone.js";
import type * as workflows_stepGithubRepoTemplate from "../workflows/stepGithubRepoTemplate.js";
import type * as workflows_stepTypes from "../workflows/stepTypes.js";
import type * as workflows_stepUtils from "../workflows/stepUtils.js";
import type * as workflows_stepVercel from "../workflows/stepVercel.js";
import type * as workflows_templateConfig from "../workflows/templateConfig.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  "authProviders/convexPlatform": typeof authProviders_convexPlatform;
  "authProviders/github": typeof authProviders_github;
  "client/apps": typeof client_apps;
  "client/imports": typeof client_imports;
  "client/providers/convex/clientActions": typeof client_providers_convex_clientActions;
  "client/providers/githubPages/clientActions": typeof client_providers_githubPages_clientActions;
  "client/providers/github/clientActions": typeof client_providers_github_clientActions;
  "client/providers/vercel/clientActions": typeof client_providers_vercel_clientActions;
  "client/viewer": typeof client_viewer;
  http: typeof http;
  importsActions: typeof importsActions;
  importsInternal: typeof importsInternal;
  "lib/appStatus": typeof lib_appStatus;
  "lib/apps": typeof lib_apps;
  "lib/auth": typeof lib_auth;
  "lib/imports": typeof lib_imports;
  "lib/onboarding": typeof lib_onboarding;
  "lib/providers/convex/data": typeof lib_providers_convex_data;
  "lib/providers/convex/platform": typeof lib_providers_convex_platform;
  "lib/providers/githubPages/data": typeof lib_providers_githubPages_data;
  "lib/providers/github/data": typeof lib_providers_github_data;
  "lib/providers/github/platform": typeof lib_providers_github_platform;
  "lib/providers/vercel/data": typeof lib_providers_vercel_data;
  "lib/providers/vercel/platform": typeof lib_providers_vercel_platform;
  "workflows/createApp": typeof workflows_createApp;
  "workflows/createAppHelpers": typeof workflows_createAppHelpers;
  "workflows/deleteApp": typeof workflows_deleteApp;
  "workflows/githubAccessTokenAction": typeof workflows_githubAccessTokenAction;
  "workflows/retryCreateApp": typeof workflows_retryCreateApp;
  "workflows/stepConvex": typeof workflows_stepConvex;
  "workflows/stepGithubRepoClone": typeof workflows_stepGithubRepoClone;
  "workflows/stepGithubRepoTemplate": typeof workflows_stepGithubRepoTemplate;
  "workflows/stepTypes": typeof workflows_stepTypes;
  "workflows/stepUtils": typeof workflows_stepUtils;
  "workflows/stepVercel": typeof workflows_stepVercel;
  "workflows/templateConfig": typeof workflows_templateConfig;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  workflow: import("@convex-dev/workflow/_generated/component.js").ComponentApi<"workflow">;
};
