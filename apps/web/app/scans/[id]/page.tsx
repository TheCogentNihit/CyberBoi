"use client";

import { useParams } from "next/navigation";
import { useScanStatus, useScanDetail } from "@/lib/polling";
import { StageChecklist } from "@/components/scan/StageChecklist";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScanStatus } from "@/lib/types";

export default function ScanOverviewPage() {
  const params = useParams();
  const scanId = params.id as string;
  const { data: statusData } = useScanStatus(scanId);
  const { data: scan } = useScanDetail(scanId);

  const currentStatus = (statusData?.status || scan?.status || "created") as ScanStatus;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Pipeline stages */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
            Analysis Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <StageChecklist status={currentStatus} />
        </CardContent>
      </Card>

      {/* Scan info */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            Scan Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Scan ID</dt>
              <dd className="font-mono text-xs">{scanId}</dd>
            </div>
            {scan?.profile && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Profile</dt>
                <dd className="capitalize font-medium">{scan.profile}</dd>
              </div>
            )}
            {scan?.created_at && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Created</dt>
                <dd>{new Date(scan.created_at).toLocaleString()}</dd>
              </div>
            )}
            {scan?.started_at && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Started</dt>
                <dd>{new Date(scan.started_at).toLocaleString()}</dd>
              </div>
            )}
            {scan?.completed_at && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Completed</dt>
                <dd>{new Date(scan.completed_at).toLocaleString()}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
