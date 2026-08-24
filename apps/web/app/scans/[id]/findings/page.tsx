"use client";

import { useParams } from "next/navigation";
import { useFindings, useScanStatus } from "@/lib/polling";
import { FindingCard } from "@/components/findings/FindingCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TERMINAL_STATUSES } from "@/lib/types";

export default function FindingsPage() {
  const params = useParams();
  const scanId = params.id as string;
  const { data, isLoading, isError, refetch } = useFindings(scanId);
  const { data: statusData } = useScanStatus(scanId);

  const isComplete = statusData && TERMINAL_STATUSES.includes(statusData.status);
  const findings = data?.findings || [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Alert className="border-destructive/40 bg-destructive/10">
        <AlertDescription className="flex items-center justify-between">
          <span>Failed to load findings</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (findings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          {isComplete ? (
            <svg className="h-8 w-8 text-cyber-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          ) : (
            <svg className="h-8 w-8 text-muted-foreground animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          )}
        </div>
        <h3 className="text-lg font-semibold">
          {isComplete ? "No issues detected" : "Analysis in progress"}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {isComplete
            ? "No security issues were found in this APK."
            : "Findings will appear here as the analysis runs."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        {findings.length} finding{findings.length !== 1 ? "s" : ""}
      </div>
      {findings.map((finding) => (
        <FindingCard key={finding.id} finding={finding} />
      ))}
    </div>
  );
}
