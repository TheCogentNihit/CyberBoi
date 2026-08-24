"""CyberShield Worker — Polling loop stub.

This worker polls the CyberShield backend for analysis jobs,
downloads APKs, runs analysis (stubbed), and posts results.

The actual analysis logic (static, dynamic, network, RAG) is
out of scope here — wire it in by replacing the stub functions.
"""

from __future__ import annotations

import os
import sys
import time
import hashlib
import logging
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("cybershield-worker")

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000").rstrip("/")
WORKER_API_KEY = os.getenv("WORKER_API_KEY", "")
WORK_DIR = Path(os.getenv("WORK_DIR", "./worker_data"))

if not WORKER_API_KEY:
    logger.error("WORKER_API_KEY is not set. Exiting.")
    sys.exit(1)

HEADERS = {"Authorization": f"Bearer {WORKER_API_KEY}"}
WORK_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Stub analysis functions — replace these with real implementations
# ---------------------------------------------------------------------------

def run_static_analysis(apk_path: Path, profile: str) -> list[dict]:
    """STUB: Wire in your static analysis engine here.

    Should return a list of finding dicts matching the ResultFinding schema:
    [{"severity": "High", "title": "...", "category": "...", "description": "...",
      "evidence": "...", "source": "static_analysis"}, ...]
    """
    logger.info("[STUB] Static analysis — returning demo findings")
    return [
        {
            "severity": "Medium",
            "title": "Debuggable Application",
            "category": "Configuration",
            "description": "The application has the debuggable flag enabled in the manifest.",
            "evidence": "AndroidManifest.xml: android:debuggable=\"true\"",
            "affected_component": "AndroidManifest.xml",
            "recommendation": "Disable the debuggable flag for release builds.",
            "confidence": "high",
            "source": "static_analysis",
        },
    ]


def run_dynamic_analysis(apk_path: Path, profile: str) -> list[dict]:
    """STUB: Wire in your dynamic analysis engine here.

    Should return a list of finding dicts.
    """
    logger.info("[STUB] Dynamic analysis — returning demo findings")
    return [
        {
            "severity": "High",
            "title": "SMS Access Detected",
            "category": "SMS",
            "description": "Application reads SMS messages at runtime, potentially accessing OTPs.",
            "evidence": "Frida hook: SmsMessage.getMessageBody() called 3 times",
            "affected_component": "com.example.app.SmsReceiver",
            "recommendation": "Verify SMS access is necessary and properly disclosed.",
            "confidence": "high",
            "source": "dynamic_analysis",
        },
    ]


def run_network_analysis(apk_path: Path, profile: str) -> list[dict]:
    """STUB: Wire in your network analysis engine here."""
    logger.info("[STUB] Network analysis — returning demo findings")
    return []


def generate_report_html(findings: list[dict], apk_path: Path) -> str:
    """STUB: Generate an HTML report from findings."""
    logger.info("[STUB] Generating report HTML")
    finding_rows = ""
    for f in findings:
        finding_rows += f"""
        <tr>
            <td><span class="severity-{f['severity'].lower()}">{f['severity']}</span></td>
            <td>{f['title']}</td>
            <td>{f['category']}</td>
            <td>{f['description']}</td>
        </tr>
        """
    return f"""
    <section class="report">
        <h1>CyberShield Analysis Report</h1>
        <p>Total findings: {len(findings)}</p>
        <table>
            <thead>
                <tr><th>Severity</th><th>Title</th><th>Category</th><th>Description</th></tr>
            </thead>
            <tbody>{finding_rows}</tbody>
        </table>
    </section>
    """


# ---------------------------------------------------------------------------
# Worker loop
# ---------------------------------------------------------------------------

def claim_job() -> dict | None:
    """POST /api/worker/jobs/claim — long-polls ~20s."""
    try:
        resp = requests.post(f"{BACKEND_URL}/api/worker/jobs/claim", headers=HEADERS, timeout=30)
        if resp.status_code == 200:
            return resp.json()
        elif resp.status_code == 204:
            return None
        else:
            logger.warning(f"Claim returned {resp.status_code}: {resp.text}")
            return None
    except requests.RequestException as e:
        logger.error(f"Failed to reach backend: {e}")
        time.sleep(5)
        return None


