/**
 * CyberShield Frontend — API client.
 *
 * Thin fetch wrapper around the backend API.
 * Base URL from NEXT_PUBLIC_API_URL env var.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Scan endpoints (§4)
// ---------------------------------------------------------------------------

export async function createScan(apkFilename?: string): Promise<{ scan_id: string }> {
  return fetchJson("/api/scans", {
    method: "POST",
    body: JSON.stringify(apkFilename ? { apk_filename: apkFilename } : {}),
  });
}

/**
 * Upload APK with progress tracking.
 * Uses XMLHttpRequest because fetch() doesn't expose upload progress.
 */
export function uploadApk(
  scanId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<{ scan_id: string; sha256: string; size_bytes: number }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/api/scans/${scanId}/upload`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.responseText}`));
      }
    };

    xhr.onerror = () => reject(new Error("Upload failed: network error"));
    xhr.ontimeout = () => reject(new Error("Upload failed: timeout"));
    xhr.timeout = 300000; // 5 minutes

    const formData = new FormData();
    formData.append("file", file);
    xhr.send(formData);
  });
}

export async function startScan(
  scanId: string,
  profile: string
): Promise<{ scan_id: string; status: string }> {
  return fetchJson(`/api/scans/${scanId}/start`, {
    method: "POST",
    body: JSON.stringify({ profile }),
  });
}

import type {
  ScanSummary,
  ScanDetail,
  ScanStatusResponse,
  FindingsResponse,
  LogsResponse,
  ReportResponse,
} from "./types";

export async function listScans(): Promise<ScanSummary[]> {
  return fetchJson("/api/scans");
}

export async function getScan(scanId: string): Promise<ScanDetail> {
  return fetchJson(`/api/scans/${scanId}`);
}

export async function getScanStatus(scanId: string): Promise<ScanStatusResponse> {
  return fetchJson(`/api/scans/${scanId}/status`);
}

export async function getFindings(scanId: string): Promise<FindingsResponse> {
  return fetchJson(`/api/scans/${scanId}/findings`);
}

export async function getLogs(scanId: string, stage?: string): Promise<LogsResponse> {
  const query = stage ? `?stage=${encodeURIComponent(stage)}` : "";
  return fetchJson(`/api/scans/${scanId}/logs${query}`);
}

export async function getReport(scanId: string): Promise<ReportResponse> {
  return fetchJson(`/api/scans/${scanId}/report`);
}

export async function checkHealth(): Promise<{ status: string }> {
  return fetchJson("/api/health");
}
