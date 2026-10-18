#!/usr/bin/env bash
# ==============================================================================
# Elysian Sprite Studio - Linux Production Installer & Systemd Deployer
# ==============================================================================
# Supported OS: Ubuntu (20.04, 22.04, 24.04), Debian (11, 12)
# Architecture: x86_64, aarch64 (ARM64)
# Default Install Path: /opt/elysian-sprite-studio
# Global CLI: /usr/local/bin/sprite-studio
# ==============================================================================

set -euo pipefail

# Text formatting
BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
CYAN="\033[0;36m"
RESET="\033[0m"

log_info() {
    echo -e "${CYAN}[INFO]${RESET} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${RESET} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${RESET} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${RESET} $1" >&2
}

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ------------------------------------------------------------------------------
# 0. Delavar Studio Terminal Banner
# ------------------------------------------------------------------------------
if [[ -f "${SOURCE_DIR}/banner.sh" ]]; then
    # shellcheck source=/dev/null
    source "${SOURCE_DIR}/banner.sh"
    show_delavar_banner "install"
fi

# ------------------------------------------------------------------------------
# 1. Root & Privilege Verification
# ------------------------------------------------------------------------------
if [[ "${EUID}" -ne 0 ]]; then
    log_error "This script must be run as root or with sudo privileges."
    echo "Usage: sudo bash install.sh"
    exit 1
fi

INSTALL_DIR="/opt/elysian-sprite-studio"
DATA_DIR="${INSTALL_DIR}/data"
LOG_DIR="/var/log/elysian-sprite-studio"
SERVICE_NAME="sprite-studio"
SERVICE_USER="spritestudio"
DEFAULT_PORT=3000
DEFAULT_HOST="127.0.0.1"

# ------------------------------------------------------------------------------
# 2. Linux Distribution Check
# ------------------------------------------------------------------------------
log_info "Detecting Linux distribution and package manager..."

if [[ -f /etc/os-release ]]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    OS_ID="${ID:-unknown}"
    OS_NAME="${PRETTY_NAME:-$ID}"
    OS_LIKE="${ID_LIKE:-}"
else
    log_error "Could not identify Linux distribution (/etc/os-release missing)."
    exit 1
fi

log_info "Detected OS: ${OS_NAME} (${OS_ID})"

SUPPORTED=false
case "${OS_ID}" in
    ubuntu|debian|linuxmint|pop|elementary|kali|raspbian)
        SUPPORTED=true
        ;;
    *)
        if [[ "${OS_LIKE}" =~ (debian|ubuntu) ]]; then
            SUPPORTED=true
        fi
        ;;
esac

if [[ "${SUPPORTED}" != "true" ]]; then
    log_warn "Your distribution (${OS_NAME}) is not directly validated by this apt installer."
    log_warn "This installer will continue, but ensure curl, build-essential, and systemd are available."
fi

# ------------------------------------------------------------------------------
# 3. Pre-flight Checks (Connectivity, Disk Space, Tools)
# ------------------------------------------------------------------------------
log_info "Performing environment pre-flight checks..."

# Check available disk space (require at least 500MB free)
FREE_KB=$(df -P /opt 2>/dev/null | awk 'NR==2 {print $4}' || df -P / 2>/dev/null | awk 'NR==2 {print $4}' || echo "1000000")
if [[ "${FREE_KB}" -lt 500000 ]]; then
    log_error "Insufficient disk space. At least 500 MB of free space is required in /opt."
    exit 1
fi
log_success "Disk space verification passed (${FREE_KB} KB available)."

# Check internet connectivity
log_info "Verifying internet connectivity..."
if curl -s --connect-timeout 5 https://github.com > /dev/null 2>&1 || curl -s --connect-timeout 5 https://google.com > /dev/null 2>&1; then
    log_success "Internet connectivity confirmed."
else
    log_error "Internet connection check failed. Cannot download project dependencies."
    exit 1
fi

# ------------------------------------------------------------------------------
# 4. OS Package Installation via APT
# ------------------------------------------------------------------------------
log_info "Updating system packages and installing OS dependencies..."

export DEBIAN_FRONTEND=noninteractive

if command -v apt-get >/dev/null 2>&1; then
    apt-get update -qq || log_warn "apt-get update encountered non-critical warnings."
    apt-get install -y -qq \
        curl \
        ca-certificates \
        git \
        build-essential \
        procps \
        lsof \
        tar \
        gzip >/dev/null 2>&1 || {
            log_error "Failed to install system packages via apt."
            exit 1
        }
    log_success "System OS packages verified."
