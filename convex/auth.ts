import GitHub from "@auth/core/providers/github";
import { convexAuth } from "@convex-dev/auth/server";
import Vercel from "./providers/vercel";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
    }),
    Vercel({
      clientId:
        process.env.AUTH_VERCEL_ID ?? process.env.NEXT_PUBLIC_VERCEL_CLIENT_ID!,
      clientSecret:
        process.env.AUTH_VERCEL_SECRET ?? process.env.VERCEL_CLIENT_SECRET!,
    }),
  ],
});
