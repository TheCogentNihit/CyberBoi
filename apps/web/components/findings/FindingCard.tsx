"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SeverityBadge } from "./SeverityBadge";
import type { Finding } from "@/lib/types";

export function FindingCard({ finding }: { finding: Finding }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card
      className="glass-card cursor-pointer transition-all duration-300 hover:glow-cyan"
      onClick={() => setExpanded(!expanded)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <SeverityBadge severity={finding.severity} />
              <span className="text-xs text-muted-foreground">{finding.category}</span>
            </div>
            <CardTitle className="text-base font-semibold leading-tight">
              {finding.title}
            </CardTitle>
          </div>
          <svg
            className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 ${
              expanded ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground">{finding.description}</p>

        {expanded && (
          <div className="mt-4 space-y-3 border-t border-border/50 pt-4 text-sm animate-in fade-in-0 slide-in-from-top-2 duration-200">
            {finding.evidence && (
              <div>
                <span className="font-medium text-foreground">Evidence:</span>
                <code className="ml-2 rounded bg-muted px-2 py-1 font-mono text-xs text-cyber-cyan">
                  {finding.evidence}
                </code>
              </div>
            )}
            {finding.affected_component && (
              <div>
                <span className="font-medium text-foreground">Affected Component:</span>
                <span className="ml-2 text-muted-foreground">{finding.affected_component}</span>
              </div>
            )}
            {finding.recommendation && (
              <div>
                <span className="font-medium text-foreground">Recommendation:</span>
                <span className="ml-2 text-muted-foreground">{finding.recommendation}</span>
              </div>
            )}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Confidence: <span className="text-foreground">{finding.confidence}</span></span>
              <span>Source: <span className="text-foreground">{finding.source.replace("_", " ")}</span></span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