else
    log_warn "apt-get not found. Ensure curl, git, build-essential, and tar are installed."
fi

# ------------------------------------------------------------------------------
# 5. Runtime & Lockfile Resolution (Bun / Node.js)
# ------------------------------------------------------------------------------
log_info "Resolving runtime environment based on repository lockfile..."

# The repository contains bun.lock. Bun provides 100% reproducible, fast installs.
RUNTIME_BIN=""

# Check if Bun is already installed
if command -v bun >/dev/null 2>&1; then
    RUNTIME_BIN="$(command -v bun)"
    log_success "Existing Bun runtime detected: ${RUNTIME_BIN} ($(${RUNTIME_BIN} --version))"
elif [[ -x "/usr/local/bin/bun" ]]; then
    RUNTIME_BIN="/usr/local/bin/bun"
    log_success "Bun runtime found at /usr/local/bin/bun ($(${RUNTIME_BIN} --version))"
fi

# If Bun is not installed, install it automatically
if [[ -z "${RUNTIME_BIN}" ]]; then
    log_info "Installing Bun runtime for reproducible lockfile deployment..."
    BUN_INSTALL_DIR="/tmp/bun-install-$$"
    mkdir -p "${BUN_INSTALL_DIR}"
    
    # Official Bun installer
    if curl -fsSL https://bun.sh/install | bash >/dev/null 2>&1; then
        # Bun installer installs to /root/.bun/bin/bun
        if [[ -x "${HOME}/.bun/bin/bun" ]]; then
            cp "${HOME}/.bun/bin/bun" /usr/local/bin/bun
            chmod 755 /usr/local/bin/bun
            RUNTIME_BIN="/usr/local/bin/bun"
            log_success "Bun runtime installed successfully to /usr/local/bin/bun ($(${RUNTIME_BIN} --version))."
        fi
    fi
fi

# Fallback to Node.js if Bun could not be provisioned
if [[ -z "${RUNTIME_BIN}" ]]; then
    log_warn "Bun automated installation did not succeed. Checking Node.js runtime..."
    if command -v node >/dev/null 2>&1; then
        NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
        if [[ "${NODE_VER}" -ge 18 ]]; then
            RUNTIME_BIN="$(command -v node)"
            log_success "Node.js ${NODE_VER} detected: ${RUNTIME_BIN}"
        else
            log_warn "Installed Node.js is version ${NODE_VER} (< 18). Provisioning Node 20 LTS..."
        fi
    fi

    if [[ -z "${RUNTIME_BIN}" ]]; then
        log_info "Installing Node.js LTS via official NodeSource repository..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
        apt-get install -y -qq nodejs >/dev/null 2>&1 || {
            log_error "Could not install Node.js LTS."
            exit 1
        }
        RUNTIME_BIN="$(command -v node)"
        log_success "Node.js $(node -v) and npm $(npm -v) installed successfully."
    fi
fi

if [[ -z "${RUNTIME_BIN}" ]]; then
    log_error "Neither Bun nor Node.js runtime could be provisioned. Cannot continue."
    exit 1
fi

# ------------------------------------------------------------------------------
# 6. Isolated Target Directory & Data Preservation
# ------------------------------------------------------------------------------
log_info "Setting up application directory at ${INSTALL_DIR}..."

PREVIOUS_INSTALL=false
if [[ -d "${INSTALL_DIR}" ]]; then
    PREVIOUS_INSTALL=true
    log_info "Existing installation detected at ${INSTALL_DIR}. Preserving configuration and persistent data..."
fi

mkdir -p "${INSTALL_DIR}"
mkdir -p "${DATA_DIR}"
mkdir -p "${LOG_DIR}"

# Preserve existing .env configuration if present
BACKUP_ENV="/tmp/sprite-studio-env-backup-$$.env"
if [[ -f "${INSTALL_DIR}/.env" ]]; then
    cp "${INSTALL_DIR}/.env" "${BACKUP_ENV}"
    log_info "Existing .env configuration backed up."
fi

