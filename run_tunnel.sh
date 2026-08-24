#!/usr/bin/env bash
# Quickstart Cloudflare Tunnel for CyberShield
# Exposes http://localhost:8000 over a public HTTPS URL (zero configuration)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=========================================================="
echo " Starting Free Cloudflare Tunnel for CyberShield Backend"
echo "=========================================================="
echo "Your backend on localhost:8000 will be given a public HTTPS URL."
echo "Look for the https://*.trycloudflare.com URL below:"
echo "=========================================================="

if [ -f "$SCRIPT_DIR/cloudflared" ]; then
    "$SCRIPT_DIR/cloudflared" tunnel --url http://localhost:8000
else
    npx -y localtunnel --port 8000
fi
