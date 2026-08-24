"use client";

import { Badge } from "@/components/ui/badge";
import type { ScanStatus } from "@/lib/types";

const STATUS_CONFIG: Record<
  ScanStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }
> = {
  created: { label: "Created", variant: "outline", className: "border-muted-foreground/30 text-muted-foreground" },
  uploaded: { label: "Uploaded", variant: "outline", className: "border-cyber-cyan/40 text-cyber-cyan" },
  queued: { label: "Queued", variant: "secondary", className: "bg-cyber-amber/15 text-cyber-amber border border-cyber-amber/30" },
  running_static: { label: "Static Analysis", variant: "default", className: "bg-cyber-cyan/15 text-cyber-cyan border border-cyber-cyan/30 animate-pulse-glow" },
  running_dynamic: { label: "Dynamic Analysis", variant: "default", className: "bg-cyber-purple/15 text-cyber-purple border border-cyber-purple/30 animate-pulse-glow" },
  running_network: { label: "Network Analysis", variant: "default", className: "bg-cyber-blue/15 text-cyber-blue border border-cyber-blue/30 animate-pulse-glow" },
  running_rag: { label: "AI Interpretation", variant: "default", className: "bg-cyber-purple/15 text-cyber-purple border border-cyber-purple/30 animate-pulse-glow" },
  generating_report: { label: "Generating Report", variant: "default", className: "bg-cyber-green/15 text-cyber-green border border-cyber-green/30 animate-pulse-glow" },
  completed: { label: "Completed", variant: "default", className: "bg-cyber-green/15 text-cyber-green border border-cyber-green/30" },
  failed: { label: "Failed", variant: "destructive", className: "bg-cyber-red/15 text-cyber-red border border-cyber-red/30" },
  cancelled: { label: "Cancelled", variant: "outline", className: "border-muted-foreground/30 text-muted-foreground" },
};

export function ScanStatusBadge({ status }: { status: ScanStatus }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.created;

  return (
    <Badge variant={config.variant} className={`text-xs font-medium ${config.className}`}>
      {config.label}
    </Badge>
  );
}
