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

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="/opt/elysian-sprite-studio"
SERVICE_NAME="sprite-studio"

if [[ ! -d "${INSTALL_DIR}" ]]; then
    # If not running in /opt and /opt does not exist, use current directory
    INSTALL_DIR="${SOURCE_DIR}"
fi

log_info "Updating Elysian Sprite Studio at ${INSTALL_DIR}..."

# 1. Backup .env and persistent user data
BACKUP_ENV="/tmp/sprite-studio-env-update-backup-$$.env"
if [[ -f "${INSTALL_DIR}/.env" ]]; then
    cp "${INSTALL_DIR}/.env" "${BACKUP_ENV}"
    log_info "Existing configuration backed up."
fi

BACKUP_DATA="/tmp/sprite-studio-data-update-backup-$$"
if [[ -d "${INSTALL_DIR}/data" && -n "$(ls -A "${INSTALL_DIR}/data" 2>/dev/null)" ]]; then
    mkdir -p "${BACKUP_DATA}"
    cp -r "${INSTALL_DIR}/data/." "${BACKUP_DATA}/"
    log_info "Existing persistent user data backed up."
fi

# 2. Update files from Git or Source Directory
if [[ -d "${INSTALL_DIR}/.git" ]]; then
    log_info "Fetching latest code from Git repository in ${INSTALL_DIR}..."
    (cd "${INSTALL_DIR}" && git pull origin main || log_warn "Git pull encountered non-critical status. Continuing...")
elif [[ "${SOURCE_DIR}" != "${INSTALL_DIR}" ]]; then
    if [[ -d "${SOURCE_DIR}/.git" ]]; then
        log_info "Fetching latest code from Git repository at ${SOURCE_DIR}..."
        (cd "${SOURCE_DIR}" && git pull origin main || log_warn "Git pull in source dir encountered non-critical status.")
    fi
    log_info "Synchronizing updated application files from ${SOURCE_DIR} to ${INSTALL_DIR}..."
    (
        cd "${SOURCE_DIR}"
        tar --exclude='.git' \
            --exclude='node_modules' \
            --exclude='.env*' \
            --exclude='dist' \
            --exclude='./data' \
            --exclude='./data/*' \
            -cf - . | (cd "${INSTALL_DIR}" && tar -xf -)
    )
fi

# 3. Restore .env and persistent data safely
if [[ -f "${BACKUP_ENV}" ]]; then
    cp "${BACKUP_ENV}" "${INSTALL_DIR}/.env"
    rm -f "${BACKUP_ENV}"
    log_success "Restored existing .env configuration."
fi

if [[ -d "${BACKUP_DATA}" ]]; then
    mkdir -p "${INSTALL_DIR}/data"
    cp -rn "${BACKUP_DATA}/." "${INSTALL_DIR}/data/" 2>/dev/null || true
    rm -rf "${BACKUP_DATA}"
    log_success "Preserved and restored existing persistent user data."
elif [[ -d "${SOURCE_DIR}/data" && ! -d "${INSTALL_DIR}/data" ]]; then
    mkdir -p "${INSTALL_DIR}/data"
    cp -rn "${SOURCE_DIR}/data/." "${INSTALL_DIR}/data/" 2>/dev/null || true
fi

cd "${INSTALL_DIR}"

# 4. Pre-build Source Verification
verify_required_source_files() {
    local target_dir="$1"
    log_info "Validating required source files in ${target_dir}..."

    local required_files=(
        "src/App.tsx"
        "src/main.tsx"
        "src/index.css"
        "src/data/spriteData.ts"
        "src/types/sprites.ts"
        "src/types/providers.ts"
        "src/utils/AssetLibrary.ts"
        "src/utils/imageProcessor.ts"
        "server.ts"
        "package.json"
        "vite.config.ts"
        "index.html"
    )

    local missing_files=()
    for rel_path in "${required_files[@]}"; do
        if [[ ! -f "${target_dir}/${rel_path}" ]]; then
            missing_files+=("${rel_path}")
        fi
    done

    if [[ "${#missing_files[@]}" -gt 0 ]]; then
        log_error "Source file validation failed! The following required files are missing from ${target_dir}:"
        for missing in "${missing_files[@]}"; do
            echo -e "  ${RED}✖ ${missing}${RESET}" >&2
        done
        echo "" >&2
        log_error "Update aborted to prevent deployment failure. Check packaging exclusion rules."
        return 1
    fi

    log_success "All required source files verified (including src/data/spriteData.ts)."
    return 0
}

if ! verify_required_source_files "${INSTALL_DIR}"; then
    exit 1
fi

# 5. Detect runtime
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

# 6. Install dependencies and build
log_info "Updating project dependencies..."
BUILD_SUCCESS=false

if [[ "${RUNTIME_BIN}" =~ bun$ ]]; then
    "${RUNTIME_BIN}" install --frozen-lockfile || "${RUNTIME_BIN}" install
    log_info "Building production bundle with Bun..."
    if "${RUNTIME_BIN}" run build; then
        BUILD_SUCCESS=true
    fi
else
    if [[ -f "${INSTALL_DIR}/package-lock.json" ]]; then
        npm ci || npm install
    else
        npm install
    fi
    log_info "Building production bundle with npm..."
    if npm run build; then
        BUILD_SUCCESS=true
    fi
fi

if [[ "${BUILD_SUCCESS}" != "true" || ! -f "${INSTALL_DIR}/dist/index.html" ]]; then
    log_error "Production build failed (${INSTALL_DIR}/dist/index.html was not generated)."
    exit 1
fi
log_success "Production build completed successfully."

# 7. Fix permissions
SERVICE_USER="spritestudio"
if id -u "${SERVICE_USER}" >/dev/null 2>&1; then
    chown -R "${SERVICE_USER}:${SERVICE_USER}" "${INSTALL_DIR}"
fi

# 8. Restart Service
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
