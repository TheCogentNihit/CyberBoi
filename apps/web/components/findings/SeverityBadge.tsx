"use client";

import { Badge } from "@/components/ui/badge";
import type { Severity } from "@/lib/types";

const SEVERITY_CONFIG: Record<Severity, { className: string; icon: string }> = {
  Critical: { className: "bg-cyber-red/15 text-cyber-red border border-cyber-red/30", icon: "🔴" },
  High: { className: "bg-orange-500/15 text-orange-400 border border-orange-500/30", icon: "🟠" },
  Medium: { className: "bg-cyber-amber/15 text-cyber-amber border border-cyber-amber/30", icon: "🟡" },
  Low: { className: "bg-cyber-green/15 text-cyber-green border border-cyber-green/30", icon: "🟢" },
  Informational: { className: "bg-cyber-cyan/15 text-cyber-cyan border border-cyber-cyan/30", icon: "🔵" },
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.Informational;

  return (
    <Badge variant="outline" className={`text-xs font-semibold ${config.className}`}>
      {config.icon} {severity}
    </Badge>
  );
}
