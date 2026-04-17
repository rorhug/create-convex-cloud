import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Create Convex Cloud",
  description: "Launch the final stack from your phone.",
  icons: {
    icon: "/convex.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html lang="en" suppressHydrationWarning className={cn("font-sans", inter.variable)}>
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
            <ConvexClientProvider>
              <main className="min-h-screen p-6">
                <header className="pb-6 flex justify-between items-center max-w-3xl mx-auto">
                  <h1 className="  text-sm uppercase tracking-[0.2em] text-muted-foreground font-semibold">
                    Create Convex Cloud
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

                {children}

                <footer className="pt-6 flex justify-center">
                  <div className="max-w-3xl w-full">
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <span>
                        Created by:{" "}
                        <a
                          href="https://vibepair.ai"
                          target="_blank"
                          className="underline underline-offset-2 hover:text-foreground hover:no-underline"
                        >
                          VibePair.ai
                        </a>
                      </span>
                      <span>·</span>
                      <Link
                        href="https://github.com/rorhug/create-convex-cloud"
                        className="underline underline-offset-2 hover:text-foreground hover:no-underline"
                        target="_blank"
                      >
                        GitHub
                      </Link>
                    </p>
                  </div>
                </footer>
              </main>
            </ConvexClientProvider>
          </ThemeProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
