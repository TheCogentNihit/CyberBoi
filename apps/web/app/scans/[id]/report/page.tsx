"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { useReport, useScanStatus } from "@/lib/polling";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SpotlightCard } from "@/components/ui/spotlight-card";

export default function ReportPage() {
  const params = useParams();
  const scanId = params.id as string;
  const { data: report, isLoading, isError, refetch } = useReport(scanId);
  const { data: statusData } = useScanStatus(scanId);
  const [downloading, setDownloading] = useState(false);

  const isComplete = statusData?.status === "completed";

  const handleDownload = () => {
    if (!report?.html) return;
    setDownloading(true);
    const blob = new Blob([report.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cybershield-report-${scanId}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setTimeout(() => setDownloading(false), 1000);
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <SpotlightCard className="p-8">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-48 w-full mt-6" />
        </div>
      </SpotlightCard>
    );
  }

  if (isError) {
    return (
      <Alert className="border-destructive/40 bg-destructive/10 backdrop-blur-md">
        <AlertDescription className="flex items-center justify-between">
          <span>Failed to load report from server</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!isComplete || !report?.html) {
    return (
      <SpotlightCard className="flex flex-col items-center justify-center py-20 text-center border-dashed">
        <div className="rounded-full bg-muted/40 p-6 mb-4">
          <svg className="h-10 w-10 text-muted-foreground/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold mb-1">Report Generating in Background</h3>
        <p className="max-w-md text-sm text-muted-foreground mb-6">
          The analysis worker is processing the APK. The final executive HTML report will appear here automatically when analysis completes.
        </p>
      </SpotlightCard>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold tracking-tight">Security Analysis Report</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Generated: {new Date(report.generated_at).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="flex items-center gap-2 border-border/60 hover:bg-accent/40"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24-3.3-.24-6.6 0-9.9m0 0a3.375 3.375 0 013.375-3.375h3.81a3.375 3.375 0 013.375 3.375m-10.56 0h10.56m0 0c.24 3.3.24 6.6 0 9.9m-10.56 0h10.56m-10.56 0v6.188c0 .621.504 1.125 1.125 1.125h8.31c.621 0 1.125-.504 1.125-1.125v-6.188" />
            </svg>
            Print / Save as PDF
          </Button>

          <Button
            size="sm"
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-2 bg-primary font-medium hover:glow-cyan"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Download HTML
          </Button>
        </div>
      </div>

      {/* Report Render Card */}
      <SpotlightCard className="p-8 md:p-10 border-primary/20 bg-card/60 backdrop-blur-xl">
        <div
          className="prose prose-invert max-w-none 
            prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-foreground
            prose-h1:text-2xl prose-h1:border-b prose-h1:border-border/50 prose-h1:pb-4
            prose-table:w-full prose-table:border-collapse
            prose-th:border-b prose-th:border-border prose-th:p-3 prose-th:text-left prose-th:text-xs prose-th:text-muted-foreground prose-th:uppercase
            prose-td:border-b prose-td:border-border/30 prose-td:p-3 prose-td:text-sm"
          dangerouslySetInnerHTML={{ __html: report.html }}
        />
      </SpotlightCard>
    </motion.div>
  );
}
