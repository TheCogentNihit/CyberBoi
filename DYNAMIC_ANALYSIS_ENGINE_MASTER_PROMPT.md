# Master Build Prompt: Team Phoenix Dynamic APK Analysis Engine

You are a senior Python, Android platform, malware-analysis, DevOps, and test-automation engineer. Build a production-shaped, hackathon-feasible **defensive dynamic-analysis backend for uploaded Android APK files**.

This prompt is self-contained. Do not assume access to earlier conversations or a frontend. Work autonomously, make reasonable engineering decisions, and document them. Do not stop after producing a plan or pseudocode: create the repository, implementation, tests, configuration, scripts, and documentation, then run every safe validation available in the current environment.

## 1. Context and objective

This is the dynamic-analysis portion of Team Phoenix's solution for the Cybershield IITH x BOI challenge, "Generative AI-Based Automated Analysis and Risk Scoring of Fraudulent APKs."

The eventual complete system will accept APK uploads through a website or mobile frontend and combine:

- static analysis;
- dynamic analysis;
- GenAI-assisted interpretation;
- external reputation intelligence; and
- explainable risk scoring/reporting.

For this task, implement **only the dynamic-analysis service and its integration contract**. There is no frontend yet, and you must not build one. There will never be a physical Android device in this workflow. Every APK is uploaded to a backend and executed only in an isolated virtual Android environment.

Primary result:

```text
APK upload/input
-> queued analysis job
-> isolated virtual Android sandbox
-> installation and controlled execution
-> runtime instrumentation and passive capture
-> UI/event stimulation
-> normalized evidence timeline
-> behavioral features and correlations
-> S_dynamic and C_dynamic
-> JSON result and artifacts
-> unconditional cleanup
```

`S_dynamic` is observed behavioral danger in `[0,1]`. `C_dynamic` is evidence completeness/reliability in `[0,1]`. Never treat low confidence as proof that an APK is benign.

The future total-risk equation is:

```text
Risk = 0.30*S_static + 0.30*S_dynamic + 0.25*S_GenAI + 0.15*S_rep
```

Do not implement the other scoring modules. Return enough structured data for a future aggregator to recompute weights when dynamic analysis is unavailable.

## 2. Non-negotiable architecture

Build a backend-oriented system with these boundaries:

1. **Control plane**: CLI and Python API for now; a small optional FastAPI analysis endpoint may be included only if it remains clearly separated from execution workers. No frontend.
2. **Job layer**: a job model/state machine that can later be connected to Redis/Celery, RabbitMQ, or another queue. An in-process single-worker implementation is sufficient for the MVP.
3. **Sandbox worker**: the only component allowed to touch ADB, emulator processes, Frida, captures, and APK bytes.
4. **Artifact store**: per-analysis directory with immutable inputs, events, logs, screenshots, PCAP, metadata, and final result.
5. **Cleanup supervisor**: timeout and cleanup must execute even after exceptions, cancellation, hook failure, or app crash.

Use this lifecycle:

```text
RECEIVED -> VALIDATING -> PREPARING -> INSTALLING -> INSTRUMENTING
-> LAUNCHING -> STIMULATING -> MONITORING -> COLLECTING
-> CORRELATING -> SCORING -> CLEANING -> COMPLETE
```

Also support `FAILED`, `TIMED_OUT`, `PARTIAL`, and `CANCELLED`. Every terminal state must still emit a valid result JSON.

## 3. Sandbox decision: implement two adapters

Define a strict `SandboxBackend` abstraction. Implement or scaffold both adapters without leaking backend-specific logic into analysis code.

### 3.1 Redroid backend - production/hackathon Linux target

Treat Redroid as the preferred high-throughput Linux worker when its required kernel features are present. Advantages we want to preserve:

- fast container startup and teardown;
- simple automated provisioning;
- low overhead compared with a full emulator VM;
- repeatable Android images;
- convenient per-job data volumes;
- a path to multiple isolated workers later; and
- good fit for a headless hosted service where users only upload APKs.

