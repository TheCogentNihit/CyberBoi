import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CyberShield — APK Security Analysis",
  description:
    "AI-powered Android APK security analysis platform. Upload, scan, and get detailed vulnerability reports.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
      >
        <ThemeProvider>
          <QueryProvider>
            {/* Background Effects */}
            <div className="bg-noise" />
            <div className="bg-cyber-blobs" />
            
            {/* Global header */}
            <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
              <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                <Link href="/" className="flex items-center gap-3 group">
                  {/* Shield icon */}
                  <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 transition-all group-hover:glow-cyan">
                    <svg
                      className="h-5 w-5 text-primary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-lg font-bold tracking-tight">
                      CyberShield
                    </h1>
                    <p className="text-xs text-muted-foreground hidden sm:block">
                      APK Security Analysis
                    </p>
                  </div>
                </Link>
                <div className="flex items-center gap-2">
                  <Link
                    href="/scans/new"
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 hover:glow-cyan"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    New Scan
                  </Link>
                  <ThemeToggle />
                </div>
              </div>
            </header>

            {/* Main content */}
            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
              {children}
            </main>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
