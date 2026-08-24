# CyberShield — Frontend, Connection & Communication Plan
### (Build-ready spec for Antigravity)

---

## 0. Scope of This Document

This is a **trimmed, decision-locked** version of the original CyberShield plan. It covers only:

1. The **frontend** (Next.js app the user interacts with)
2. The **connection** between frontend ↔ backend
3. The **communication protocol** between backend ↔ Omen worker

**Explicitly out of scope** (unchanged from the original plan, owned separately, do not touch):
- The actual static/dynamic/network analysis logic inside the worker
- RAG pipeline internals, embeddings, knowledge base ingestion
- Database schema for `knowledge_documents` / `rag_queries`
- PDF report rendering internals
- Infrastructure/K8s/multi-region concerns

Every ambiguity in the original plan ("if needed", "later", "optional") has been resolved below into one concrete decision, so this can go straight to implementation.

---

## 1. Locked Decisions

| Question | Decision | Why |
|---|---|---|
| Auth | **None.** Single-user, open access. No login page, no user table, no session. | Hackathon demo, one operator, speed > access control |
| Backend language | **FastAPI / Python** | Matches Python-heavy analysis tooling (JADX/apktool/Frida ecosystem); Pydantic gives free request/response validation that mirrors the schemas below |
| Upload method | **Plain multipart upload through the backend** (not a signed direct-to-storage URL) | One hop, no object-storage signing logic to build under time pressure. Swappable later behind the same frontend interface if needed |
| Live progress | **Polling only**, 3s interval | Simplest reliable option; no SSE/WebSocket infra needed for MVP |
| Worker ↔ backend connectivity | **Worker-initiated outbound polling over public HTTPS.** No VPN, no Tailscale, no inbound ports on the Omen at all | The Omen never needs a public IP or port-forwarding — it just calls out, like a browser would |
| Worker auth | **Static bearer token** shared secret (`WORKER_API_KEY`), never shipped to the frontend | Cheap, sufficient for a hackathon, keeps worker endpoints from being public |

---

## 2. Architecture (this scope only)

```text
Browser
   |
   | HTTPS (fetch)
   v
Next.js Frontend  ──────────────►  FastAPI Backend  ◄────────────── Omen Worker
 (no auth, polls                   (public HTTPS URL,                (polls backend every
  /status every 3s)                 CORS-locked to frontend            2–5s for jobs, posts
                                     origin, no browser-facing           progress/results back)
                                     secrets)
```

Key rule: **the backend never opens a connection to the worker.** The worker always dials out. This makes the "friend's laptop behind home NAT" problem disappear entirely — nothing needs to be exposed on the Omen.

---

## 3. Frontend

### 3.1 Stack

- Next.js 14+ (App Router)
- React + TypeScript
- Tailwind CSS
- shadcn/ui for components (Button, Card, Table, Tabs, Progress, Badge, Skeleton, Alert)
- **TanStack Query** — recommended for polling + caching the scan status/list without hand-rolled `useEffect` intervals
- No auth library, no session state

### 3.2 Folder structure

```text
apps/web/
├── app/
│   ├── page.tsx                  # Dashboard (home)
│   ├── scans/
│   │   ├── new/page.tsx          # Upload / New Scan
│   │   └── [id]/
│   │       ├── page.tsx          # Scan Detail (progress + tabs)
│   │       ├── findings/page.tsx
│   │       ├── logs/page.tsx
│   │       └── report/page.tsx
│   └── layout.tsx
├── components/
│   ├── upload/
│   │   ├── ApkDropzone.tsx
│   │   └── UploadProgressBar.tsx
│   ├── scan/
│   │   ├── StageChecklist.tsx
│   │   ├── ScanStatusBadge.tsx
│   │   └── WorkerOfflineBanner.tsx
│   ├── findings/
│   │   ├── FindingCard.tsx
│   │   └── SeverityBadge.tsx
│   └── ui/                       # shadcn primitives
├── lib/
│   ├── api-client.ts             # thin fetch wrapper, base URL from env
│   ├── types.ts                  # shared TS types mirroring backend schemas (§4)
│   └── polling.ts                # useScanStatus() hook (TanStack Query, 3s interval)
└── public/
```

