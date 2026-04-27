import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Interent",
  description:
    "Pay-per-use AI microservices marketplace — run OCR, translation, scraping, and more via Locus Checkout + Wrapped APIs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-white text-[--color-text]">
        <header className="sticky top-0 z-10 w-full border-b border-[--color-border] bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
            {/* Brand */}
            <a href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <span className="inline-block h-2.5 w-2.5 bg-[--color-primary]" />
              <span>Interent</span>
            </a>

            {/* Right actions */}
            <div className="hidden items-center gap-2 sm:flex">
              <a
                className="px-3 py-2 text-sm text-[--color-muted] hover:text-[--color-text]"
                href="/marketplace"
              >
                Tools
              </a>
              <a href="/skill">
                <Button size="sm">Agent guide</Button>
              </a>
            </div>

            {/* Mobile menu (no JS) */}
            <details className="relative sm:hidden">
              <summary className="list-none">
                <Button variant="secondary" size="sm" aria-label="Open menu">
                  <Menu className="h-4 w-4" />
                </Button>
              </summary>
              <div className="absolute right-0 mt-2 w-56 border border-[--color-border] bg-white p-2 shadow-[0_12px_48px_rgba(16,24,40,0.12)]">
                <a className="block px-3 py-2 text-sm hover:bg-[--color-surface]" href="/marketplace">
                  Tools
                </a>
                <div className="mt-2 px-3 pb-2">
                  <a href="/skill" className="block">
                    <Button size="sm" className="w-full">
                      Agent guide
                    </Button>
                  </a>
                </div>
              </div>
            </details>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-6 py-10">{children}</main>

        <footer className="border-t border-[--color-border] bg-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-sm text-[--color-muted] sm:flex-row sm:items-center sm:justify-between">
            <div>© {new Date().getFullYear()} Interent</div>
          </div>
        </footer>
      </body>
    </html>
  );
}
