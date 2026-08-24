@echo off
echo =======================================
echo    CyberShield Analysis Worker (Omen)
echo =======================================

if not exist .env (
    echo Creating .env from .env.example...
    copy .env.example .env
    echo Please edit .env with your BACKEND_URL and WORKER_API_KEY.
    pause
    exit /b 1
)

if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
    call venv\Scripts\activate
    pip install -r requirements.txt
) else (
    call venv\Scripts\activate
)

echo Starting analysis worker...
python worker.py
pause
