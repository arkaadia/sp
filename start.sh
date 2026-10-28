#!/usr/bin/env bash
# ==============================================================================
# Elysian Sprite Studio - Direct Start Script
# ==============================================================================
set -euo pipefail

SERVICE_NAME="sprite-studio"
INSTALL_DIR="/opt/elysian-sprite-studio"
PID_FILE="/tmp/sprite-studio.pid"

if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files | grep -q "${SERVICE_NAME}.service"; then
    echo "Starting Elysian Sprite Studio via systemd..."
    if [[ "${EUID}" -eq 0 ]]; then
        systemctl start "${SERVICE_NAME}"
        systemctl status "${SERVICE_NAME}" --no-pager
    else
        sudo systemctl start "${SERVICE_NAME}"
        sudo systemctl status "${SERVICE_NAME}" --no-pager
    fi
    exit 0
fi

# Fallback for systems without systemd / direct development start
APP_DIR="${INSTALL_DIR}"
if [[ ! -d "${APP_DIR}" ]]; then
    APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

cd "${APP_DIR}"

if [[ -f "${PID_FILE}" ]]; then
    PID=$(cat "${PID_FILE}")
    if ps -p "${PID}" >/dev/null 2>&1; then
        echo "Elysian Sprite Studio is already running (PID: ${PID})."
        exit 0
    fi
fi

echo "Starting Elysian Sprite Studio in standalone background mode..."
RUNTIME="node"
if command -v bun >/dev/null 2>&1; then
    RUNTIME="bun"
fi

NODE_ENV=production nohup ${RUNTIME} server.ts > /tmp/sprite-studio.log 2>&1 &
NEW_PID=$!
echo "${NEW_PID}" > "${PID_FILE}"

echo "Started with PID ${NEW_PID}. Logs: /tmp/sprite-studio.log"
sleep 2
if ps -p "${NEW_PID}" >/dev/null 2>&1; then
    echo "Service is running successfully."
else
    echo "Service failed to start. Inspect /tmp/sprite-studio.log for errors."
    exit 1
fi
