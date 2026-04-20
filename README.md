# Create Convex Cloud

**Launch the final stack from your phone.**

Connect GitHub, Convex, and Vercel once, then spin up full-stack apps in 30 seconds.

Deployed here: [https://createconvex.cloud](https://createconvex.cloud)

## How it works

Connect your accounts, and each new app gets:

- **GitHub**: a repo created from the [ccc-template](https://github.com/rorhug/ccc-template) template. The template repo is synced from [this official repo](https://github.com/get-convex/templates/tree/main/template-nextjs-convexauth) with a few files added for smooth preview deployments.
- **Convex**: a realtime backend project (with prod + preview deploy keys).
- **Vercel**: CD and frontend hosting, wired to the new repo.
- **GitHub Pages (optional)**: an included workflow (`.github/workflows/deploy-github-pages.yml`) can deploy with the same Convex+Next build command used in `vercel.json`.

Missing a platform you care about? [Open a feature request](https://github.com/rorhug/create-convex-cloud/issues/new?template=feature_request.yml).

## Why use it

- **One-click setup**: Wire accounts and generate a repo, Convex project, and Vercel deployment without juggling dashboards.
- **Mobile friendly**: Build apps from your phone with a stack that scales to millions of users.
- **Cloud agent previews**: Each pull-request created by your cloud agent runs on a preview branch with its own DB, with authentication working out of the box.

## Stack

- [Convex](https://convex.dev/): database, server logic, realtime
- [Convex Auth](https://labs.convex.dev/auth): authentication (GitHub + Convex OAuth)
- [Next.js](https://nextjs.org/): hosting + routing
- [React](https://react.dev/): UI
- [Tailwind CSS](https://tailwindcss.com/): styling

## Local development

```
npm install
npm run dev
```

`npm run dev` runs the Next.js frontend and `npx convex dev` in parallel. Copy `.env.example` to `.env.local` and fill in the GitHub OAuth + Convex platform credentials before the first run.

## Learn more

- [Tour of Convex](https://docs.convex.dev/get-started): introduction to Convex principles.
- [Convex docs](https://docs.convex.dev/): full feature reference.
- [Convex Auth docs](https://labs.convex.dev/auth): authentication patterns.
- [Stack](https://stack.convex.dev/): in-depth articles on advanced topics.

## Community

- [Convex Discord](https://convex.dev/community): real-time help.
- [Convex on GitHub](https://github.com/get-convex/): star and contribute to the open-source Convex backend.
