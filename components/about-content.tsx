import Link from "next/link";
import { ProviderLogo, ProviderLogoName } from "@/app/(auth)/setup/components/provider-logo";
import { SignInCard } from "@/components/sign-in-card";
import { CCC_TEMPLATE_REPO_URL, GITHUB_ISSUES_URL } from "@/lib/site";
import { Plus, PlusIcon } from "@phosphor-icons/react";

type AboutContentProps = {
  /** When true, show provider logos + sign-in card at the top (logged-out home / about). */
  showSignInCta?: boolean;
};

export function AboutContent({ showSignInCta = false }: AboutContentProps) {
  return (
    <div className="mx-auto max-w-3xl space-y-12 px-4 pb-16 pt-4 tracking-tight">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Launch the final stack from your phone.</h1>
        <p className="text-muted-foreground leading-relaxed">
          Connect GitHub, Convex, and Vercel once, then spin up full-stack apps in 30 seconds.
        </p>
      </div>

      {/* <PlusIcon />  */}

      {showSignInCta && <SignInCard />}

      <section className="space-y-6">
        <h2 className="text-center text-lg font-medium ">Connect your accounts</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col rounded-xl border border-border bg-card px-4 py-5 text-center">
            <div className="mb-3 flex justify-center">
              <ProviderLogo provider={ProviderLogoName.GitHub} />
            </div>
            <h3 className="text-sm font-semibold">GitHub</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-snug">
              Create repo from{" "}
              <Link
                href={CCC_TEMPLATE_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline underline-offset-2 hover:no-underline"
              >
                ccc-template
              </Link>
            </p>
          </div>
          <div className="flex flex-col rounded-xl border border-border bg-card px-4 py-5 text-center">
            <div className="mb-3 flex justify-center">
              <ProviderLogo provider={ProviderLogoName.Convex} />
            </div>
            <h3 className="text-sm font-semibold">Convex</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-snug">Realtime backend</p>
          </div>
          <div className="flex flex-col rounded-xl border border-border bg-card px-4 py-5 text-center">
            <div className="mb-3 flex justify-center">
              <ProviderLogo provider={ProviderLogoName.Vercel} />
            </div>
            <h3 className="text-sm font-semibold">Vercel</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-snug">
              Continuous deployment and frontend hosting
            </p>
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          <Link
            href={GITHUB_ISSUES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Looking for another platform?
          </Link>
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-center text-lg font-medium">Why use it</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold">One-click setup</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Wire accounts and generate a repo, Convex project, and Vercel deployment without juggling dashboards.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold">Built for coding agents</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Integrated backend and deploy keys so automated workflows can ship end-to-end changes safely.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold">Mobile friendly</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Start building apps from your phone—setup and monitoring work on small screens.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
