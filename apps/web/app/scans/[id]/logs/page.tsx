"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useLogs } from "@/lib/polling";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

const STAGE_FILTERS = [
  "all",
  "upload",
  "queued",
  "running_static",
  "running_dynamic",
  "running_network",
  "running_rag",
  "generating_report",
  "completed",
  "failed",
];

export default function LogsPage() {
  const params = useParams();
  const scanId = params.id as string;
  const [stageFilter, setStageFilter] = useState("all");
  const { data, isLoading, isError, refetch } = useLogs(
    scanId,
    stageFilter === "all" ? undefined : stageFilter
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-10 rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Alert className="border-destructive/40 bg-destructive/10">
        <AlertDescription className="flex items-center justify-between">
          <span>Failed to load logs</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const logs = data?.logs || [];

  return (
    <div className="space-y-4">
      {/* Stage filter */}
      <div className="flex flex-wrap gap-2">
        {STAGE_FILTERS.map((stage) => (
          <button
            key={stage}
            onClick={() => setStageFilter(stage)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              stageFilter === stage
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            {stage === "all" ? "All" : stage.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {/* Log entries */}
      {logs.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No log entries{stageFilter !== "all" ? ` for stage "${stageFilter.replace(/_/g, " ")}"` : ""}
        </div>
      ) : (
        <div className="space-y-1">
          {logs.map((log, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 rounded-lg px-3 py-2 text-sm hover:bg-accent/30 transition-colors"
            >
              <span className="shrink-0 font-mono text-xs text-muted-foreground w-20">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <Badge variant="outline" className="shrink-0 text-[10px]">
                {log.stage.replace(/_/g, " ")}
              </Badge>
              <span className="text-foreground">{log.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
