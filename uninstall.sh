#!/usr/bin/env bash
# ==============================================================================
# Elysian Sprite Studio - Linux Uninstaller
# ==============================================================================
# Safely stops service, cleans up systemd files, removes application binaries,
# and protects user data and .env configurations by default.
# ==============================================================================

set -euo pipefail

BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
CYAN="\033[0;36m"
RESET="\033[0m"

log_info() { echo -e "${CYAN}[INFO]${RESET} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${RESET} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${RESET} $1"; }
log_error() { echo -e "${RED}[ERROR]${RESET} $1" >&2; }

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ------------------------------------------------------------------------------
# 0. Delavar Studio Terminal Banner (Uninstaller Mode - Bold White)
# ------------------------------------------------------------------------------
if [[ -f "${SOURCE_DIR}/banner.sh" ]]; then
    # shellcheck source=/dev/null
    source "${SOURCE_DIR}/banner.sh"
    show_delavar_banner "uninstall"
elif [[ -f "./banner.sh" ]]; then
    # shellcheck source=/dev/null
    source "./banner.sh"
    show_delavar_banner "uninstall"
elif [[ -f "/opt/elysian-sprite-studio/banner.sh" ]]; then
    # shellcheck source=/dev/null
    source "/opt/elysian-sprite-studio/banner.sh"
    show_delavar_banner "uninstall"
fi

if [[ "${EUID}" -ne 0 ]]; then
    log_error "This script must be run as root or with sudo privileges."
    echo "Usage: sudo bash uninstall.sh [--purge]"
    exit 1
fi

INSTALL_DIR="/opt/elysian-sprite-studio"
SERVICE_NAME="sprite-studio"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
CLI_BIN="/usr/local/bin/sprite-studio"
SERVICE_USER="spritestudio"
LOG_DIR="/var/log/elysian-sprite-studio"

PURGE=false
if [[ "${1:-}" == "--purge" || "${1:-}" == "-f" ]]; then
    PURGE=true
fi

echo "This uninstaller will perform the following actions:"
echo "  1. Stop and disable the systemd service '${SERVICE_NAME}'"
echo "  2. Remove ${SERVICE_FILE}"
echo "  3. Remove CLI launcher '${CLI_BIN}'"
echo "  4. Remove application runtime files from '${INSTALL_DIR}'"
echo ""

if [[ "${PURGE}" == "false" ]]; then
    echo -e "${GREEN}Default safety policy:${RESET} Your .env file and persistent data/ folder"
    echo "will be archived to /opt/elysian-sprite-studio-backup-$(date +%Y%m%d%H%M%S) before removal."
    echo ""
    # If running interactively, confirm with user
    if [[ -t 0 ]]; then
        read -r -p "Are you sure you want to proceed with uninstallation? (y/N): " CONFIRM
        if [[ ! "${CONFIRM}" =~ ^[Yy]$ ]]; then
            log_info "Uninstallation cancelled by user."
            exit 0
        fi
    fi
else
    log_warn "--purge flag detected: All application files, including .env and data, will be completely deleted."
fi

# 1. Stop and disable systemd service
if systemctl is-active --quiet "${SERVICE_NAME}" 2>/dev/null; then
    log_info "Stopping ${SERVICE_NAME} service..."
    systemctl stop "${SERVICE_NAME}" 2>/dev/null || true
fi

if systemctl is-enabled --quiet "${SERVICE_NAME}" 2>/dev/null; then
    log_info "Disabling ${SERVICE_NAME} service..."
    systemctl disable "${SERVICE_NAME}" 2>/dev/null || true
fi

# 2. Remove systemd service file
if [[ -f "${SERVICE_FILE}" ]]; then
    log_info "Removing ${SERVICE_FILE}..."
    rm -f "${SERVICE_FILE}"
    systemctl daemon-reload
fi

# 3. Remove CLI launcher
if [[ -f "${CLI_BIN}" ]]; then
    log_info "Removing CLI launcher ${CLI_BIN}..."
    rm -f "${CLI_BIN}"
fi

# 4. Data Backup or Purge
if [[ -d "${INSTALL_DIR}" ]]; then
    if [[ "${PURGE}" == "false" ]]; then
        BACKUP_DIR="/opt/elysian-sprite-studio-backup-$(date +%Y%m%d%H%M%S)"
        log_info "Preserving user data and configuration to ${BACKUP_DIR}..."
        mkdir -p "${BACKUP_DIR}"
        
        if [[ -f "${INSTALL_DIR}/.env" ]]; then
            cp "${INSTALL_DIR}/.env" "${BACKUP_DIR}/.env"
        fi
        if [[ -d "${INSTALL_DIR}/data" ]]; then
            cp -r "${INSTALL_DIR}/data" "${BACKUP_DIR}/data"
        fi
        log_success "Backup preserved at: ${BACKUP_DIR}"
    fi

    log_info "Removing application files from ${INSTALL_DIR}..."
    rm -rf "${INSTALL_DIR}"
fi

# 5. Clean logs
if [[ -d "${LOG_DIR}" ]]; then
    rm -rf "${LOG_DIR}"
fi

# 6. Inform about system user
if id -u "${SERVICE_USER}" >/dev/null 2>&1; then
    userdel "${SERVICE_USER}" 2>/dev/null || true
    log_info "Removed dedicated service user '${SERVICE_USER}'."
fi

echo ""
log_success "Elysian Sprite Studio has been cleanly uninstalled from this system."
if [[ "${PURGE}" == "false" && -d "${BACKUP_DIR:-}" ]]; then
    echo -e "User settings and sprites were saved to: ${CYAN}${BACKUP_DIR}${RESET}"
fi
echo ""
EOF