# Copy application files from source directory
log_info "Copying application files to ${INSTALL_DIR}..."
# Use tar or rsync to copy while excluding git and node_modules
(
    cd "${SOURCE_DIR}"
    tar --exclude='.git' \
        --exclude='node_modules' \
        --exclude='.env' \
        --exclude='dist' \
        -cf - . | (cd "${INSTALL_DIR}" && tar -xf -)
)

# Restore .env if it existed, otherwise initialize from .env.example
if [[ -f "${BACKUP_ENV}" ]]; then
    mv "${BACKUP_ENV}" "${INSTALL_DIR}/.env"
    log_success "Restored existing .env configuration."
elif [[ ! -f "${INSTALL_DIR}/.env" ]]; then
    if [[ -f "${INSTALL_DIR}/.env.example" ]]; then
        cp "${INSTALL_DIR}/.env.example" "${INSTALL_DIR}/.env"
        log_success "Created initial .env from .env.example."
    else
        cat << 'EOF' > "${INSTALL_DIR}/.env"
PORT=3000
HOST=127.0.0.1
NODE_ENV=production
GEMINI_API_KEY=""
APP_URL="http://127.0.0.1:3000"
EOF
        log_success "Created default .env configuration."
    fi
fi

# Ensure data directory symlink or presence
mkdir -p "${DATA_DIR}"

# ------------------------------------------------------------------------------
# 7. Port Conflict Detection & Safe Resolution
# ------------------------------------------------------------------------------
log_info "Checking port configuration..."

# Read port from .env
CURRENT_PORT=$(grep -E '^PORT=' "${INSTALL_DIR}/.env" | cut -d= -f2 | tr -d '"\r ' || echo "${DEFAULT_PORT}")
CURRENT_PORT="${CURRENT_PORT:-3000}"
CURRENT_HOST=$(grep -E '^HOST=' "${INSTALL_DIR}/.env" | cut -d= -f2 | tr -d '"\r ' || echo "${DEFAULT_HOST}")
CURRENT_HOST="${CURRENT_HOST:-127.0.0.1}"

# Check if port is currently in use
check_port() {
    local port=$1
    if command -v lsof >/dev/null 2>&1; then
        lsof -iTCP:"${port}" -sTCP:LISTEN -n -P >/dev/null 2>&1
    elif command -v ss >/dev/null 2>&1; then
        ss -tuln | grep -q ":${port} "
    else
        return 1
    fi
}

# If the port is in use, verify if it belongs to our own existing service
RESOLVED_PORT="${CURRENT_PORT}"
if check_port "${CURRENT_PORT}"; then
    # If the systemd service is active, it's expected
    if systemctl is-active --quiet "${SERVICE_NAME}" 2>/dev/null; then
        log_info "Port ${CURRENT_PORT} is currently held by existing ${SERVICE_NAME} service. It will be reloaded cleanly."
    else
        log_warn "Port ${CURRENT_PORT} is currently in use by an external process."
        # Find next available port without killing unrelated process
        CANDIDATE_PORT=$((CURRENT_PORT + 1))
        while check_port "${CANDIDATE_PORT}"; do
            CANDIDATE_PORT=$((CANDIDATE_PORT + 1))
        done
        log_warn "Auto-assigning next free port: ${CANDIDATE_PORT} to prevent conflict."
        RESOLVED_PORT="${CANDIDATE_PORT}"
        sed -i "s/^PORT=.*/PORT=${RESOLVED_PORT}/" "${INSTALL_DIR}/.env"
        sed -i "s|APP_URL=.*|APP_URL=\"http://${CURRENT_HOST}:${RESOLVED_PORT}\"|" "${INSTALL_DIR}/.env"
    fi
fi

# ------------------------------------------------------------------------------
# 8. Dependency Installation & Production Build
# ------------------------------------------------------------------------------
log_info "Installing dependencies from lockfile..."
cd "${INSTALL_DIR}"

if [[ "${RUNTIME_BIN}" =~ bun$ ]]; then
    bun install --frozen-lockfile || {
        log_warn "Frozen lockfile install failed. Attempting standard bun install..."
        bun install || {
            log_error "Bun dependencies installation failed."
            exit 1
        }
    }
else
    npm ci 2>/dev/null || npm install || {
        log_error "npm dependencies installation failed."
        exit 1
    }
fi
log_success "Project dependencies installed."

log_info "Building frontend for production deployment..."
if [[ "${RUNTIME_BIN}" =~ bun$ ]]; then
    bun run build || {
        log_error "Production build with Bun failed."
        exit 1
    }
