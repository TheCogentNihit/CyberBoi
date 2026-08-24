"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useScanDetail, useScanStatus } from "@/lib/polling";
import { ScanStatusBadge } from "@/components/scan/ScanStatusBadge";
import { WorkerOfflineBanner } from "@/components/scan/WorkerOfflineBanner";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { RUNNING_STATUSES } from "@/lib/types";
import type { ScanStatus } from "@/lib/types";
import { useState, useEffect } from "react";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ElapsedTime({ startedAt }: { startedAt: string | null }) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    if (!startedAt) return;
    const start = new Date(startedAt).getTime();

    const update = () => {
      const diff = Math.floor((Date.now() - start) / 1000);
      const m = Math.floor(diff / 60);
      const s = diff % 60;
      setElapsed(`${m}m ${s}s`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  if (!startedAt) return null;
  return (
    <span className="font-mono text-sm text-muted-foreground">{elapsed}</span>
  );
}

export default function ScanDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const scanId = params.id as string;

  const { data: scan, isLoading, isError, refetch } = useScanDetail(scanId);
  const { data: statusData } = useScanStatus(scanId);
  const [copied, setCopied] = useState(false);

  const currentStatus = (statusData?.status || scan?.status || "created") as ScanStatus;
  const isRunning = RUNNING_STATUSES.includes(currentStatus);

  const tabs = [
    { href: `/scans/${scanId}`, label: "Overview" },
    { href: `/scans/${scanId}/findings`, label: "Findings" },
    { href: `/scans/${scanId}/logs`, label: "Logs" },
    { href: `/scans/${scanId}/report`, label: "Report" },
  ];

  const copyHash = () => {
    if (scan?.sha256) {
      navigator.clipboard.writeText(scan.sha256);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-48 md:col-span-2" />
        </div>
      </div>
    );
  }

  if (isError || !scan) {
    return (
      <Alert className="border-destructive/40 bg-destructive/10 backdrop-blur-md">
        <AlertDescription className="flex items-center justify-between">
          <span>Couldn&apos;t reach CyberShield backend</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Spotlight Card */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <SpotlightCard className="p-6 md:p-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    {scan.apk_filename || "Scan"}
                  </h2>
                  <ScanStatusBadge status={currentStatus} />
                </div>

                {/* Metadata row */}
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground pt-1">
                  {scan.sha256 && (
                    <button
                      onClick={copyHash}
                      className="flex items-center gap-1.5 font-mono text-xs hover:text-primary hover:bg-primary/10 px-2 py-1 -ml-2 rounded transition-colors"
                      title="Click to copy SHA-256"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                      </svg>
                      {scan.sha256.substring(0, 16)}…
                      {copied && <span className="text-primary ml-1">Copied!</span>}
                    </button>
                  )}
                  {scan.package_name && <span className="px-2 py-1 rounded bg-muted/50">{scan.package_name}</span>}
                  {scan.version && <span className="px-2 py-1 rounded bg-muted/50">v{scan.version}</span>}
                  {scan.apk_size_bytes && <span className="px-2 py-1 rounded bg-muted/50">{formatBytes(scan.apk_size_bytes)}</span>}
                </div>
              </div>

              {isRunning && scan.started_at && (
                <div className="flex items-center gap-2 text-sm bg-background/50 backdrop-blur-sm px-4 py-2 rounded-lg border border-border/50 shadow-sm">
                  <div className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </div>
                  <ElapsedTime startedAt={scan.started_at} />
                </div>
              )}
            </div>

            {/* Worker offline banner */}
            {isRunning && statusData && (
              <WorkerOfflineBanner
                workerLastSeenSecondsAgo={statusData.worker_last_seen_seconds_ago}
              />
            )}

            {/* Progress bar */}
            {isRunning && (
              <div className="space-y-2 mt-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground font-medium flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {statusData?.current_stage || "Processing…"}
                  </span>
                  <span className="font-mono text-primary font-bold">
                    {statusData?.progress || scan.progress}%
                  </span>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-primary/20"
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  />
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${statusData?.progress || scan.progress}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              </div>
            )}

            {/* Error message */}
            {currentStatus === "failed" && scan.error_message && (
              <Alert className="border-cyber-red/30 bg-cyber-red/10 backdrop-blur-md">
                <AlertDescription className="text-cyber-red">
                  <strong>Analysis failed:</strong> {scan.error_message}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </SpotlightCard>
      </motion.div>

      {/* Tabs nav */}
      <nav className="flex gap-2 relative">
        {tabs.map((tab) => {
          const isActive =
            tab.href === `/scans/${scanId}`
              ? pathname === `/scans/${scanId}`
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative px-5 py-3 text-sm font-medium transition-colors rounded-t-xl ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}
            >
              {tab.label}
              {isActive && (
                <motion.div
                  layoutId="active-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary shadow-[0_0_8px_rgba(120,255,200,0.8)]"
                  initial={false}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
            </Link>
          );
        })}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-border/50 -z-10" />
      </nav>

      {/* Tab content with AnimatePresence */}
      <AnimatePresence mode="wait">
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
