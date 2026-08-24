"use client";

import type { ScanStatus } from "@/lib/types";
import { PIPELINE_STAGES, RUNNING_STATUSES, TERMINAL_STATUSES } from "@/lib/types";

function getStageState(
  stageStatus: ScanStatus,
  currentStatus: ScanStatus
): "done" | "active" | "pending" {
  const stageIndex = PIPELINE_STAGES.findIndex((s) => s.status === stageStatus);
  const currentIndex = PIPELINE_STAGES.findIndex((s) => s.status === currentStatus);

  // Terminal statuses
  if (currentStatus === "completed") return "done";
  if (currentStatus === "failed" || currentStatus === "cancelled") {
    return stageIndex <= currentIndex ? "done" : "pending";
  }

  if (stageIndex < currentIndex) return "done";
  if (stageIndex === currentIndex) return "active";
  return "pending";
}

export function StageChecklist({ status }: { status: ScanStatus }) {
  // Don't show stages for pre-queue statuses
  if (status === "created" || status === "uploaded") {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Waiting to start…
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {PIPELINE_STAGES.map((stage) => {
        const state = getStageState(stage.status, status);
        return (
          <div
            key={stage.status}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-300 ${
              state === "active"
                ? "bg-primary/10 text-primary font-medium"
                : state === "done"
                ? "text-cyber-green"
                : "text-muted-foreground/50"
            }`}
          >
            {/* Icon */}
            {state === "done" ? (
              <svg className="h-4 w-4 shrink-0 text-cyber-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path d="M5 13l4 4L19 7" />
              </svg>
            ) : state === "active" ? (
              <div className="h-4 w-4 shrink-0 rounded-full border-2 border-primary animate-pulse-glow">
                <div className="h-full w-full rounded-full bg-primary/50" />
              </div>
            ) : (
              <div className="h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/30" />
            )}
            {/* Label */}
            <span>{stage.label}</span>
          </div>
        );
      })}
    </div>
  );
}
