# Workflow

Simplify programming long running code flows. Workflows execute durably with configurable retries and delays.

## Install

```bash
npm install @convex-dev/workflow
```

## Links

- [npm package](https://www.npmjs.com/package/%40convex-dev%2Fworkflow)
- [GitHub repository](https://github.com/get-convex/workflow)
- [Convex Components Directory](https://www.convex.dev/components/workflow)

**Author:** get-convex

**Category:** Durable Functions

**Version:** 0.3.5  
**Weekly downloads:** 44,341

**Tags:** workflow, determinism, durable-execution

---

## Description

The Workflow component adds durable execution to Convex functions, allowing you to build reliable long-running processes that survive server restarts and handle failures gracefully. It combines queries, mutations, and actions into deterministic workflows with configurable retry policies, parallel execution, and reactive status monitoring. Workflows can run for months with custom delays, be canceled mid-execution, and provide real-time progress updates to multiple subscribers.

## Use cases

• **User onboarding flows** that span multiple days with email verification, content generation, and follow-up messages that must complete reliably
• **Data processing pipelines** that orchestrate multiple API calls, transformations, and database updates with automatic retries on transient failures
• **Payment and fulfillment workflows** that coordinate between payment processors, inventory systems, and shipping APIs with precise error handling
• **Content moderation systems** that combine AI analysis, human review queues, and notification steps with configurable delays between stages
• **Batch job orchestration** that processes large datasets by coordinating multiple parallel workers with backpressure and failure recovery

## How it works

You define workflows using `workflow.define()` with deterministic handler functions that orchestrate Convex queries, mutations, and actions through a step context. The component restricts access to non-deterministic APIs like `fetch` and patches others like `Math.random()` to ensure reproducible execution across server restarts.

Workflows are started from mutations or actions using `workflow.start()`, which returns a `WorkflowId` for tracking progress. Steps execute via `ctx.runQuery()`, `ctx.runMutation()`, and `ctx.runAction()` methods, with results passed between steps. Parallel execution happens through `Promise.all()` calls, while retry behavior is configured per-step or globally through workpool options.

The component provides reactive status monitoring through `workflow.status()`, cancellation with `workflow.cancel()`, and completion handling via `onComplete` callbacks. Failed workflows can be restarted from specific steps using `workflow.restart()`, and the system automatically manages step parallelism and resource cleanup.

---

### From the README.md

# Convex Durable Workflows

Have you ever wanted to run a series of functions reliably and durably, where
each can have its own retry behavior, the overall workflow will survive server
restarts, and you can have long-running workflows spanning months that can be
canceled? Do you want to observe the status of a workflow reactively, as well as
the results written from each step?

And do you want to do this with code, instead of a static configuration?

Welcome to the world of Convex workflows.

- Run workflows asynchronously, and observe their status reactively via
  subscriptions, from one or many users simultaneously, even on page refreshes.
- Workflows can run for months, and survive server restarts. You can specify
  delays or custom times to run each step.
- Run steps in parallel, or in sequence.
- Output from previous steps is available to pass to subsequent steps.
- Run queries, mutations, and actions.
- Specify retry behavior on a per-step basis, along with a default policy.
- Specify how many workflow steps can run in parallel to manage load.
- Cancel long-running workflows.
- Restart previously-failed workflows from a specific step.
- Clean up workflows after they're done.

```ts
import { WorkflowManager } from "@convex-dev/workflow";
import { components } from "./_generated/api";

export const workflow = new WorkflowManager(components.workflow);

export const userOnboarding = workflow.define({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<void> => {
    const status = await ctx.runMutation(
      internal.emails.sendVerificationEmail,
      { storageId: args.storageId },
    );

    if (status === "needsVerification") {
      // Waits until verification is completed asynchronously.
      await ctx.awaitEvent({ name: "verificationEmail" });
    }
    const result = await ctx.runAction(
      internal.llm.generateCustomContent,
      { userId: args.userId },
      // Retry this on transient errors with the default retry policy.
      { retry: true },
    );
    if (result.needsHumanInput) {
      // Run a whole workflow as a single step.
      await ctx.runWorkflow(internal.llm.refineContentWorkflow, {
        userId: args.userId,
      });
    }

    await ctx.runMutation(
      internal.emails.sendFollowUpEmailMaybe,
      { userId: args.userId },
      // Runs one day after the previous step.
      { runAfter: 24 * 60 * 60 * 1000 },
    );
  },
});
```

This component adds durably executed _workflows_ to Convex. Combine Convex
queries, mutations, and actions into long-lived workflows, and the system will
always fully execute a workflow to completion.

Open a [GitHub issue](https://github.com/get-convex/workflow/issues) with any
feedback or bugs you find.

## Installation

First, add `@convex-dev/workflow` to your Convex project:

```sh
npm install @convex-dev/workflow
```

Then, install the component within your `convex/convex.config.ts` file:

```ts
// convex/convex.config.ts
import workflow from "@convex-dev/workflow/convex.config.js";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(workflow);
export default app;
```

Finally, create a workflow manager within your `convex/` folder, and point it to
the installed component:

```ts
// convex/index.ts
import { WorkflowManager } from "@convex-dev/workflow";
import { components } from "./_generated/api";

export const workflow = new WorkflowManager(components.workflow);
```

## Usage

The first step is to define a workflow using `workflow.define()`. This function
is designed to feel like a Convex action but with a few restrictions:

1. The workflow runs in the background, so it can't return a value.
2. The workflow must be _deterministic_, so it should implement most of its
   logic by calling out to other Convex functions. We restrict access to some
   non-deterministic functions like `fetch` and `crypto`. Others we patch, such
   as `console` for logging, `Math.random()` (seeded PRNG) and `Date` for time.

Note: To help avoid type cycles, always annotate the return type of the
`handler` with the return type of the workflow.

```ts
export const exampleWorkflow = workflow.define({
  args: { name: v.string() },
  returns: v.string(),
  handler: async (step, args): Promise<string> => {
    //                         ^ Specify the return type of the handler
    const queryResult = await step.runQuery(
      internal.example.exampleQuery,
      args,
    );
    const actionResult = await step.runAction(
      internal.example.exampleAction,
      { queryResult }, // pass in results from previous steps!
    );
    return actionResult;
  },
});

export const exampleQuery = internalQuery({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    return `The query says... Hi ${args.name}!`;
  },
});

export const exampleAction = internalAction({
  args: { queryResult: v.string() },
  handler: async (ctx, args) => {
    return args.queryResult + " The action says... Hi back!";
  },
});
```

### Starting a workflow

Once you've defined a workflow, you can start it from a mutation or action using
`workflow.start()`.

```ts
export const kickoffWorkflow = mutation({
  handler: async (ctx) => {
    const workflowId = await workflow.start(
      ctx,
      internal.example.exampleWorkflow,
      { name: "James" },
    );
  },
});
```

### Handling the workflow's result with onComplete

You can handle the workflow's result with `onComplete`. This is useful for
cleaning up any resources used by the workflow.

Note: when you return things from a workflow, you'll need to specify the return
type of your `handler` to break type cycles due to using `internal.*` functions
in the body, which then inform the type of the workflow, which is included in
the `internal.*` type.

You can also specify a `returns` validator to do runtime validation on the
return value. If it fails, your `onComplete` handler will be called with an
error instead of success. You can also do validation in the `onComplete` handler
to have more control over handling that situation.

```ts
import { vWorkflowId } from "@convex-dev/workflow";
import { vResultValidator } from "@convex-dev/workpool";

export const foo = mutation({
  handler: async (ctx) => {
    const name = "James";
    const workflowId = await workflow.start(
      ctx,
      internal.example.exampleWorkflow,
      { name },
      {
        onComplete: internal.example.handleOnComplete,
        context: name, // can be anything
      },
    );
  },
});

export const handleOnComplete = mutation({
  args: {
    workflowId: vWorkflowId,
    result: vResultValidator,
    context: v.any(), // used to pass through data from the start site.
  },
  handler: async (ctx, args) => {
    const name = (args.context as { name: string }).name;
    if (args.result.kind === "success") {
      const text = args.result.returnValue;
      console.log(`${name} result: ${text}`);
    } else if (args.result.kind === "error") {
      console.error("Workflow failed", args.result.error);
    } else if (args.result.kind === "canceled") {
      console.log("Workflow canceled", args.context);
    }
  },
});
```

### Running steps in parallel

You can run steps in parallel by calling `step.runAction()` multiple times in a
`Promise.all()` call.

```ts
export const exampleWorkflow = workflow.define({
  args: { name: v.string() },
  handler: async (step, args): Promise<void> => {
    const [result1, result2] = await Promise.all([
      step.runAction(internal.example.myAction, args),
      step.runAction(internal.example.myAction, args),
    ]);
  },
});
```

Note: The workflow will not proceed until all steps fired off at once have
completed.

### Specifying retry behavior

Sometimes actions fail due to transient errors, whether it was an unreliable
third-party API or a server restart. You can have the workflow automatically
retry actions using best practices (exponential backoff & jitter). By default
there are no retries, and the workflow will fail.

You can specify default retry behavior for all workflows on the WorkflowManager,
or override it on a per-workflow basis.

You can also specify a custom retry behavior per-step, to opt-out of retries for
actions that may want at-most-once semantics.

Workpool options:

If you specify any of these, it will override the
[`DEFAULT_RETRY_BEHAVIOR`](./src/component/pool.ts).

- `defaultRetryBehavior`: The default retry behavior for all workflows.
  - `maxAttempts`: The maximum number of attempts to retry an action.
  - `initialBackoffMs`: The initial backoff time in milliseconds.
  - `base`: The base multiplier for the backoff. Default is 2.
- `retryActionsByDefault`: Whether to retry actions, by default is false.
  - If you specify a retry behavior at the step level, it will always retry.

At the step level, you can also specify `true` or `false` to disable or use the
default policy.

```ts
const workflow = new WorkflowManager(components.workflow, {
  workpoolOptions: {
    defaultRetryBehavior: {
      maxAttempts: 3,
      initialBackoffMs: 100,
      base: 2,
    },
    retryActionsByDefault: true, // default is false
   }
});

export const exampleWorkflow = workflow.define({
  args: { name: v.string() },
  handler: async (step, args): Promise<void> => {
    // Uses default retry behavior & retryActionsByDefault
    await step.runAction(internal.example.myAction, args);
    // Retries will be attempted with the default behavior
    await step.runAction(internal.example.myAction, args, { retry: true });
    // No retries will be attempted
    await step.runAction(internal.example.myAction, args, { retry: false });
    // Custom retry behavior will be used
    await step.runAction(internal.example.myAction, args, {
      retry: { maxAttempts: 2, initialBackoffMs: 100, base: 2 },
    });
  },
  // If specified, this will override the workflow manager's default
  workpoolOptions: { ... },
});
```

### Specifying step parallelism

You can specify how many steps can run in parallel by setting the
`maxParallelism` workpool option. It has a reasonable default. On the free tier,
you should not exceed 20, otherwise your other scheduled functions may become
delayed while competing for available functions with your workflow steps. On a
Pro account, you should not exceed 100 across all your workflows and workpools.
If you want to do a lot of work in parallel, you should employ batching, where
each workflow operates on a batch of work, e.g. scraping a list of links instead
of one link per workflow.

```ts
const workflow = new WorkflowManager(components.workflow, {
  workpoolOptions: {
    // You must only set this to one value per components.xyz!
    // You can set different values if you "use" multiple different components
    // in convex.config.ts.
    maxParallelism: 10,
  },
});
```

### Checking a workflow's status

The `workflow.start()` method returns a `WorkflowId`, which can then be used for
querying a workflow's status.

```ts
export const kickoffWorkflow = action({
  handler: async (ctx) => {
    const workflowId = await workflow.start(
      ctx,
      internal.example.exampleWorkflow,
      { name: "James" },
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const status = await workflow.status(ctx, workflowId);
    console.log("Workflow status after 1s", status);
  },
});
```

### Canceling a workflow

You can cancel a workflow with `workflow.cancel()`, halting the workflow's
execution immmediately. In-progress calls to `step.runAction()`, however, will
finish executing.

```ts
export const kickoffWorkflow = action({
  handler: async (ctx) => {
    const workflowId = await workflow.start(
      ctx,
      internal.example.exampleWorkflow,
      { name: "James" },
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Cancel the workflow after 1 second.
    await workflow.cancel(ctx, workflowId);
  },
});
```

### Restart a failed workflow

If you want to re-run a workflo

[README truncated for prompt length]

---

[![Convex Component](https://www.convex.dev/components/badge/workflow)](https://www.convex.dev/components/workflow)
