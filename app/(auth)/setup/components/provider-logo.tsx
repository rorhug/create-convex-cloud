"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

export enum ProviderLogoName {
  GitHub = "github",
  Vercel = "vercel",
  Convex = "convex",
}

const PROVIDER_LOGOS = {
  [ProviderLogoName.GitHub]: {
    alt: "GitHub",
    lightSrc: "/github-logo.svg",
    darkSrc: "/github-logo-white.svg",
    width: 416,
    height: 99,
  },
  [ProviderLogoName.Vercel]: {
    alt: "Vercel",
    lightSrc: "/vercel-logo.svg",
    darkSrc: "/vercel-logo-white.svg",
    width: 2048,
    height: 407,
  },
  [ProviderLogoName.Convex]: {
    alt: "Convex",
    lightSrc: "/convex-logo.svg",
    darkSrc: "/convex-logo-white.svg",
    width: 284,
    height: 55,
  },
} as const;

export function ProviderLogo({ provider, className }: { provider: ProviderLogoName; className?: string }) {
  const logo = PROVIDER_LOGOS[provider];

  return (
    <div className={cn("inline-flex items-center", className)}>
      <Image
        src={logo.lightSrc}
        alt={logo.alt}
        width={logo.width}
        height={logo.height}
        className="h-6 w-auto dark:hidden"
      />
      <Image
        src={logo.darkSrc}
        alt={logo.alt}
        width={logo.width}
        height={logo.height}
        className="hidden h-6 w-auto dark:block"
      />
    </div>
  );
}
