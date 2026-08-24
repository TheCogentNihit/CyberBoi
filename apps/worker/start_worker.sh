#!/usr/bin/env bash
set -e

echo "=== CyberShield Analysis Worker ==="

if [ ! -f .env ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "Please edit .env with your BACKEND_URL and WORKER_API_KEY before running."
    exit 1
fi

if [ ! -d "venv" ]; then
    echo "Setting up Python virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

echo "Starting worker polling loop..."
python worker.py
