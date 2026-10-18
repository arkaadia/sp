#!/usr/bin/env bash
# ==============================================================================
# Elysian Sprite Studio - Updater
# ==============================================================================
# Pulls latest updates, rebuilds the application, and reloads systemd service
# with zero data loss to .env and user sprites.
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

if [[ "${EUID}" -ne 0 ]]; then
    log_error "This script must be run as root or with sudo privileges."
    echo "Usage: sudo bash update.sh"
    exit 1
fi

INSTALL_DIR="/opt/elysian-sprite-studio"
SERVICE_NAME="sprite-studio"

if [[ ! -d "${INSTALL_DIR}" ]]; then
    # If not running in /opt, use current directory
    INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

log_info "Updating Elysian Sprite Studio at ${INSTALL_DIR}..."

cd "${INSTALL_DIR}"

# 1. Backup .env
if [[ -f "${INSTALL_DIR}/.env" ]]; then
    cp "${INSTALL_DIR}/.env" "/tmp/sprite-studio-env-update-backup-$$.env"
    log_info "Configuration backed up."
fi

# 2. Pull Git updates if it's a git repo
if [[ -d "${INSTALL_DIR}/.git" ]]; then
    log_info "Fetching latest code from Git repository..."
    git pull origin main || log_warn "Git pull encountered non-critical status. Continuing..."
fi

# Restore .env if needed
if [[ -f "/tmp/sprite-studio-env-update-backup-$$.env" ]]; then
    cp "/tmp/sprite-studio-env-update-backup-$$.env" "${INSTALL_DIR}/.env"
    rm -f "/tmp/sprite-studio-env-update-backup-$$.env"
fi

# 3. Detect runtime
RUNTIME_BIN=""
if command -v bun >/dev/null 2>&1; then
    RUNTIME_BIN="$(command -v bun)"
elif [[ -x "/usr/local/bin/bun" ]]; then
    RUNTIME_BIN="/usr/local/bin/bun"
elif command -v node >/dev/null 2>&1; then
    RUNTIME_BIN="$(command -v node)"
fi

# Proxy sanitization
sanitize_proxy_env() {
    local proxy_vars=("http_proxy" "HTTP_PROXY" "https_proxy" "HTTPS_PROXY" "all_proxy" "ALL_PROXY" "ftp_proxy" "FTP_PROXY" "no_proxy" "NO_PROXY")
    for var in "${proxy_vars[@]}"; do
        if [ -n "${!var+x}" ]; then
            local clean="${!var}"
            clean="${clean#"${clean%%[![:space:]]*}"}"
            clean="${clean%"${clean##*[![:space:]]}"}"
            if [[ "$clean" =~ ^\"(.*)\"$ ]]; then clean="${BASH_REMATCH[1]}"; fi
            if [[ "$clean" =~ ^\'(.*)\'$ ]]; then clean="${BASH_REMATCH[1]}"; fi
            clean="${clean#"${clean%%[![:space:]]*}"}"
            clean="${clean%"${clean##*[![:space:]]}"}"
            if [ -z "$clean" ]; then
                unset "$var"
            elif [[ "$var" =~ ^(no_proxy|NO_PROXY)$ ]]; then
                export "$var=$clean"
            elif [[ "$clean" =~ ^(https?|socks5h?|socks4a?):// ]]; then
                export "$var=$clean"
            else
                unset "$var"
            fi
        fi
    done
}
sanitize_proxy_env

# 4. Install dependencies
log_info "Updating project dependencies..."
if [[ "${RUNTIME_BIN}" =~ bun$ ]]; then
    "${RUNTIME_BIN}" install --frozen-lockfile || "${RUNTIME_BIN}" install
    log_info "Building production bundle with Bun..."
    "${RUNTIME_BIN}" run build
else
    if [[ -f "${INSTALL_DIR}/package-lock.json" ]]; then
        npm ci || npm install
    else
        npm install
    fi
    log_info "Building production bundle with npm..."
    npm run build
fi

# 5. Fix permissions
SERVICE_USER="spritestudio"
if id -u "${SERVICE_USER}" >/dev/null 2>&1; then
    chown -R "${SERVICE_USER}:${SERVICE_USER}" "${INSTALL_DIR}"
fi

# 6. Restart Service
if systemctl is-active --quiet "${SERVICE_NAME}" 2>/dev/null; then
    log_info "Restarting systemd service '${SERVICE_NAME}'..."
    systemctl restart "${SERVICE_NAME}"
    sleep 2
    if systemctl is-active --quiet "${SERVICE_NAME}"; then
        log_success "Service successfully restarted."
    else
        log_error "Service failed to restart. Check logs with: journalctl -u ${SERVICE_NAME} -n 20"
        exit 1
    fi
fi

# Health check
if [[ -f "${INSTALL_DIR}/.env" ]]; then
    PORT=$(grep -E '^PORT=' "${INSTALL_DIR}/.env" | cut -d= -f2 | tr -d '"\r ' || echo "3000")
    HOST=$(grep -E '^HOST=' "${INSTALL_DIR}/.env" | cut -d= -f2 | tr -d '"\r ' || echo "127.0.0.1")
    curl -s "http://${HOST}:${PORT}/api/health" || true
    echo ""
fi

log_success "Elysian Sprite Studio updated successfully!"
EOF
