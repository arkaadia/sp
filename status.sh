#!/usr/bin/env bash
# ==============================================================================
# Elysian Sprite Studio - Direct Status & Health Check Script
# ==============================================================================
set -euo pipefail

SERVICE_NAME="sprite-studio"
INSTALL_DIR="/opt/elysian-sprite-studio"
APP_DIR="${INSTALL_DIR}"
if [[ ! -d "${APP_DIR}" ]]; then
    APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

echo "============================================================"
echo "         Elysian Sprite Studio - System Status              "
echo "============================================================"

# 1. Systemd Status
if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files | grep -q "${SERVICE_NAME}.service"; then
    echo -n "Systemd Service Status: "
    if systemctl is-active --quiet "${SERVICE_NAME}"; then
        echo -e "\033[0;32mACTIVE (RUNNING)\033[0m"
    else
        echo -e "\033[0;31mINACTIVE / STOPPED\033[0m"
    fi
fi

# 2. Port and Configuration
PORT=3000
HOST="0.0.0.0"
if [[ -f "${APP_DIR}/.env" ]]; then
    PORT=$(grep -E '^PORT=' "${APP_DIR}/.env" | cut -d= -f2 | tr -d '"\r ' || echo "3000")
    HOST=$(grep -E '^HOST=' "${APP_DIR}/.env" | cut -d= -f2 | tr -d '"\r ' || echo "0.0.0.0")
fi

echo "Configured Host: ${HOST}"
echo "Configured Port: ${PORT}"
echo "Target Endpoint: http://${HOST}:${PORT}"
echo ""

# 3. HTTP Health API Query
echo "Checking HTTP Health API (/api/health)..."
HEALTH_OUTPUT=$(curl -s --connect-timeout 3 "http://${HOST}:${PORT}/api/health" || true)

if [[ -n "${HEALTH_OUTPUT}" && "${HEALTH_OUTPUT}" =~ "status" ]]; then
    echo -e "\033[0;32m[HEALTH OK]\033[0m Server responded successfully:"
    echo "${HEALTH_OUTPUT}"
else
    echo -e "\033[0;31m[UNREACHABLE]\033[0m Could not connect to http://${HOST}:${PORT}/api/health."
    echo "Tip: Check logs with 'journalctl -u sprite-studio -n 20' or 'sprite-studio logs'."
fi
echo "============================================================"
