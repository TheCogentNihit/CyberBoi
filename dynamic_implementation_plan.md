# Dynamic Analysis Engine (Sandbox) — Final Implementation Plan

**Hackathon:** Cybershield IITH × BOI
**Team:** Phoenix
**Spec Reference:** Section 3.2 (Dynamic Analysis Engine), Section 6.1 (Sandbox Evasion Tactics), Section 6.2 (Adaptive Fallback Mechanisms)
**Status:** 🔒 Merged Final — Ready for Implementation

> This plan consolidates six independently drafted proposals into a single build spec. It keeps the **executable, MVP-first structure** of the leanest drafts and folds in the two features that most raise the ceiling of the demo: the **5-tier evasion escalation ladder** and a **confidence score separate from the risk score**. Anything judged too heavy for a hackathon timeline is explicitly marked as a stretch goal, not core scope.

---

## 1. Objective

Execute suspicious APKs in an isolated, instrumented Android environment, observe runtime behavior malware hides from static analysis (packing, dormancy, obfuscated C2), and emit a calibrated behavioral risk score **S_dynamic** (and a separate evidence-strength score, **C_dynamic**) into the existing Multi-Factor Risk Equation:

```
Risk Score = (0.30 × S_static) + (0.30 × S_dynamic) + (0.25 × S_GenAI) + (0.15 × S_rep)
```

`S_dynamic` is a probability score in **[0, 1]**, consistent with the other module outputs; the final Risk Score is scaled ×100 against the severity thresholds (Low 0–25, Medium 26–50, High 51–75, Critical 76–100).

**MVP scope:** functional sandbox with anti-evasion, behavioral feature extraction, an evasion-escalation ladder, and adaptive fallback. **Out of scope for MVP:** native (`.so`) code hooking, parallel multi-instance execution, physical device farm.

---

## 2. High-Level Architecture

```
APK (post static/decompilation phase)
        │
        ▼
┌───────────────────────────────┐
│  Dynamic Analysis Orchestrator │  ← Python / FastAPI endpoint, state machine
└───────────────┬───────────────┘
                │
   ┌────────────┼─────────────┐
   ▼            ▼              ▼
Sandboxed    Frida Hooks    Network
Emulator     (API tracing)  Proxy (mitmproxy + PCAP)
   │            │              │
   └────────────┼──────────────┘
                ▼
       Evidence Normalization (JSON events)
                ▼
       Timeline & Correlation Engine
                ▼
   Feature Extractor → S_dynamic + C_dynamic
                │
                ▼
   Multi-Factor Risk Scoring + GenAI Report
```

```
PREPARE → INSTALL → INITIALIZE → LAUNCH → INSTRUMENT →
STIMULATE → MONITOR → COLLECT → CORRELATE → SCORE → CLEANUP → COMPLETE
```

---

## 3. Tech Stack (Locked)

| Component | Tool | Rationale |
|-----------|------|-----------|
| **Emulator** | Redroid (Docker) or headless AVD (x86_64/ARM64) | Redroid boots in ~10s and is fully scriptable via ADB; AVD is the fallback if Redroid is unstable on hackathon hardware |
| **Instrumentation** | Frida | Industry-standard runtime API hooking |
| **Interaction** | ADB + `monkey` (+ optional `uiautomator2`) | Built-in, simulates human input; UIAutomator2 only if time permits (deeper UI flows) |
| **Network** | tcpdump + mitmproxy | Raw PCAP + HTTP/HTTPS body inspection |
| **Orchestration** | Python 3.10+ (FastAPI endpoint) | Glues pipeline, parses logs, computes features, integrates with Static/GenAI modules |
| **Storage** | JSON files (+ SQLite optional) | Simple, inspectable, feeds directly into GenAI/RAG module |

**Decisions:** No native (`.so`) hooking for MVP. No parallel emulator instances — single APK per analysis cycle. Pin to Android 11 (API 30) for Frida stability.

---

## 4. Phase 0: Stealth Environment Provisioning ("Chameleon" Setup)

Malware checks the environment before acting — the sandbox must look like a real phone *before* the APK ever launches.

