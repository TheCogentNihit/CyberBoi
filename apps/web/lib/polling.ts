/**
 * CyberShield Frontend — Polling hooks (TanStack Query).
 *
 * useScanStatus() polls every 3s, stops on terminal status,
 * backs off on 3 consecutive failures, refetches on tab focus.
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import { getScanStatus, listScans, getScan, getFindings, getLogs, getReport } from "./api-client";
import { TERMINAL_STATUSES } from "./types";
import type { ScanStatusResponse, ScanSummary, ScanDetail, FindingsResponse, LogsResponse, ReportResponse } from "./types";

const POLL_INTERVAL = 3000; // 3 seconds
const BACKOFF_INTERVAL = 10000; // 10 seconds on repeated failures

/**
 * Poll scan status every 3s.
 * Stops polling once status is terminal (completed/failed/cancelled).
 * Backs off to 10s after 3 consecutive failures.
 */
export function useScanStatus(scanId: string | undefined) {
  return useQuery<ScanStatusResponse>({
    queryKey: ["scanStatus", scanId],
    queryFn: () => getScanStatus(scanId!),
    enabled: !!scanId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && TERMINAL_STATUSES.includes(data.status)) {
        return false; // Stop polling
      }
      // Back off after failures
      if (query.state.fetchFailureCount >= 3) {
        return BACKOFF_INTERVAL;
      }
      return POLL_INTERVAL;
    },
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: true,
    retry: 2,
    staleTime: 1000,
  });
}

export function useScanList() {
  return useQuery<ScanSummary[]>({
    queryKey: ["scanList"],
    queryFn: listScans,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });
}

export function useScanDetail(scanId: string | undefined) {
  return useQuery<ScanDetail>({
    queryKey: ["scanDetail", scanId],
    queryFn: () => getScan(scanId!),
    enabled: !!scanId,
    refetchOnWindowFocus: true,
  });
}

export function useFindings(scanId: string | undefined) {
  return useQuery<FindingsResponse>({
    queryKey: ["findings", scanId],
    queryFn: () => getFindings(scanId!),
    enabled: !!scanId,
    refetchOnWindowFocus: true,
  });
}

export function useLogs(scanId: string | undefined, stage?: string) {
  return useQuery<LogsResponse>({
    queryKey: ["logs", scanId, stage],
    queryFn: () => getLogs(scanId!, stage),
    enabled: !!scanId,
    refetchOnWindowFocus: true,
  });
}

export function useReport(scanId: string | undefined) {
  return useQuery<ReportResponse>({
    queryKey: ["report", scanId],
    queryFn: () => getReport(scanId!),
    enabled: !!scanId,
    refetchOnWindowFocus: true,
  });
}