However, do **not** treat a Redroid/Docker container as a sufficient malware boundary. Redroid shares the host kernel and deployments often require Binder/BinderFS and elevated container privileges. The intended production boundary is:

```text
Public API/control plane
        |
  authenticated job message
        |
Disposable Linux VM or dedicated worker node
        |
Redroid container + per-run Android data
        |
restricted egress and disposable artifacts
```

Never expose ADB port 5555 publicly. Bind it only to a private/loopback interface and use a randomly allocated local port. Do not mount the repository, home directory, Docker socket, cloud credentials, SSH keys, or host secrets into the sandbox.

The Redroid adapter must perform a preflight check for Docker/Podman, kernel/Binder support, image availability, required privileges, free space, ADB connectivity, architecture, and network policy. If unavailable, return an actionable diagnostic or select AVD when configured.

### 3.2 AVD backend - development and stronger guest boundary

Implement the official Android Emulator/AVD adapter as the portable development fallback for Windows, Linux, Intel macOS, and Apple Silicon macOS. It should support:

- command-line/headless launch;
- host tool path auto-detection with configuration overrides;
- hardware-acceleration diagnostics;
- clean userdata or a known-clean snapshot;
- built-in `-tcpdump` capture where available;
- deterministic emulator serial selection;
- startup readiness checks; and
- forced shutdown and reset.

On Windows, prefer a native Windows emulator rather than requiring nested virtualization in WSL. The Python control process may use configured Windows executable paths if it runs from WSL.

### 3.3 Default selection

Use configuration rather than hard-coding:

```yaml
sandbox:
  backend: auto
  production_preference: redroid
  development_preference: avd
```

`auto` should select Redroid only on a compatible, intentionally configured Linux worker; otherwise use AVD. A backend mismatch must yield a clear `doctor` report, never an unexplained crash.

Pin the MVP Android profile to Android 11/API 30. Prefer x86_64 on Intel/AMD hosts and arm64-v8a on ARM64 hosts. Inspect the APK's packaged native ABIs before launch and report incompatibility explicitly. Do not claim that one host architecture can execute every APK.

## 4. Threat model and safety controls

The service processes untrusted APKs for defensive analysis. Enforce:

- maximum upload size and extension/magic/ZIP validation;
- SHA-256 hashing before execution;
- unique non-user-controlled analysis IDs and paths;
- ZIP-slip/path-traversal prevention;
- no shell command construction from raw filenames/package names;
- subprocess argument arrays, explicit timeouts, and captured output;
- no public ADB, emulator-console, Frida, proxy, or debug ports;
- no personal Google account, contacts, credentials, messages, or files;
- synthetic data only;
- no shared clipboard and no broad writable host mounts;
- a dedicated restricted network namespace or worker network;
- deny access to host LAN, metadata endpoints, control-plane services, and private address ranges;
- configurable egress modes: `disabled`, `sinkhole`, `allowlisted`, and explicitly authorized `internet`;
- DNS and HTTP sink services for safe testing;
- CPU, RAM, disk, process-count, and wall-clock limits;
- one APK per sandbox lifecycle in the MVP;
- destroy/reset all writable Android state after every run; and
- artifact retention and redaction settings.

Initial development and automated tests must use only benign applications and a purpose-built synthetic behavior-test APK or mocked ADB/Frida fixtures. Do not download, bundle, or execute live malware. Real malicious samples are a later, separately authorized validation phase on appropriately isolated infrastructure.

## 5. Repository and files to create

Create a clean Python 3.11+ project similar to:

