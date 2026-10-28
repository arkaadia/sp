#!/usr/bin/env bash
# ==============================================================================
# Elysian Sprite Studio - Direct Stop Script
# ==============================================================================
set -euo pipefail

SERVICE_NAME="sprite-studio"
PID_FILE="/tmp/sprite-studio.pid"

if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files | grep -q "${SERVICE_NAME}.service"; then
    echo "Stopping Elysian Sprite Studio via systemd..."
    if [[ "${EUID}" -eq 0 ]]; then
        systemctl stop "${SERVICE_NAME}"
    else
        sudo systemctl stop "${SERVICE_NAME}"
    fi
    echo "Service stopped."
    exit 0
fi

# Fallback for standalone background mode
if [[ -f "${PID_FILE}" ]]; then
    PID=$(cat "${PID_FILE}")
    if ps -p "${PID}" >/dev/null 2>&1; then
        echo "Stopping Elysian Sprite Studio process (PID: ${PID})..."
        kill -15 "${PID}" 2>/dev/null || kill -9 "${PID}" 2>/dev/null || true
        rm -f "${PID_FILE}"
        echo "Service stopped."
        exit 0
    else
        rm -f "${PID_FILE}"
    fi
fi

# Check for running server.ts processes
PIDS=$(pgrep -f "server.ts" || true)
if [[ -n "${PIDS}" ]]; then
    echo "Stopping server processes: ${PIDS}"
    kill -15 ${PIDS} 2>/dev/null || kill -9 ${PIDS} 2>/dev/null || true
    echo "Processes stopped."
else
    echo "Elysian Sprite Studio is not currently running."
fi