### 3.3 Environment config

```text
# apps/web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
```

No other public env vars. Never put `WORKER_API_KEY` or any backend secret in a `NEXT_PUBLIC_*` variable.

### 3.4 Pages

**Dashboard (`/`)** — replaces the old separate landing/login page since there's no auth.
- Header: CyberShield name + one-line description
- "New Scan" button → `/scans/new`
- Recent scans table: APK name, status badge, risk (highest severity finding), created time, link to detail
- Empty state: "No scans yet — upload an APK to get started"

**Upload / New Scan (`/scans/new`)**
- Drag-and-drop zone + file picker (`ApkDropzone`)
- Client-side validation before upload starts:
  - extension must be `.apk`
  - max size **150 MB** (buffer above the 100 MB target; make this a constant, not hardcoded inline)
  - reject and show inline error otherwise — do not silently strip invalid files
- On valid file selected: show filename + size immediately (formatted, e.g. "42.3 MB")
- Scan profile selector: **Quick / Standard / Full** (radio group or segmented control, Full selected by default)
- "Start Scan" button:
  1. `POST /api/scans` → get `scan_id`
  2. `POST /api/scans/{scan_id}/upload` (multipart, with upload progress via `XMLHttpRequest.upload.onprogress` since `fetch` doesn't expose upload progress)
  3. `POST /api/scans/{scan_id}/start` with `{ profile }`
  4. Redirect to `/scans/{scan_id}`
- Button is disabled until upload completes; show the upload progress bar during step 2, then a "Queuing scan…" spinner during step 3

**Scan Detail (`/scans/[id]`)**
- Header: APK name, SHA-256 (monospace, truncated with copy button), package name, version, upload time
- `StageChecklist` component driven directly off the `status` enum from the backend (§4) — do not infer stage from progress percentage alone
- Elapsed time (client-computed from `started_at`, ticking)
- `WorkerOfflineBanner`: shown when the status payload's `worker_last_seen_seconds_ago` exceeds a threshold (e.g. 30s) while the scan is in a running state — surfaces the "Waiting for analysis worker" case from the original error-handling section instead of leaving the user staring at a stuck progress bar
- Tabs: Findings / Logs / Report (route to sub-pages, keep header persistent)

**Findings tab (`/scans/[id]/findings`)**
- List of `FindingCard`: severity badge (Critical/High/Medium/Low/Informational), title, category, short explanation
- Click to expand: evidence, affected component, recommendation, confidence
- Empty state (scan complete, zero findings): "No issues detected" — distinct from "scan still running" empty state

**Logs tab (`/scans/[id]/logs`)**
- Simple timestamped log list, filterable by stage
- Never render raw fields the backend hasn't explicitly whitelisted (this is a backend responsibility, but the frontend should not add any client-side log source of its own)

**Report tab (`/scans/[id]/report`)**
- Renders the HTML report payload from `GET /api/scans/{id}/report`
- Shown only when `status === "completed"`; otherwise show "Report available once the scan completes"

### 3.5 Loading / error / empty states (required for every page, not optional polish)

| Page | Loading | Error | Empty |
|---|---|---|---|
| Dashboard | Skeleton rows in table | Alert + retry button | "No scans yet" + CTA |
| Upload | Disabled form until API reachable | Inline error under dropzone (bad file / upload failed, with retry) | — |
| Scan Detail | Skeleton header + checklist | Alert: "Couldn't reach CyberShield backend" + retry | — |
| Findings | Skeleton cards | Alert + retry | "No issues detected" (only once scan is complete) |
| Report | Skeleton | Alert + retry | "Report available once the scan completes" |

---

## 4. Connection: Frontend ↔ Backend API Contract

Base URL: `NEXT_PUBLIC_API_URL`. No auth headers (single-user, no login). CORS on the backend restricted to the deployed frontend origin(s) — not `*`.

### Endpoints

```text
POST   /api/scans                      create scan record
POST   /api/scans/{scan_id}/upload     multipart APK upload
POST   /api/scans/{scan_id}/start      body: { "profile": "quick" | "standard" | "full" }

GET    /api/scans                      list (for dashboard)
GET    /api/scans/{scan_id}            full detail
GET    /api/scans/{scan_id}/status     lightweight polling payload
GET    /api/scans/{scan_id}/findings
GET    /api/scans/{scan_id}/logs
GET    /api/scans/{scan_id}/report

GET    /api/health
```

### Scan status enum (unchanged from original plan — keep it, it's good)

```text
created → uploaded → queued →
running_static → running_dynamic → running_network →
running_rag → generating_report →
completed | failed | cancelled
```

### `GET /api/scans/{scan_id}/status` — response shape

This is the payload the frontend polls every 3s. Keep it small; it's called often.

```json
{
  "scan_id": "123",
  "status": "running_dynamic",
  "progress": 65,
  "current_stage": "Dynamic Analysis",
  "started_at": "2026-08-24T10:02:11Z",
  "error_message": null,
  "worker_last_seen_seconds_ago": 4
}
```

- `worker_last_seen_seconds_ago` is what drives `WorkerOfflineBanner` — populate it from the worker heartbeat described in §5.
- Frontend polling behavior: 3s interval while `status` is non-terminal; stop entirely once `completed`/`failed`/`cancelled`; on 3 consecutive failed requests, back off to 10s and show a "reconnecting" indicator rather than an error page; on tab refocus, fire one immediate refetch before resuming the interval.

### `POST /api/scans/{scan_id}/upload` — request

`multipart/form-data`, single field `file`. Server re-validates independently (file signature / magic bytes for ZIP/APK, size limit) — **never trust the client-side check alone.**

### `GET /api/scans/{scan_id}/findings` — response shape

```json
{
  "scan_id": "123",
  "findings": [
    {
      "id": "f1",
      "severity": "High",
      "title": "Insecure WebView configuration",
      "category": "WebView",
      "description": "WebView allows JavaScript and loads remote content.",
      "evidence": "MainActivity.java:142 — setJavaScriptEnabled(true)",
      "affected_component": "com.example.app.MainActivity",
      "recommendation": "Disable JavaScript unless required; validate loaded URLs.",
      "confidence": "high",
      "source": "static_analysis"
    }
  ]
}
```

### `GET /api/scans/{scan_id}/report` — response shape

```json
{
  "scan_id": "123",
  "generated_at": "2026-08-24T10:14:02Z",
  "html": "<section>...</section>"
}
```

Frontend renders `html` directly in a sandboxed container (e.g. via `dangerouslySetInnerHTML` scoped to a dedicated wrapper, since this is trusted content the backend generated, not user input).

---

## 5. Connection: Backend ↔ Omen Worker Protocol

**Core principle:** the worker always initiates. The backend never dials the Omen. This means zero network configuration is required on the Omen — it works from any home network, coffee shop, or hotspot as long as it has outbound internet.

### Worker auth

- `WORKER_API_KEY` — a static shared secret, set as an environment variable on both the backend and the worker.
- Every `/api/worker/*` request from the worker includes `Authorization: Bearer <WORKER_API_KEY>`.
- Backend middleware rejects any `/api/worker/*` call without a valid token.
- This key lives only in backend/worker `.env` files — **never** in the frontend, never in a public repo (add to `.env.example` as a placeholder only).

### Worker loop (what Antigravity should build)

```text
loop forever:
    job = POST /api/worker/jobs/claim        # long-poll ~20s; 204 if nothing queued
    if job:
        download APK from job.artifact_url
        [analysis happens here — out of scope for this doc]
        periodically: POST /api/worker/jobs/{job_id}/progress
        on success: POST /api/worker/jobs/{job_id}/results
                    POST /api/worker/jobs/{job_id}/complete
        on failure: POST /api/worker/jobs/{job_id}/fail
    else:
        continue loop (immediate re-poll, since claim already long-polled)
```

### Endpoints

```text
POST   /api/worker/jobs/claim
       → 200 { "job_id": "...", "scan_id": "123", "artifact_url": "...", "profile": "full" }
       → 204 (no job available)

POST   /api/worker/jobs/{job_id}/progress
       body: { "stage": "running_dynamic", "progress": 65, "message": "Hooking process..." }

POST   /api/worker/jobs/{job_id}/results
       body: { "findings": [...], "artifacts": [...] }   # schema matches §4 findings shape

POST   /api/worker/jobs/{job_id}/complete

POST   /api/worker/jobs/{job_id}/fail
       body: { "error_message": "Emulator failed to boot" }

GET    /api/worker/health
       → worker calls this (or the claim call itself) to update its own heartbeat;
         backend stores "worker_last_seen" and exposes it via /api/scans/{id}/status
```

**Job payload is fully structured — no shell commands, no arbitrary parameters.** The worker maps `profile` to its own preconfigured internal tool sequence. This preserves the original plan's most important security constraint and is non-negotiable regardless of time pressure.

### Reachability (only what's needed for the connection to work — not a full deployment plan)

The backend needs one stable public HTTPS URL that both the frontend and the worker can reach. Two options, either works with the exact same worker code:

- Deploy FastAPI to a free host (Render / Railway / Fly.io) — worker just needs outbound internet, zero extra config.
- Run the backend locally and expose it via a quick tunnel (Cloudflare Tunnel or ngrok) if a real deploy isn't ready in time.

No VPN or private networking is required either way, because the worker never accepts inbound connections.

---

## 6. Definition of Done (this scope)

- [ ] Dashboard loads with no login and shows recent scans (or empty state)
- [ ] User can drag-and-drop or pick an APK; invalid files are rejected client-side with a clear message
- [ ] Upload shows real progress and the Start button is disabled until it completes
- [ ] Scan detail page polls `/status` every 3s and updates the stage checklist live
- [ ] If the worker hasn't polled in >30s during a running scan, the UI shows "Waiting for analysis worker" instead of a frozen bar
- [ ] Findings, Logs, and Report tabs render from their respective endpoints with correct empty/loading/error states
- [ ] Worker can claim a job, post progress, and post results using only the bearer token — no other credentials
- [ ] `WORKER_API_KEY` never appears in any frontend bundle or `NEXT_PUBLIC_*` variable
- [ ] Backend CORS is restricted to the actual frontend origin, not `*`
- [ ] Works end-to-end with the Omen on a normal home network — no port forwarding, no VPN

---

## 7. Instructions to Antigravity

1. Build exactly the endpoints and payload shapes in §4 and §5 — don't invent additional ones without a reason.
2. Do not build a login/auth system. There is none in this scope.
3. Do not build signed-URL direct-to-storage upload. Plain multipart through the backend is the locked decision.
4. Do not build SSE/WebSockets. Polling only.
5. Do not add VPN/Tailscale setup instructions or code. The worker-polls-outbound model replaces it entirely.
6. Every frontend page needs its loading/error/empty state — not just the happy path.
7. Treat the analysis logic that runs inside `run_static_analysis()` / `run_dynamic_analysis()` / etc. as **out of scope** — stub these behind a clear interface with a comment marking them as owned separately, and focus entirely on the job claim/progress/results plumbing around them.
8. Add `.env.example` for both `apps/web` and the backend, with `WORKER_API_KEY` clearly commented as backend/worker-only, never frontend.
9. Keep the state enum and JSON shapes in §4/§5 as the single source of truth — define them once (e.g. in `shared/schemas`) and have both the FastAPI Pydantic models and the frontend TypeScript types derive from or mirror that source, rather than drifting independently.
