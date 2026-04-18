"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type AppsGithubInstallation = {
  id: string;
  accountId: number;
  accountLogin: string;
  accountType: string;
  repositorySelection: string;
};

export type AppsVercelTeam = {
  id: string;
  name?: string | undefined;
  slug: string;
};

export type CreateAppFormValues = {
  name: string;
  githubInstallationId: string;
  vercelTeamId: string;
  githubRepoVisibility: "public" | "private";
};

const GO_TO_SETUP_VALUE = "__go-to-setup__";

const formSchema = z.object({
  name: z.string().trim().min(1, "Enter an app name"),
  githubInstallationId: z.string().min(1, "Select a GitHub installation"),
  vercelTeamId: z.string().min(1, "Select a Vercel team"),
  githubRepoVisibility: z.enum(["public", "private"], {
    message: "Select a GitHub repository visibility",
  }),
});

type FormSchema = z.infer<typeof formSchema>;

export type CreateAppFormDefaults = {
  name: string;
  githubInstallationId: string;
  vercelTeamId: string;
  githubRepoVisibility: "" | "public" | "private";
};

export function CreateAppForm({
  defaultValues,
  githubInstallations,
  vercelTeams,
  onSubmit,
}: {
  defaultValues: CreateAppFormDefaults;
  githubInstallations: AppsGithubInstallation[];
  vercelTeams: AppsVercelTeam[];
  onSubmit: (values: CreateAppFormValues) => Promise<void>;
}) {
  const router = useRouter();

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    // The visibility field is typed as `"public" | "private"` in the schema,
    // but the real default may be an empty string when no prior app exists.
    // Cast once here; zod will surface a validation error on submit if empty.
    defaultValues: defaultValues as unknown as FormSchema,
  });

  const personalGithubInstallations = githubInstallations.filter(
    (installation) => installation.accountType.toLowerCase() !== "organization",
  );
  const organizationGithubInstallations = githubInstallations.filter(
    (installation) => installation.accountType.toLowerCase() === "organization",
  );

  async function handleSubmit(values: FormSchema) {
    try {
      await onSubmit({
        name: values.name,
        githubInstallationId: values.githubInstallationId,
        vercelTeamId: values.vercelTeamId.trim(),
        githubRepoVisibility: values.githubRepoVisibility,
      });
      // Keep the last-selected installation / team / visibility, but clear the name.
      form.reset({ ...values, name: "" });
    } catch (error) {
      form.setError("root", {
        message: error instanceof Error ? error.message : "Could not create the app",
      });
    }
  }

  const rootError = form.formState.errors.root?.message;
  const isSubmitting = form.formState.isSubmitting;
  const hasGithubInstallations = githubInstallations.length > 0;
  const hasVercelTeams = vercelTeams.length > 0;

  return (
    <section className="border border-border bg-card p-6">
      <form onSubmit={form.handleSubmit(handleSubmit)}>
        <FieldGroup>
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="app-name">New App</FieldLabel>
                <Input
                  {...field}
                  id="app-name"
                  placeholder="my-demo-app"
                  aria-invalid={fieldState.invalid}
                  className="w-full"
                />
                {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
              </Field>
            )}
          />

          <div className="flex flex-col gap-4 md:flex-row">
            <Controller
              name="githubInstallationId"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="min-w-0 flex-1">
                  <FieldLabel htmlFor="github-installation">GitHub Profile / Org</FieldLabel>
                  <Select
                    name={field.name}
                    value={field.value}
                    onValueChange={(value) => {
                      if (value === GO_TO_SETUP_VALUE) {
                        router.push("/setup");
                        return;
                      }
                      field.onChange(value);
                    }}
                  >
                    <SelectTrigger
                      id="github-installation"
                      aria-invalid={fieldState.invalid}
                      className="w-full"
                    >
                      <SelectValue placeholder="Select an installation…" />
                    </SelectTrigger>
                    <SelectContent>
                      {personalGithubInstallations.length > 0 ? (
                        <SelectGroup>
                          <SelectLabel>Personal</SelectLabel>
                          {personalGithubInstallations.map((installation) => (
                            <SelectItem key={installation.id} value={installation.id}>
                              {installation.accountLogin}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ) : null}
                      {personalGithubInstallations.length > 0 &&
                      organizationGithubInstallations.length > 0 ? (
                        <SelectSeparator />
                      ) : null}
                      {organizationGithubInstallations.length > 0 ? (
                        <SelectGroup>
                          <SelectLabel>Orgs</SelectLabel>
                          {organizationGithubInstallations.map((installation) => (
                            <SelectItem key={installation.id} value={installation.id}>
                              {installation.accountLogin}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ) : null}
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>GitHub Access</SelectLabel>
                        <SelectItem value={GO_TO_SETUP_VALUE}>Go to setup</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                </Field>
              )}
            />

            <Controller
              name="githubRepoVisibility"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="min-w-0 flex-1">
                  <FieldLabel htmlFor="github-visibility">GitHub repository</FieldLabel>
                  <Select
                    name={field.name}
                    value={field.value}
                    onValueChange={(value) => {
                      if (value === "public" || value === "private") {
                        field.onChange(value);
                      }
                    }}
                  >
                    <SelectTrigger
                      id="github-visibility"
                      aria-invalid={fieldState.invalid}
                      className="w-full"
                    >
                      <SelectValue placeholder="Public or private…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>GitHub repository visibility</SelectLabel>
                        <SelectItem value="public">Public</SelectItem>
                        <SelectItem value="private">Private</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                </Field>
              )}
            />

            <Controller
              name="vercelTeamId"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="min-w-0 flex-1">
                  <FieldLabel htmlFor="vercel-team">Vercel team</FieldLabel>
                  <Select
                    name={field.name}
                    value={field.value}
                    onValueChange={(value) => {
                      if (value === GO_TO_SETUP_VALUE) {
                        router.push("/setup");
                        return;
                      }
                      field.onChange(value);
                    }}
                  >
                    <SelectTrigger
                      id="vercel-team"
                      aria-invalid={fieldState.invalid}
                      className="w-full"
                    >
                      <SelectValue
                        placeholder={hasVercelTeams ? "Select a team…" : "No teams available"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Vercel teams</SelectLabel>
                        {vercelTeams.map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>Vercel Access</SelectLabel>
                        <SelectItem value={GO_TO_SETUP_VALUE}>Go to setup</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                </Field>
              )}
            />
          </div>

          {!hasGithubInstallations ? (
            <FieldDescription className="border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
              No GitHub App installations on file yet. Go to setup to add your personal account
              or an organization.
            </FieldDescription>
          ) : null}

          {!hasVercelTeams ? (
            <FieldDescription className="border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
              No Vercel teams on file (your personal team should appear after you{" "}
              <Link href="/setup" className="underline hover:text-foreground">
                verify your Vercel token again
              </Link>
              ).
            </FieldDescription>
          ) : null}

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting || !hasGithubInstallations || !hasVercelTeams}
          >
            {isSubmitting ? "Creating..." : "Create app"}
          </Button>

          {rootError ? (
            <div className="border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {rootError}
            </div>
          ) : null}
        </FieldGroup>
      </form>
    </section>
  );
}
