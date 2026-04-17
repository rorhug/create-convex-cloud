import Link from "next/link";
import { PlusIcon } from "@phosphor-icons/react";
import { ProviderLogo, ProviderLogoName } from "@/app/(auth)/setup/components/provider-logo";
import { SignInCard } from "@/components/sign-in-card";
import { CCC_TEMPLATE_REPO_URL, GITHUB_FEATURE_REQUEST_URL } from "@/lib/site";

type AboutContentProps = {
  /** When true, show provider logos + sign-in card at the top (logged-out home / about). */
  showSignInCta?: boolean;
};

export function AboutContent({ showSignInCta = false }: AboutContentProps) {
  return (
    <div className="mx-auto max-w-3xl space-y-12 pb-16 pt-4 tracking-tight">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Launch the final stack from your phone.</h1>
        <p className="text-muted-foreground leading-relaxed">
          Connect GitHub, Convex, and Vercel once, then spin up full-stack apps in 30 seconds.
        </p>
      </div>

      {showSignInCta && <SignInCard />}

      <section className="space-y-6">
        <h2 className="text-center text-lg font-medium ">Connect your accounts</h2>
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-stretch sm:gap-2">
          <ProviderCard
            logo={ProviderLogoName.GitHub}
            title="GitHub"
            body={
              <>
                Create{" "}
                <Link
                  href={CCC_TEMPLATE_REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary underline underline-offset-2 hover:no-underline"
                >
                  template
                </Link>{" "}
                repo
              </>
            }
          />

          <PlusIcon aria-hidden className="mx-auto size-4 shrink-0 text-muted-foreground sm:size-5 self-center" />
          <ProviderCard logo={ProviderLogoName.Convex} title="Convex" body="Realtime backend" />
          <PlusIcon aria-hidden className="mx-auto size-4 shrink-0 text-muted-foreground sm:size-5 self-center" />
          <ProviderCard logo={ProviderLogoName.Vercel} title="Vercel" body="CD and frontend hosting" />
        </div>
        <p className="text-center text-xs text-muted-foreground">
          <Link
            href={GITHUB_FEATURE_REQUEST_URL}
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
            <h3 className="text-sm font-semibold">Mobile friendly</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Build apps from your phone with the stack that scales to millions of users.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold">Cloud agent previews</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Each pull-request created by your cloud agent runs perfectly on a preview branch with its own DB.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function ProviderCard({ logo, title, body }: { logo: ProviderLogoName; title: string; body: React.ReactNode }) {
  return (
    <div className="flex flex-1 min-w-0 flex-col rounded-xl border border-border bg-card px-4 py-5 text-center justify-center">
      <div className="mb-3 flex justify-center">
        <ProviderLogo provider={logo} />
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground leading-snug">{body}</p>
    </div>
  );
}
