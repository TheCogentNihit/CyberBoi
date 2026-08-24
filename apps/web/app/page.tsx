"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useScanList } from "@/lib/polling";
import { ScanStatusBadge } from "@/components/scan/ScanStatusBadge";
import { SeverityBadge } from "@/components/findings/SeverityBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import type { Severity } from "@/lib/types";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export default function DashboardPage() {
  const { data: scans, isLoading, isError, refetch } = useScanList();

  return (
    <div className="space-y-12">
      {/* Hero section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <SpotlightCard className="p-12 md:p-16 border-primary/20 bg-card/10 text-center flex flex-col items-center">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 mb-8 glow-cyan shadow-lg shadow-primary/20 backdrop-blur-md">
            <svg
              className="h-10 w-10 text-primary drop-shadow-[0_0_8px_rgba(120,255,200,0.8)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-4 drop-shadow-md">
            Welcome to <span className="bg-gradient-to-r from-primary to-cyber-purple bg-clip-text text-transparent">CyberShield</span>
          </h2>
          <p className="max-w-2xl text-lg text-muted-foreground mb-10 leading-relaxed">
            AI-powered Android APK security analysis. Upload suspicious binaries for
            deep static, dynamic, and network introspection with real-time tracking.
          </p>
          <Link
            href="/scans/new"
            className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-primary px-8 py-4 font-semibold text-primary-foreground transition-all hover:scale-105 hover:glow-cyan shadow-lg shadow-primary/25"
          >
            <span className="absolute inset-0 bg-white/20 transition-transform duration-300 ease-out translate-y-full group-hover:translate-y-0" />
            <svg className="relative z-10 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <span className="relative z-10">Upload APK to Scan</span>
          </Link>
        </SpotlightCard>
      </motion.div>

      {/* Recent scans */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="space-y-6"
      >
        <div className="flex items-center gap-3 px-2">
          <div className="h-6 w-2 rounded-full bg-primary shadow-[0_0_10px_rgba(120,255,200,0.5)]" />
          <h3 className="text-2xl font-semibold tracking-tight">Recent Scans</h3>
        </div>

        <div className="w-full">
          {/* Loading state */}
          {isLoading && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <SpotlightCard key={i} className="p-6">
                  <div className="space-y-4">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <div className="pt-4 flex justify-between">
                      <Skeleton className="h-6 w-16" />
                      <Skeleton className="h-6 w-20" />
                    </div>
                  </div>
                </SpotlightCard>
              ))}
            </div>
          )}

          {/* Error state */}
          {isError && (
            <Alert className="border-destructive/40 bg-destructive/10 backdrop-blur-md">
              <AlertDescription className="flex items-center justify-between text-destructive">
                <span>Failed to load scans. Is the backend running?</span>
                <Button variant="outline" size="sm" onClick={() => refetch()} className="border-destructive/50 hover:bg-destructive/20">
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Empty state */}
          {!isLoading && !isError && scans && scans.length === 0 && (
            <SpotlightCard className="flex flex-col items-center justify-center py-20 text-center border-dashed">
              <div className="rounded-full bg-muted/30 p-6 mb-6">
                <svg className="h-10 w-10 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <h3 className="text-xl font-medium mb-2">No scans found</h3>
              <p className="text-muted-foreground mb-6 max-w-sm">
                Upload your first Android APK to analyze it for security vulnerabilities.
              </p>
              <Link
                href="/scans/new"
                className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
              >
                Upload now <span aria-hidden="true">→</span>
              </Link>
            </SpotlightCard>
          )}

          {/* Scans Grid */}
          {!isLoading && !isError && scans && scans.length > 0 && (
            <motion.div 
              variants={container}
              initial="hidden"
              animate="show"
              className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
            >
              {scans.map((scan) => (
                <motion.div key={scan.id} variants={item}>
                  <Link href={`/scans/${scan.id}`} className="block h-full outline-none">
                    <SpotlightCard className="h-full p-6 flex flex-col justify-between group">
                      <div>
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1 min-w-0 pr-4">
                            <h4 className="text-lg font-medium truncate group-hover:text-primary transition-colors">
                              {scan.apk_filename || "Unknown File"}
                            </h4>
                            <p className="text-sm text-muted-foreground mt-1 font-mono text-xs">
                              {scan.id}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-6">
                          <ScanStatusBadge status={scan.status} />
                          {scan.highest_severity && (
                            <SeverityBadge severity={scan.highest_severity as Severity} />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground pt-4 border-t border-border/30">
                        <span>{formatDate(scan.created_at)}</span>
                        <span className="inline-flex items-center opacity-0 -translate-x-4 transition-all group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-primary">
                          View details <span className="ml-1">→</span>
                        </span>
                      </div>
                    </SpotlightCard>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
