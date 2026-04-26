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
  description: "Marketplace intel: buy USDC access to AI memory packs via Locus Checkout",
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
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        <div className="w-full border-b bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <a href="/" className="font-semibold">
              Interent
            </a>
            <a
              className="text-sm text-zinc-600 hover:text-zinc-900"
              href="https://docs.paywithlocus.com/checkout"
              target="_blank"
              rel="noreferrer"
            >
              Locus Checkout Docs
            </a>
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-8">
          {children}
        </div>
      </body>
    </html>
  );
}