else
    npm run build || {
        log_error "Production build with npm failed."
        exit 1
    }
fi

if [[ ! -f "${INSTALL_DIR}/dist/index.html" ]]; then
    log_error "Build output missing (${INSTALL_DIR}/dist/index.html not found)."
    exit 1
fi
log_success "Production build completed successfully."

# ------------------------------------------------------------------------------
# 9. Dedicated System User Creation
# ------------------------------------------------------------------------------
log_info "Setting up dedicated system user '${SERVICE_USER}'..."

if ! id -u "${SERVICE_USER}" >/dev/null 2>&1; then
    useradd -r -s /usr/sbin/nologin -d "${INSTALL_DIR}" -c "Elysian Sprite Studio Service" "${SERVICE_USER}"
    log_success "System user '${SERVICE_USER}' created."
else
    log_info "System user '${SERVICE_USER}' already exists."
fi

# Set directory ownership
chown -R "${SERVICE_USER}:${SERVICE_USER}" "${INSTALL_DIR}"
chown -R "${SERVICE_USER}:${SERVICE_USER}" "${LOG_DIR}"
chmod 750 "${INSTALL_DIR}"
chmod 770 "${DATA_DIR}"
chmod 755 "${LOG_DIR}"

# ------------------------------------------------------------------------------
# 10. Systemd Service Configuration
# ------------------------------------------------------------------------------
log_info "Configuring systemd service '${SERVICE_NAME}'..."

EXEC_START=""
if [[ "${RUNTIME_BIN}" =~ bun$ ]]; then
    EXEC_START="${RUNTIME_BIN} server.ts"
else
    EXEC_START="$(command -v node) server.ts"
fi

SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

cat << EOF > "${SERVICE_FILE}"
[Unit]
Description=Elysian Sprite Studio Production Service
Documentation=https://github.com/arkaadia/sp
After=network.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_USER}
WorkingDirectory=${INSTALL_DIR}
Environment=NODE_ENV=production
EnvironmentFile=-${INSTALL_DIR}/.env
ExecStart=${EXEC_START}
Restart=always
RestartSec=5
StandardOutput=append:${LOG_DIR}/service.log
StandardError=append:${LOG_DIR}/service-error.log

# Security Sandboxing
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
ReadWritePaths=${INSTALL_DIR} ${LOG_DIR}

[Install]
WantedBy=multi-user.target
EOF

chmod 644 "${SERVICE_FILE}"
systemctl daemon-reload
systemctl enable "${SERVICE_NAME}" >/dev/null 2>&1
log_success "Systemd service '${SERVICE_NAME}' enabled at boot."

# Restart or Start Service
log_info "Starting ${SERVICE_NAME} service..."
systemctl restart "${SERVICE_NAME}"

# ------------------------------------------------------------------------------
# 11. Global CLI Launcher (/usr/local/bin/sprite-studio)
# ------------------------------------------------------------------------------
log_info "Creating global CLI command '/usr/local/bin/sprite-studio'..."

cat << 'EOF' > /usr/local/bin/sprite-studio
#!/usr/bin/env bash
# Elysian Sprite Studio - Global Management Command
set -euo pipefail

INSTALL_DIR="/opt/elysian-sprite-studio"
SERVICE_NAME="sprite-studio"
LOG_DIR="/var/log/elysian-sprite-studio"