| Area | Action |
|------|--------|
| Build fingerprint | Spoof to a real consumer device (e.g. Samsung Galaxy S10/S21): `ro.product.model`, `ro.hardware`, `ro.build.fingerprint` |
| Hardware signals | Fake battery level (~87%) and temperature (~32°C), static accelerometer/sensor readings |
| Network identity | Spoof MAC OUI range and carrier/IMSI details away from emulator defaults |
| Missing PII | Pre-populate contacts ("Mom", "Bank"), fake SMS inbox with dummy OTPs, fake call log — tricks SMS-stealers into firing immediately |
| VM artifacts | Avoid QEMU-specific strings in `/proc/cpuinfo`, use `gpu_mode=guest` |
| Tool camouflage | Rename `frida-server` binary (e.g. to a benign process name), run on a non-standard port |
| Proxy/cert | Install mitmproxy CA as a **system certificate**, enforce transparent proxy routing |

**Decision:** We do **not** attempt to fully hide Frida from advanced detection. Some apps will detect it and trigger the fallback path (Section 8) — this trades completeness for reliability within the timeline.

---

## 5. Core Execution Pipeline

### 5.1 Pipeline Stages

| Stage | What Happens | Output |
|-------|--------------|--------|
| 1. Environment hardening | Apply Phase 0 spoofing to a clean snapshot | Hardened emulator ready |
| 2. APK installation | Install with `-r -g` (permissions pre-granted) | App ready to launch |
| 3. Instrumentation | Attach Frida, load classified hook set | Hooked process running |
| 4. Interaction | 5-phase hybrid stimulation (below) | Triggered malware behavior |
| 5. Monitoring | Capture API calls, network traffic, file ops for 90–150s | Raw behavioral logs |
| 6. Extraction | Parse logs into structured feature vector | JSON feature vector |
| 7. Scoring | Compute S_dynamic + C_dynamic | Float scores |
| 8. Fallback check | If evasion/failure detected, escalate or recalibrate weights | Updated score or null + flag |

### 5.2 Hybrid UI Stimulation (5 Phases)

Random taps alone miss login flows and conditional triggers; a hybrid strategy covers both:

1. **Deterministic launch** — install, then `am start` the main declared Activity.
2. **Deterministic interactions** — auto-dismiss permission dialogs, tap "Allow" / "Allow all the time" / "OK" / "Continue".
3. **Random monkey stimulation** — `adb shell monkey -p <package> --throttle 150 500`, ~300 events over 60s, weighted toward taps (40%) and swipes (30%) over hardware-key events.
4. **Targeted decoy input (stretch)** — if time allows, use `uiautomator2` to find login fields and type decoy credentials (`test@bank.com` / `Test@1234`) to trigger credential-exfil logic.
5. **Dwell + replay** — 15–60s idle period to let background timers/sockets fire, then re-trigger intent receivers and registered services to surface dormant behavior.

---

## 6. Frida Instrumentation & Hook Confidence Tiers

Hooks are tiered so a single low-signal API call doesn't inflate the score — this avoids false-positiving legitimate apps that happen to use reflection or network calls.

| Tier | APIs | Behavioral Context |
|------|------|---------------------|
| **High-confidence** | `SmsManager.sendTextMessage`, `SmsMessage.getMessageBody`, `AccessibilityService.onAccessibilityEvent` (overlay injection), RAM DEX magic-byte match | Direct indicators of OTP theft, overlay attacks, or unpacking |
| **Contextual** | `DexClassLoader`, `Class.forName` / `Method.invoke`, `Runtime.exec` / `ProcessBuilder`, `Cipher.doFinal` / `SecretKeySpec` | Common in packers/crypto helpers, but also legitimate plugins & analytics SDKs — score by combination, not presence alone |
| **Low-confidence** | `HttpURLConnection` / `OkHttpClient`, `TelephonyManager.getDeviceId` / `getSubscriberId`, `PackageManager.getInstalledPackages`, `SharedPreferences` | Standard Android functionality; suspicious only when correlated with exfiltration |

**MVP hook set (7 categories):** SMS, Accessibility, Shell execution, Reflection/dynamic loading, Network, Package enumeration (banking-app targeting), Device fingerprinting.
**Stretch:** audio, camera, clipboard hooks (add Day 3 if time permits).