def post_progress(job_id: str, stage: str, progress: int, message: str = ""):
    try:
        requests.post(
            f"{BACKEND_URL}/api/worker/jobs/{job_id}/progress",
            headers=HEADERS,
            json={"stage": stage, "progress": progress, "message": message},
            timeout=10,
        )
    except requests.RequestException as e:
        logger.warning(f"Failed to post progress: {e}")


def post_results(job_id: str, findings: list[dict], report_html: str | None = None):
    try:
        requests.post(
            f"{BACKEND_URL}/api/worker/jobs/{job_id}/results",
            headers=HEADERS,
            json={"findings": findings, "artifacts": [], "report_html": report_html},
            timeout=30,
        )
    except requests.RequestException as e:
        logger.warning(f"Failed to post results: {e}")


def post_complete(job_id: str):
    try:
        requests.post(f"{BACKEND_URL}/api/worker/jobs/{job_id}/complete", headers=HEADERS, timeout=10)
    except requests.RequestException as e:
        logger.warning(f"Failed to post complete: {e}")


def post_fail(job_id: str, error_message: str):
    try:
        requests.post(
            f"{BACKEND_URL}/api/worker/jobs/{job_id}/fail",
            headers=HEADERS,
            json={"error_message": error_message},
            timeout=10,
        )
    except requests.RequestException as e:
        logger.warning(f"Failed to post failure: {e}")


def download_apk(artifact_url: str, job_dir: Path) -> Path:
    """Download APK from backend."""
    url = f"{BACKEND_URL}{artifact_url}"
    apk_path = job_dir / "input.apk"
    resp = requests.get(url, headers=HEADERS, timeout=60, stream=True)
    resp.raise_for_status()
    with open(apk_path, "wb") as f:
        for chunk in resp.iter_content(chunk_size=8192):
            f.write(chunk)
    return apk_path


def process_job(job: dict):
    """Execute the full analysis pipeline for a claimed job."""
    job_id = job["job_id"]
    scan_id = job["scan_id"]
    profile = job["profile"]

    logger.info(f"Processing job {job_id} (scan {scan_id}, profile: {profile})")

    job_dir = WORK_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    try:
        # 1. Download APK
        post_progress(job_id, "running_static", 5, "Downloading APK…")
        apk_path = download_apk(job["artifact_url"], job_dir)
        logger.info(f"APK downloaded: {apk_path} ({apk_path.stat().st_size} bytes)")

        # 2. Static analysis
        post_progress(job_id, "running_static", 15, "Running static analysis…")
        static_findings = run_static_analysis(apk_path, profile)
        post_progress(job_id, "running_static", 30, f"Static analysis complete — {len(static_findings)} findings")

        # 3. Dynamic analysis
        post_progress(job_id, "running_dynamic", 35, "Starting dynamic analysis…")
        dynamic_findings = run_dynamic_analysis(apk_path, profile)
        post_progress(job_id, "running_dynamic", 60, f"Dynamic analysis complete — {len(dynamic_findings)} findings")

        # 4. Network analysis
        post_progress(job_id, "running_network", 65, "Running network analysis…")
        network_findings = run_network_analysis(apk_path, profile)
        post_progress(job_id, "running_network", 75, "Network analysis complete")

        # 5. RAG / GenAI
        post_progress(job_id, "running_rag", 80, "Running AI-assisted interpretation…")
        time.sleep(1)  # Stub delay
        post_progress(job_id, "running_rag", 90, "AI interpretation complete")

        # 6. Generate report
        post_progress(job_id, "generating_report", 92, "Generating report…")
        all_findings = static_findings + dynamic_findings + network_findings
        report_html = generate_report_html(all_findings, apk_path)

        # 7. Submit results
        post_results(job_id, all_findings, report_html)
        post_complete(job_id)
        logger.info(f"Job {job_id} completed successfully with {len(all_findings)} total findings")

    except Exception as e:
        logger.exception(f"Job {job_id} failed: {e}")
        post_fail(job_id, str(e))


def main():
    logger.info(f"CyberShield Worker starting — backend: {BACKEND_URL}")
    logger.info("Polling for jobs…")

    while True:
        job = claim_job()
        if job:
            process_job(job)
        # If claim returned None (204 / timeout), immediately re-poll
        # since the claim endpoint already long-polled for ~20s


if __name__ == "__main__":
    main()