if [[ $# -eq 0 ]]; then
    ACTION="status"
else
    ACTION="$1"
fi

case "${ACTION}" in
    start)
        echo "Starting Elysian Sprite Studio service..."
        sudo systemctl start "${SERVICE_NAME}"
        sudo systemctl status "${SERVICE_NAME}" --no-pager
        ;;
    stop)
        echo "Stopping Elysian Sprite Studio service..."
        sudo systemctl stop "${SERVICE_NAME}"
        echo "Service stopped."
        ;;
    restart)
        echo "Restarting Elysian Sprite Studio service..."
        sudo systemctl restart "${SERVICE_NAME}"
        sudo systemctl status "${SERVICE_NAME}" --no-pager
        ;;
    status)
        echo "=== Elysian Sprite Studio Service Status ==="
        systemctl status "${SERVICE_NAME}" --no-pager || true
        echo ""
        if [[ -f "${INSTALL_DIR}/.env" ]]; then
            PORT=$(grep -E '^PORT=' "${INSTALL_DIR}/.env" | cut -d= -f2 | tr -d '"\r ' || echo "3000")
            HOST=$(grep -E '^HOST=' "${INSTALL_DIR}/.env" | cut -d= -f2 | tr -d '"\r ' || echo "127.0.0.1")
            echo "Access URL: http://${HOST}:${PORT}"
            echo -n "Health Check: "
            curl -s "http://${HOST}:${PORT}/api/health" || echo "Service not responding on HTTP."
            echo ""
        fi
        ;;
    logs)
        if [[ "${2:-}" == "-f" || "${2:-}" == "--follow" ]]; then
            sudo journalctl -u "${SERVICE_NAME}" -f
        else
            sudo journalctl -u "${SERVICE_NAME}" -n 50 --no-pager
        fi
        ;;
    update)
        echo "Updating Elysian Sprite Studio..."
        if [[ -f "${INSTALL_DIR}/update.sh" ]]; then
            sudo bash "${INSTALL_DIR}/update.sh"
        else
            echo "Update script not found in ${INSTALL_DIR}"
            exit 1
        fi
        ;;
    help|--help|-h)
        cat << 'HELP_EOF'
Elysian Sprite Studio - CLI Management

Usage:
  sprite-studio [command]

Commands:
  start     Start the background systemd service
  stop      Stop the service
  restart   Restart the service
  status    Check service status and health API
  logs      View recent application logs (pass -f to follow)
  update    Fetch updates, rebuild, and reload the service
  help      Display this help message
HELP_EOF
        ;;
    *)
        echo "Unknown command: ${ACTION}"
        echo "Run 'sprite-studio help' for usage instructions."
        exit 1
        ;;
esac
EOF

chmod 755 /usr/local/bin/sprite-studio
log_success "Global CLI installed to /usr/local/bin/sprite-studio."

# ------------------------------------------------------------------------------
# 12. Verification & Health Check
# ------------------------------------------------------------------------------
log_info "Verifying service health..."

# Wait up to 10 seconds for service to respond
HEALTH_OK=false
for i in {1..10}; do
    if curl -s "http://${CURRENT_HOST}:${RESOLVED_PORT}/api/health" | grep -q '"status":"ok"'; then
        HEALTH_OK=true
        break
    fi
    sleep 1
done

echo ""
echo -e "${BOLD}${GREEN}============================================================${RESET}"
echo -e "${BOLD}${GREEN}  Elysian Sprite Studio Successfully Installed & Running!   ${RESET}"
echo -e "${BOLD}${GREEN}============================================================${RESET}"
echo ""
echo -e "  ${BOLD}Installation Directory:${RESET}  ${INSTALL_DIR}"
echo -e "  ${BOLD}Persistent Data:${RESET}        ${DATA_DIR}"
echo -e "  ${BOLD}Service Logs:${RESET}           ${LOG_DIR}"
echo -e "  ${BOLD}Runtime:${RESET}                $(${RUNTIME_BIN} --version) (${RUNTIME_BIN})"
echo -e "  ${BOLD}Systemd Service:${RESET}        ${SERVICE_NAME}.service"
echo -e "  ${BOLD}Local Browser Access:${RESET}   ${CYAN}http://${CURRENT_HOST}:${RESOLVED_PORT}${RESET}"
echo ""

if [[ "${HEALTH_OK}" == "true" ]]; then
    log_success "Health check confirmed: Server is responding normally."
else
    log_warn "Service started, but health endpoint took longer to respond."
    log_warn "Check logs with: sprite-studio logs"
fi

echo ""
echo -e "${BOLD}Management Commands:${RESET}"
echo "  sprite-studio status    # Check service and port health"
echo "  sprite-studio logs      # View real-time logs"
echo "  sprite-studio restart   # Restart production service"
echo "  sprite-studio stop      # Stop service"
echo "  sprite-studio update    # Pull updates and rebuild"
echo ""
echo -e "${BOLD}LAN / External Access Note:${RESET}"
echo "  By default, the server binds to 127.0.0.1 for local security."
echo "  To allow LAN access, change HOST=0.0.0.0 in ${INSTALL_DIR}/.env and restart:"
echo "  sudo sed -i 's/^HOST=.*/HOST=0.0.0.0/' ${INSTALL_DIR}/.env && sprite-studio restart"
echo ""
EOF