An SSL-pinning bypass script is loaded alongside the hooks so HTTPS traffic still reaches the mitmproxy.

---

## 7. Network Interception

All traffic is routed through `mitmproxy` (with system CA installed) plus a parallel `tcpdump` PCAP capture for full L2–7 visibility (covers DNS tunneling / beaconing that a proxy alone would miss).

| Category | Pattern | Treatment |
|----------|---------|-----------|
| Known malicious infra | IP/domain hit against IOC feed | **Critical** — direct indicator |
| Suspicious behavior | Raw socket bypassing DNS, unusual port, endpoint appears only after DEX load | **High** — correlate with API activity |
| Plaintext exfiltration | HTTP POST with IMEI/SMS body/OTP/credentials in cleartext | **High** |
| Ordinary traffic | HTTPS to standard CDN/analytics (Firebase, Google) | **Benign** — zero risk contribution |

---

## 8. Anti-Evasion Strategy (Section 6.1)

### 8.1 What Malware Checks For

Build fingerprint props, hardware/sensor absence, missing personal data, instrumentation traces (Frida binary, debug ports, `ptrace`), timing anomalies, QEMU/VM artifacts, and proxy/CA detection. Also: `Debug.isDebuggerConnected()`, `TracerPid` in `/proc/self/status`, root/Magisk file checks, and package scans for Frida/Xposed/Wireshark.

Anti-analysis detection is logged as a **high-severity signal**, not standalone proof of malware.

### 8.2 The 5-Tier Evasion Escalation Ladder (Core Differentiator)

Static spoofing (Section 4) handles passive fingerprinting. This ladder handles *active* evasion during execution — the main technical differentiator of this plan versus a purely passive sandbox.

| Tier | Evasion Tactic | Countermeasure | Escalation Trigger |
|------|-----------------|------------------|----------------------|
| **1** | Environment fingerprinting (`ro.kernel.qemu`, build props, battery temp) | Pre-execution hard-lock: spoofed values always returned | Always active |
| **2** | Long sleep timers (`Thread.sleep(600000)` to outlast the analysis window) | Real-time acceleration — any delay-method call over 100ms is intercepted and compressed | Always active |
| **3** | Conditional triggers (waits for `BOOT_COMPLETED`, Wi-Fi connect, etc.) | Broadcast-force all relevant system intents immediately after install | Always active |
| **4** | "Anomalous silence" — app runs, zero malicious API calls fire | **Silence Detector**: if hook logs are empty for 90s, extend runtime +60s and re-run Tier 3 at higher intensity (simulate incoming SMS/push) | Silence > 90s |
| **5** | Extreme packing / instant crash | **Emergency memory dump** (Section 9) | APK crash OR no hooks after 150s |

### 8.3 Passive Countermeasure Summary

| Problem | Countermeasure |
|---------|-----------------|
| Build fingerprint | Spoof to a real device profile |
| Hardware gaps | Fake battery/temperature/sensor data |
| Missing PII | Pre-populate contacts, SMS, call log |
| Frida detection | Rename binary, non-standard port |
| Timing | Randomized 200–400ms delays between monkey events |
| Proxy detection | System-level CA install, transparent proxy mode |

---

## 9. Runtime Memory / DEX Extraction (Packer Defeat)

For commercial packers (DexGuard, Jiagu) where static tools only see encrypted bytes — the payload *must* decrypt in RAM to run.

```
Encrypted APK → [ART runtime decrypts into RAM]
                       │
                       ▼
             [Memory hook on class-loading calls]
                       │
                       ▼
         [Scan for DEX magic header in memory blocks]
                       │
                       ▼
        [Dump raw decrypted byte array → validate structure]
                       │
                       ▼
     [SHA-256 hash, save to artifacts/] → feed back to
     Static Analysis Engine + GenAI module for re-analysis
```

Validation before an extracted DEX is trusted: header check, string-ID bounds check, class-def count check. This closes the static↔dynamic feedback loop described in the base architecture.

---

## 10. Adaptive Fallback Mechanisms (Section 6.2)

