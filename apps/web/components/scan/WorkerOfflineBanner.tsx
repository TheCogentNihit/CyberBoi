"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";

export function WorkerOfflineBanner({
  workerLastSeenSecondsAgo,
}: {
  workerLastSeenSecondsAgo: number | null;
}) {
  if (workerLastSeenSecondsAgo === null || workerLastSeenSecondsAgo < 30) {
    return null;
  }

  return (
    <Alert className="border-cyber-amber/40 bg-cyber-amber/10">
      <svg
        className="h-4 w-4 text-cyber-amber"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
      <AlertDescription className="text-cyber-amber">
        <strong>Waiting for analysis worker</strong> — The worker hasn&apos;t
        checked in for {workerLastSeenSecondsAgo} seconds. It may be starting
        up or experiencing an issue.
      </AlertDescription>
    </Alert>
  );
}
