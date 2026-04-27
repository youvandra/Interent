import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
    "Marketplace intelligence: buy USDC access to AI memory packs via Locus Checkout",
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
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <a href="/" className="text-sm font-semibold tracking-tight">
              Interent
            </a>

            <nav className="flex items-center gap-2 text-sm">
              <a
                className="rounded-lg px-3 py-2 text-[--color-muted] hover:bg-[--color-surface] hover:text-[--color-text]"
                href="/skill"
              >
                SKILL.MD
              </a>
            </nav>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-6 py-10">{children}</main>

        <footer className="border-t border-[--color-border] bg-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-sm text-[--color-muted] sm:flex-row sm:items-center sm:justify-between">
            <div>© {new Date().getFullYear()} Interent</div>
            <div>Build untuk event internal (menggunakan teknologi Locus).</div>
          </div>
        </footer>
      </body>
    </html>
  );
}