**Key principle:** never let the pipeline fail silently — if dynamic analysis can't produce a reliable score, explicitly flag it so the risk equation still returns a valid result.

### 10.1 Failure Scenarios & Responses

| Scenario | Detection Signal | Fallback Action |
|----------|--------------------|-------------------|
| App crashes instantly | 0 API calls within 5–15s of launch | Retry once with a rotated device profile (e.g. OnePlus/Xiaomi). Still fails → `S_dynamic = null`, recalibrate weights |
| Silent evasion | Very low API entropy despite high-risk permissions requested (per static findings) | Flag "dormant/possible evasion"; reduce dynamic confidence, don't zero the score outright — banking trojans often go silent deliberately, so silence itself is treated as suspicious, not benign |
| Frida detected & killed | Frida process disappears mid-run | Switch to passive monitoring (logcat + PCAP only); halve `S_dynamic` weight, boost GenAI weight |
| Static analysis already failed (packer) | APKTool couldn't decompile | Trigger memory-dump routine (Section 9); rely more heavily on GenAI + reputation once payload recovered |
| Network completely silent | 0 connections despite full runtime | Inspect PCAP for DNS-over-HTTPS/covert channels; if confirmed stealth, treat as suspicious — not benign |

### 10.2 Weight Recalibration Table

| Situation | S_static | S_dynamic | S_GenAI | S_rep |
|-----------|:---:|:---:|:---:|:---:|
| Normal operation | 30% | 30% | 25% | 15% |
| Dynamic failed / evaded | **45%** | **0%** | **40%** | 15% |
| Frida detected (passive only) | 35% | **15%** | **40%** | 10% |
| Both static + dynamic failed | 0% | 0% | **60%** | **40%** |

---

## 11. Feature Vector & Scoring Model

### 11.1 Behavioral Features

| Feature | Description | Risk Signal |
|---------|--------------|--------------|
| `sms_sends` | Count of SMS sends | OTP exfiltration |
| `shell_execs` | Shell command executions | Privilege escalation |
| `accessibility_events` | Accessibility service triggers | Screen scraping / overlay attacks |
| `dex_load_events` | `DexClassLoader` / reflection calls | Obfuscation, dynamic payload loading |
| `network_connections`, `unique_urls`, `suspicious_domains` | Outbound connection volume & IOC hits | C2 communication |
| `http_ratio` | Plaintext vs HTTPS ratio | Unencrypted exfiltration |
| `api_entropy` | Diversity of API call types | Sophistication |
| `time_to_first_network`, `time_to_first_sms` | Seconds to first event | Speed of malicious action |
| `package_enumerations` | Installed-app queries | Banking app targeting |
| `device_id_queries` | IMEI/IMSI reads | Fingerprinting/tracking |
| `anti_analysis_hits` | Emulator/debugger/root checks detected | Evasion awareness (Section 8) |
| `correlation_bonus` | Cross-signal chains within a time window (see below) | High-confidence composite behavior |

### 11.2 Correlation Rule (Timeline Engine)

Individual signals are weaker evidence than a *chain*. Example rule: **Dynamic DEX load + SMS hook + network exfil within a 5-second window → high-confidence banking trojan**, boosting `S_dynamic` beyond the linear sum of individual features.

### 11.3 Two Separate Scores

- **S_dynamic [0,1]** — *how dangerous* the observed behavior is (weighted sum of normalized features + correlation bonus, clamped to [0,1]).
- **C_dynamic [0,1]** — *how reliable/complete* the evidence is (was the run cut short? did Frida survive? was memory dump needed?). Reported alongside `S_dynamic` so the GenAI/report layer can distinguish "confirmed dangerous" from "suspicious but under-observed."

Example: an app drops an encrypted DEX but times out before any network call — `S_dynamic ≈ 0.75`, `C_dynamic ≈ 0.60`.

Exact feature weights are tuned during testing against labeled samples (CIC-AndMal); initial weights are engineering defaults.

---

## 12. Output Schema / Interface Contract

Dynamic module exposes a single call the orchestrator invokes:

```
analyze_dynamic(apk_path, static_features) →
    (s_dynamic, c_dynamic, feature_vector, fallback_flag, metadata)
```