```text
dynamic-analysis-engine/
├── README.md
├── LICENSE or LICENSE-NOTICE.md
├── pyproject.toml
├── requirements.txt
├── .env.example
├── .gitignore
├── config/
│   ├── default.yaml
│   ├── scoring.yaml
│   └── device_profiles.yaml
├── dynamic_analysis/
│   ├── __init__.py
│   ├── __main__.py
│   ├── cli.py
│   ├── api.py
│   ├── config.py
│   ├── models.py
│   ├── exceptions.py
│   ├── orchestrator.py
│   ├── jobs.py
│   ├── sandbox/
│   │   ├── base.py
│   │   ├── detector.py
│   │   ├── redroid.py
│   │   └── avd.py
│   ├── adb/
│   │   ├── client.py
│   │   ├── apk.py
│   │   ├── installer.py
│   │   ├── permissions.py
│   │   └── stimulation.py
│   ├── instrumentation/
│   │   ├── frida_engine.py
│   │   ├── hook_loader.py
│   │   └── hooks/
│   │       ├── core.js
│   │       ├── sms.js
│   │       ├── accessibility.js
│   │       ├── runtime.js
│   │       ├── dex.js
│   │       ├── network.js
│   │       ├── packages.js
│   │       └── device.js
│   ├── capture/
│   │   ├── logcat.py
│   │   ├── screenshots.py
│   │   ├── pcap.py
│   │   └── proxy.py
│   ├── evidence/
│   │   ├── schema.py
│   │   ├── normalizer.py
│   │   └── timeline.py
│   ├── analysis/
│   │   ├── features.py
│   │   ├── correlations.py
│   │   ├── scorer.py
│   │   └── confidence.py
│   ├── fallback/
│   │   ├── detector.py
│   │   └── policies.py
│   └── utilities/
│       ├── hashing.py
│       ├── paths.py
│       ├── redaction.py
│       └── subprocesses.py
├── scripts/
│   ├── setup_linux.sh
│   ├── setup_windows.ps1
│   ├── setup_macos.sh
│   └── create_avd.py
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── contract/
│   └── fixtures/
└── docs/
    ├── ARCHITECTURE.md
    ├── DEPLOYMENT.md
    ├── INSTALL_LINUX.md
    ├── INSTALL_WINDOWS.md
    ├── INSTALL_MACOS.md
    ├── USAGE.md
    ├── CONFIGURATION.md
    ├── OUTPUT_SCHEMA.md
    ├── SCORING.md
    ├── HOOKS.md
    ├── SANDBOX_SAFETY.md
    ├── TESTING.md
    ├── TROUBLESHOOTING.md
    ├── LIMITATIONS.md
    └── INTEGRATION.md
```

You may refine the tree, but do not collapse everything into a few giant files. Prefer typed dataclasses or Pydantic models, narrow interfaces, dependency injection, and testable subprocess wrappers.

## 6. CLI and Python API

Required commands:

```bash
python -m dynamic_analysis doctor
python -m dynamic_analysis setup --backend avd
python -m dynamic_analysis setup --backend redroid
python -m dynamic_analysis analyze sample.apk --backend auto --output ./results
python -m dynamic_analysis validate-result ./results/<analysis-id>/result.json
python -m dynamic_analysis clean --analysis-id <id>
```

Required library call:

```python
from dynamic_analysis import analyze_dynamic

result = analyze_dynamic(
    apk_path="sample.apk",
    static_features=None,
    backend="auto",
)
```

The CLI must have helpful exit codes and human-readable errors. `doctor` must report Python/tool versions, paths, host OS/architecture, virtualization or Binder status, selected backend, ADB status, Frida client/server compatibility expectations, free space, and fixes for failed checks. It must not mutate the system unless explicitly asked.

## 7. APK preflight

Before execution:

- verify regular file, size, ZIP/APK structure, and Android manifest presence;
- hash input with SHA-256;
- extract package name, version, minimum/target SDK, launchable activity, requested permissions, receivers/services, debuggable flag, and native ABIs using available Android tooling;
- safely copy the APK to its job directory under a fixed internal filename;
- compare APK ABI requirements with sandbox ABI;
- reject or mark unsupported split/APKS/XAPK inputs unless support is deliberately implemented; and
- record tool versions and every preflight decision.

Do not rely on user-supplied package names or paths.

## 8. Execution and stimulation

Implement a deterministic, bounded stimulation sequence:

1. Start/reset sandbox and wait for Android boot completion.
2. Configure safe synthetic device state.
3. Start passive captures.
4. Install the APK. `adb install -g` may grant ordinary runtime permissions but does not grant accessibility, notification-listener, overlay, device-admin, VPN, or every special permission. Track those states honestly.
5. Spawn or launch the main process in a way compatible with Frida attachment.
6. Handle ordinary permission dialogs using a bounded allowlist.
7. Perform a few deterministic interactions.
8. Run approximately 300 Monkey events with 150 ms throttle.
9. Dwell for approximately 20 seconds for background activity.
10. Trigger only an allowlisted set of manifest-declared events where supported, such as boot completed, screen unlock, power connected, or package replacement. Prefer explicit targeting. Do not blindly broadcast every system intent.
11. Capture screenshots at useful milestones.
12. Stop captures, collect artifacts, score, and clean up.

Default total runtime should be configurable and bounded near 150 seconds. Record actual timings and interaction counts for confidence scoring.

## 9. Instrumentation

Use Frida for Java-layer observation with graceful failure. Hooks emit evidence only; they do not score directly.

Initial categories:

- SMS access and sending;
- accessibility-related activity;
- shell/process execution;
- reflection and dynamic class/DEX loading;
- installed-package enumeration;
- device identifier/fingerprinting queries;
- Java networking; and
- common anti-analysis checks.

Treat signals contextually. For example, reading an SMS body or receiving an accessibility event is not automatically malicious. Stronger conclusions require temporal correlation with package targeting, identifiers, dynamic payload loading, or outbound transfer.

Do not implement full native `.so` instrumentation in the MVP. Do not promise universal Frida concealment or universal TLS-pinning bypass. If hooks fail or are terminated, switch to passive evidence and reduce `C_dynamic`.

Long-delay handling must be conservative: log long sleeps; modify only suspiciously long delays (default threshold 15 seconds), replace with a nonzero delay (default 1 second), avoid framework/UI threads where possible, and emit an explicit `ANTI_ANALYSIS`/intervention event. Never compress every sleep over 100 ms.

Memory DEX extraction is a stretch interface, disabled by default. If scaffolded, require validation before trusting an artifact: DEX header, declared size/bounds, string/class table sanity, SHA-256, provenance, and error handling. Never claim it works reliably without an integration test.

## 10. Network capture

Raw PCAP is core. Use the AVD `-tcpdump` capability where applicable or a contained worker capture for Redroid. Mitmproxy/HTTPS inspection is optional and failure-tolerant.

Record separately:

```json
{
  "network_capture": true,
  "https_decryption": false,
  "https_decryption_reason": "pinning_or_custom_transport_suspected"
}
```

The network policy must be enforceable independently of capture. Tests should use a local DNS/HTTP sink or fixtures. Distinguish DNS, destination IP/port, TLS metadata, cleartext HTTP, and decrypted proxy events. Redact possible secrets in user-facing output while retaining controlled raw artifacts according to configuration.

IOC matching should use a pluggable offline interface. Do not require a live threat-intelligence subscription for core tests.

## 11. Evidence schema and artifacts

Every source must normalize to a common versioned event schema resembling:

```json
{
  "schema_version": "1.0",
  "timestamp": "2026-08-03T12:00:00.000Z",
  "monotonic_offset_ms": 1234,
  "analysis_id": "analysis_<random>",
  "event_type": "DYNAMIC_CODE_LOAD",
  "source": "FRIDA",
  "severity": "MEDIUM",
  "confidence": 0.78,
  "api_class": "dalvik.system.DexClassLoader",
  "api_method": "$init",
  "process": {"name": "example", "pid": 123},
  "metadata": {"dex_path": "<redacted>"}
}
```

Use UTC wall time plus a monotonic per-run offset for reliable correlation. Validate events before writing them. Prefer JSON Lines for the timeline and atomic writes for final JSON.

Per-run artifacts should include at least:

```text
input.sha256
metadata.json
events.jsonl
logcat.txt
network.pcap (when available)
screenshots/
tool-status.json
errors.json
result.json
```

## 12. Features, correlations, and transparent scoring

Implement a deterministic rule-based MVP with all weights in YAML. Do not train or pretend to train an ML model.

Feature vector examples:

- `sms_send_count`, `sms_read_count`;
- `shell_exec_count` and categorized commands;
- `accessibility_event_count`;
- `dex_load_count`, reflection count, unusual source paths;
- `network_connection_count`, unique destinations, suspicious destination count;
- plaintext transfer indicators;
- installed-package enumeration count and sensitive-category targeting;
- device identifier query count;
- anti-analysis check/intervention count;
- crash count, process restarts, hook loss;
- time to first network/SMS/dynamic-load event;
- API-category entropy/diversity; and
- matched temporal chains.

Correlation examples, using configurable windows:

- dynamic DEX load -> sensitive API use -> outbound network;
- SMS access -> outbound network;
- installed-app enumeration -> accessibility activity;
- device identifiers -> cleartext request; and
- anti-analysis check -> immediate process exit/hook loss.

Avoid double counting: cap categories and correlation bonuses. Emit a score explanation showing which normalized features and rules contributed. Silence alone should lower `C_dynamic`; it should add little or no danger unless static inputs or observed anti-analysis evidence support an evasion hypothesis.

Calculate `C_dynamic` from execution completeness, including install/launch success, process survival, duration achieved, instrumentation availability, stimulation coverage, passive capture success, ABI compatibility, crashes, and cleanup. If no meaningful execution occurred, allow `S_dynamic = null` rather than inventing a value.

Suggested output:

```json
{
  "schema_version": "1.0",
  "analysis_id": "analysis_<random>",
  "status": "COMPLETE",
  "apk": {"sha256": "...", "package_name": "...", "abis": []},
  "sandbox": {"backend": "redroid", "android_api": 30, "abi": "x86_64"},
  "s_dynamic": 0.72,
  "c_dynamic": 0.88,
  "feature_vector": {},
  "correlations": [],
  "score_explanation": [],
  "fallback_triggered": false,
  "fallback_reason": null,
  "evasion_suspected": false,
  "coverage": {},
  "network": {},
  "artifacts": {},
  "errors": [],
  "cleanup": {"attempted": true, "successful": true}
}
```

## 13. Fallback policy

Never fail silently and never automatically label execution failure as benign.

- ABI mismatch: skip execution, `S_dynamic=null`, very low confidence, actionable reason.
- Install failure: retry only when reason is understood and retry is safe.
- Immediate crash: capture crash/logcat/screenshot; one controlled relaunch maximum.
- Hook failure or Frida termination: continue logcat/PCAP/screenshots; mark passive-only and lower confidence.
- App silence: optionally extend once within the configured maximum; lower confidence; flag evasion only when evidence supports it.
- Network silence: record it without declaring stealth or maliciousness.
- Sandbox failure: clean up and return a structured partial/failed result.
- Cleanup failure: escalate status and provide an operator-action field; do not reuse the worker until remediated.

Return a `recommended_aggregate_weights` field only as metadata when dynamic analysis is unavailable; do not compute the full cross-module score.

## 14. Configuration

Use validated YAML configuration with environment-variable overrides for deployment paths/secrets. Include documented defaults for:

- backend selection and tool paths;
- Android version/ABI/device profile;
- timeouts and resource limits;
- stimulation counts/throttles;
- suspicious sleep threshold;
- screenshots and capture settings;
- network/egress policy;
- artifact retention and redaction;
- Frida hook categories;
- scoring weights, caps, and correlation windows; and
- fallback behavior.

Reject unknown/invalid critical configuration rather than silently ignoring it. Never put real credentials in sample configuration.

## 15. Tests and acceptance criteria

Build tests before claiming completion. Mock external tools for unit/contract tests so the suite works without Android installed.

Required tests:

- lifecycle transitions and illegal-transition rejection;
- subprocess timeout and cancellation;
- safe path handling and hostile filenames;
- APK metadata/ABI decision fixtures;
- backend auto-detection decisions;
- normalized-event validation;
- JSONL timeline ordering/correlation using monotonic time;
- scoring monotonicity, caps, and explainability;
- confidence reduction on crash/hook/capture failures;
- silence not producing a high danger score by itself;
- fallback result contract;
- cleanup runs after every injected failure stage;
- result-schema validation; and
- CLI smoke tests.

Integration tests should be marked/skippable when ADB, AVD, Redroid, Docker, Binder, KVM, or Frida are absent. Provide a harmless synthetic fixture plan and expected events. Do not make the default test suite download or run malware.

MVP acceptance criteria:

1. `doctor` works and accurately explains missing dependencies.
2. On a configured backend, a harmless APK can install, launch, receive stimulation, and be removed/reset.
3. At least one synthetic Frida hook becomes a normalized event.
4. Logcat, screenshot, and PCAP collection work where supported.
5. Feature extraction and scoring are deterministic and explainable.
6. Every failure path returns schema-valid JSON.
7. Cleanup is verified and worker reuse is blocked after unsafe cleanup failure.
8. A standard run is bounded under approximately four minutes.
9. Documentation allows a new developer to install and run it without this prompt.

## 16. Documentation requirements

The README must lead with what works now, not future claims. Include:

- project purpose and scope;
- architecture diagram;
- Redroid versus AVD trade-offs;
- explicit statement that no physical device is used;
- prerequisites and quick start;
- safe demo procedure using benign/synthetic APKs;
- CLI and Python examples;
- output example;
- security warning and containment model;
- supported/unsupported combinations;
- current limitations; and
- links to detailed docs.

Linux deployment documentation must explain that Redroid requires compatible kernel features and a stronger outer isolation boundary. Windows/macOS docs should focus on AVD development. Deployment docs must keep the public API/control plane separate from sandbox workers.

Document honestly that:

- dynamic analysis sees only triggered code paths;
- emulators can be fingerprinted;
- architecture mismatches may prevent execution;
- special Android privileges are not granted by `adb install -g`;
- TLS pinning/custom transports can prevent body inspection;
- offline servers reduce observable behavior;
- native code behavior is under-observed in the MVP; and
- reliable in-memory DEX recovery is stretch scope.

## 17. Implementation order

Use small verifiable checkpoints:

1. Project packaging, config, models, state machine, result schema.
2. Safe subprocess/path utilities and full mocked tests.
3. `SandboxBackend`, detection, and `doctor`.
4. AVD adapter and/or Redroid adapter according to the current host, while keeping both interfaces.
5. APK preflight and ADB operations.
6. Capture collectors and artifact management.
7. Frida engine plus a minimal hook, then remaining categories.
8. Stimulation and bounded fallbacks.
9. Normalization, timeline, correlations, scoring, confidence.
10. End-to-end benign/synthetic integration test.
11. Documentation and final security review.

Do not spend the first iteration on full memory dumping, advanced native hooks, parallel workers, ML training, GenAI reports, a frontend, or universal anti-instrumentation bypasses.

## 18. How to work and report

Before editing, inspect the existing repository and preserve unrelated user changes. If no repository exists, create it. State assumptions briefly, then implement. Do not ask preference questions when a safe documented default is sufficient.

Use authoritative documentation for technical claims. Pin dependencies sensibly. Avoid fake implementations that silently report success. Where host capabilities prevent a real integration test, implement the code and mocks, run the unit/contract suite, and clearly list exactly what requires a configured Linux/AVD host.

At the end provide:

- a concise summary of implemented behavior;
- repository/file paths;
- exact commands run and their results;
- test totals;
- what is fully working versus scaffolded;
- security/containment status;
- known limitations; and
- the next smallest safe milestone.

The final product must be maintainable, honest, defensive, and usable as the dynamic-analysis backend behind a future APK-upload website or app.
