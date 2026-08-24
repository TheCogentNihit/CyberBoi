/**
 * CyberShield Frontend — Shared TypeScript types.
 *
 * These mirror the backend Pydantic schemas (§4 and §5 of the spec).
 * Keep in sync with apps/backend/app/schemas.py.
 */

// Scan status enum — single source of truth
export type ScanStatus =
  | "created"
  | "uploaded"
  | "queued"
  | "running_static"
  | "running_dynamic"
  | "running_network"
  | "running_rag"
  | "generating_report"
  | "completed"
  | "failed"
  | "cancelled";

export const TERMINAL_STATUSES: ScanStatus[] = ["completed", "failed", "cancelled"];
export const RUNNING_STATUSES: ScanStatus[] = [
  "queued",
  "running_static",
  "running_dynamic",
  "running_network",
  "running_rag",
  "generating_report",
];

export type ScanProfile = "quick" | "standard" | "full";

// Stage display info for the StageChecklist
export interface StageInfo {
  status: ScanStatus;
  label: string;
}

export const PIPELINE_STAGES: StageInfo[] = [
  { status: "queued", label: "Queued" },
  { status: "running_static", label: "Static Analysis" },
  { status: "running_dynamic", label: "Dynamic Analysis" },
  { status: "running_network", label: "Network Analysis" },
  { status: "running_rag", label: "AI Interpretation" },
  { status: "generating_report", label: "Generating Report" },
  { status: "completed", label: "Completed" },
];

// Severity levels
export type Severity = "Critical" | "High" | "Medium" | "Low" | "Informational";

export const SEVERITY_ORDER: Severity[] = [
  "Critical",
  "High",
  "Medium",
  "Low",
  "Informational",
];

// API response types

export interface ScanSummary {
  id: string;
  apk_filename: string | null;
  status: ScanStatus;
  progress: number;
  highest_severity: Severity | null;
  created_at: string;
}

export interface ScanDetail {
  id: string;
  apk_filename: string | null;
  apk_size_bytes: number | null;
  sha256: string | null;
  package_name: string | null;
  version: string | null;
  profile: ScanProfile;
  status: ScanStatus;
  progress: number;
  current_stage: string | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface ScanStatusResponse {
  scan_id: string;
  status: ScanStatus;
  progress: number;
  current_stage: string | null;
  started_at: string | null;
  error_message: string | null;
  worker_last_seen_seconds_ago: number | null;
}

export interface Finding {
  id: string;
  severity: Severity;
  title: string;
  category: string;
  description: string;
  evidence: string | null;
  affected_component: string | null;
  recommendation: string | null;
  confidence: string;
  source: string;
}

export interface FindingsResponse {
  scan_id: string;
  findings: Finding[];
}

export interface LogEntry {
  timestamp: string;
  stage: string;
  message: string;
}

export interface LogsResponse {
  scan_id: string;
  logs: LogEntry[];
}

export interface ReportResponse {
  scan_id: string;
  generated_at: string | null;
  html: string | null;
}