Normalized event schema (every Frida/ADB/network event, before aggregation):

```json
{
  "timestamp": "2026-07-29T22:15:30.124Z",
  "analysis_id": "analysis_20260729_a8f91c",
  "event_type": "DYNAMIC_CODE_LOAD | SENSITIVE_API | NETWORK_EXFIL | ANTI_ANALYSIS",
  "source": "FRIDA | ADB_LOGCAT | MITMPROXY | SYSTEM",
  "api_class": "dalvik.system.DexClassLoader",
  "destination": "http://<redacted>/payload.dex",
  "severity": "CRITICAL | HIGH | MEDIUM | LOW",
  "confidence": 0.95,
  "metadata": {"dex_bytes": 14344, "sha256": "..."}
}
```

Aggregated output passed to the Risk Scoring + GenAI stages:

| Field | Type | Description |
|-------|------|--------------|
| `s_dynamic` | float or null | Behavioral risk score [0,1]; null if fallback |
| `c_dynamic` | float | Evidence confidence [0,1] |
| `feature_vector` | dict | Structured features for explainability |
| `fallback_triggered` | bool | Whether adaptive fallback activated |
| `evasion_tier` | string/null | Highest evasion tier encountered (e.g. `"Tier_4_Silent"`) |
| `raw_logs` | JSON | Full API + network logs for GenAI report generation |
| `pcap_path` | string | Path to captured traffic |
| `dumped_dex_path` | string/null | Path to extracted DEX, if memory-dumped |
| `screenshots` | list | Screen captures during execution |

*(Optional stretch: map events to Mobile MITRE ATT&CK IDs — e.g. `T1412` Capture SMS Messages, `T1453` Abuse Accessibility Features, `T1407` Dynamic Code Loading, `T1623` Virtualization/Sandbox Evasion — for a stronger investigation report if time permits.)*

---

## 13. Module / File Structure

```
dynamic_analysis/
├── orchestrator.py          # State machine: PREPARE→...→COMPLETE
├── sandbox_manager.py       # Emulator isolation, snapshot reset, timeouts
├── adb_runner.py            # Install + 5-phase hybrid UI stimulation
├── frida_engine.py          # Hook management, tiered API logging
├── hooks/
│   └── tracer.js            # Classified Frida hooks (7 categories)
├── network_analyzer.py      # mitmproxy + PCAP parsing, IOC matching
├── evasion_ladder.py        # 5-tier detection & escalation logic
├── artifacts/
│   └── dex_extractor.py     # Memory scan, DEX validation, hashing
├── timeline.py               # Event correlation & chain-rule matching
├── feature_extractor.py     # Log/PCAP → feature vector
├── dynamic_scorer.py         # S_dynamic + C_dynamic computation
├── evidence/
│   └── event_schema.py       # Normalized JSON event schema
└── config.yaml                # Timeouts, hook list, weights
```

---

## 14. MVP Scope & Decisions Log

**Must-have (build first):**
- Emulator + install + Frida hooks for all 7 categories
- 5-phase hybrid stimulation (skip step 4 decoy-input if short on time)
- mitmproxy + PCAP capture with IOC matching
- Tier 1–3 evasion countermeasures (always-active spoofing, time acceleration, intent forcing)
- Silence Detector (Tier 4) + basic fallback recalibration
- JSON feature vector → `S_dynamic` + `C_dynamic`
- Integration call into the master risk equation

**Nice-to-have (Day 3 / if time permits):**
- Memory DEX dump (Tier 5) with full validation pipeline
- Decoy credential input via `uiautomator2`
- Fake banking apps pre-installed to trigger banking-trojan-specific logic
- MITRE ATT&CK tagging in the output
- Audio/camera/clipboard hooks

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Emulator | Redroid (AVD fallback) | Fastest boot, easiest automation |
| Native code hooking | No | Out of MVP scope |
| Parallel instances | No | Single APK per cycle |
| Frida hiding | Partial (rename + port) | Accept fallback for advanced detection rather than chase full stealth |
| Silent apps | Treated as suspicious, not benign | Banking trojans often go silent in sandboxes |
| Screenshot capture | Yes | Useful for the final report |
| IOC integration | Yes | Reuses existing RAG/ChromaDB from the GenAI module |
| Confidence vs risk | Reported separately | Prevents "under-observed" apps from being scored as confidently benign |

