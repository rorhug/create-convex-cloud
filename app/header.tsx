"use client";

import { CloudIcon } from "@phosphor-icons/react";

export const Header = () => (
  <header className="pb-6 flex justify-between items-center max-w-3xl mx-auto">
    <h1 className="  text-sm uppercase tracking-[0.2em] text-muted-foreground font-semibold">
      <CloudIcon className="inline" /> Create Convex Cloud
    </h1>
    <div>
      <a
        href="https://vibepair.ai"
        target="_blank"
        className="underline text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:no-underline"
      >
        Get Human Help
      </a>
    </div>
  </header>
);
