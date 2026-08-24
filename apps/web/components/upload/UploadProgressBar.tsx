"use client";

import { Progress } from "@/components/ui/progress";

export function UploadProgressBar({
  percent,
  label,
}: {
  percent: number;
  label?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label || "Uploading…"}</span>
        <span className="font-mono text-primary">{percent}%</span>
      </div>
      <div className="relative">
        <Progress value={percent} className="h-2" />
        {percent < 100 && (
          <div
            className="absolute top-0 left-0 h-2 animate-shimmer rounded-full"
            style={{ width: `${percent}%` }}
          />
        )}
      </div>
    </div>
  );
}