---

## 15. Testing & Validation Plan

| Test ID | APK Type | Expected Behavior | Validates |
|---------|----------|---------------------|-------------|
| T1 | Benign calculator/utility app | `S_dynamic` < 0.15, minimal API calls | Low false-positive baseline |
| T2 | Known banking trojan (Anubis/Teabot/Cerberus) | `S_dynamic` > 0.75, SMS + accessibility + C2 hits | End-to-end detection |
| T3 | SMS stealer | `S_dynamic` > 0.60, SMS sends detected | SMS hook correctness |
| T4 | Anti-emulator sample | Evasion countered OR fallback triggered cleanly | Sections 8 & 10 |
| T5 | Dormant/time-delayed malware | Monkey/Tier 2–4 triggers payload; score rises after silence window | Evasion ladder |
| T6 | Packed sample (DexGuard/Jiagu) | Memory dump succeeds, DEX fed back to Static/GenAI | Section 9 |
| T7 | Instant-crash sample | Graceful fallback, no pipeline exception, `S_dynamic = null` + flag | Failure handling |

**Datasets:** CIC-AndMal (labeled behavior), MalwareBazaar (live malicious samples), AndroZoo (benign baseline).

---

## 16. Hackathon Timeline

| Day | Focus | Deliverable |
|-----|-------|-------------|
| **Day 1 AM** | Redroid/AVD setup, ADB connectivity, Phase 0 spoofing | Emulator that passes basic fingerprint checks |
| **Day 1 PM** | Frida server deployment + 7-category hook script | Verified hooks on a benign test app |
| **Day 2 AM** | 5-phase stimulation, permission handling, network capture wired up | End-to-end: install → run → collect |
| **Day 2 PM** | Feature extraction, `S_dynamic`/`C_dynamic` computation, JSON output | Score generated for T1–T3 test APKs |
| **Day 3 AM** | Evasion ladder Tiers 4–5 (silence detector, memory dump), fallback + weight recalibration | T4–T7 passing |
| **Day 3 PM** | Integration with static/risk pipeline, demo prep, edge cases | Working demo on 2–3 sample APKs |

---

## 17. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Redroid fails on hackathon machines | Medium | Keep an AVD image as backup |
| Frida crashes on a given Android version | Medium | Pin to Android 11 (API 30) |
| Sample APKs don't trigger within the window | Medium | Silence Detector extends runtime +60s; cap total at 150s |
| Team member unfamiliar with Frida | High | Pair programming, start with a single simple hook |
| Network capture too noisy | Low | Filter PCAP by app UID |
| Memory dump adds complexity late | Medium | Treat Tier 5 as stretch — fallback (Section 10) covers packed apps even without it |

---

## 18. Limitations & Future Roadmap (Honest Scope Statement)

- **Incomplete code-path coverage** — only paths triggered during the analysis window are observed.
- **Execution timeout (≤150s)** will miss malware with very long sleep timers beyond what time-acceleration can compress in practice.
- **OEM-specific evasion** (hardware-specific checks) may still detect the emulator despite spoofing — future work: route flagged APKs to a physical device farm.
- **Custom SSL pinning** implementations that resist the Frida bypass will limit HTTPS body visibility.
- **Offline C2 infrastructure** at analysis time means exfiltration can't be captured even if the malware is otherwise willing to run.
- Roadmap: continuous RAG/IOC feed updates, analyst feedback loop for false positives, ATT&CK-tagged reporting by default.

---

## 19. Success Criteria (Demo/Judging)

- **Detection:** correctly flags malicious behavior on the provided obfuscated/evasive test samples.
- **Anti-evasion:** visibly bypasses sleep timers and forced intents on at least the T4/T5 evasive samples.
- **Speed:** full analysis cycle completes in under ~4 minutes.
- **Resilience:** a crashing or DexGuard-packed sample never throws an unhandled exception — it produces a memory dump and/or a recalibrated score instead.
- **Explainability:** final output includes both a score and a feature-level breakdown a judge can read without needing raw logs.
