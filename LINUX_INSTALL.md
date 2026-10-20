# Linux Installation & Production Deployment Guide
> Complete guide for deploying Elysian Sprite Studio on Linux servers and workstations.

---

## 1. Prerequisites

### Supported Operating Systems:
- **Ubuntu**: 20.04 LTS, 22.04 LTS, 24.04 LTS
- **Debian**: 11 (Bullseye), 12 (Bookworm)
- **Debian derivatives**: Linux Mint, Pop!_OS, Elementary OS, Kali Linux

### Hardware Requirements:
- **Architecture**: x86_64 (amd64) or aarch64 (ARM64)
- **RAM**: Minimum 512 MB (1 GB recommended for production builds)
- **Disk Space**: At least 500 MB free in `/opt`

### System Privileges:
- Root or `sudo` access is required to configure systemd services and install to `/opt`.

---

## 2. One-Command Automated Installation

Run the installer directly from the project directory:

```bash
git clone https://github.com/arkaadia/sp.git
cd sp
sudo bash install.sh
```

Upon launching, the installer displays the **DELAVAR STUDIO** terminal banner (in bold bright blue) and automatically proceeds with pre-flight checks.

> **Network & Proxy Options**:
> - If behind a proxy, preserve environment variables with `sudo -E bash install.sh`.
> - If running in an air-gapped or pre-configured offline environment: `sudo bash install.sh --skip-connectivity-check`.

### What `install.sh` Does Automatically:
1. **OS Detection**: Validates Linux distribution via `/etc/os-release`.
2. **Proxy Sanitization**: Detects empty quotes (`""`), whitespace, or malformed proxy variables to prevent curl syntax errors while preserving and masking valid proxy configurations.
3. **Pre-flight Checks**: Verifies internet connectivity to required registries and validates at least 500 MB free disk space.
4. **OS Packages**: Installs `curl`, `ca-certificates`, `git`, `build-essential`, `tar`, and `lsof` via `apt-get`.
5. **Runtime Provisioning**:
   - Automatically uses or installs the high-performance **Bun runtime** using `bun.lock`.
   - Seamlessly falls back to **Node.js 20 LTS / 22** using `package-lock.json` if Bun is not available.
6. **Reproducible Install**: Runs `bun install --frozen-lockfile` (or `npm ci` under Node.js) with aligned `esbuild@^0.28.0` and `vite@^8.3.0` to eliminate dependency conflicts.
7. **Safe Packaging & Data Preservation**: Copies all source files and nested source directories (including `src/data/spriteData.ts`) while anchoring runtime `./data/` exclusions to protect user assets and `.env` secrets from being overwritten or cleared.
8. **Pre-Build Source Verification**: Automatically validates all critical tracked source files (`src/data/spriteData.ts`, `src/App.tsx`, `server.ts`, etc.) before building to guarantee zero missing imports.
9. **Production Build**: Compiles Vite assets into `/opt/elysian-sprite-studio/dist` and verifies `index.html`.
10. **Port Conflict Safeguard**: Checks if port 3000 is occupied; if an external process holds it, auto-assigns the next available port without terminating unrelated applications.
11. **Least-Privilege Security User**: Creates a dedicated `spritestudio` system account without login privileges.
12. **Systemd Daemon**: Configures, enables, and starts `sprite-studio.service` with automatic restarts and crash recovery.
13. **Global Command**: Installs `/usr/local/bin/sprite-studio` for terminal control.

---

## 3. Browser Access & Network Security

### Network Access (Default: 0.0.0.0)
By default, the service binds to **`0.0.0.0`** to accept connections from both local and external networks on port 3000.
Open your browser and navigate to:

```
http://YOUR_SERVER_IP:3000
```

### Enabling LAN / Server Access
If you are hosting the studio on a remote VPS or local network server and want other devices to access it:

1. Edit `/opt/elysian-sprite-studio/.env`:
   ```bash
   sudo nano /opt/elysian-sprite-studio/.env
   ```
2. Update the `HOST` variable:
   ```ini
   HOST=0.0.0.0
   PORT=3000
   ```
3. Restart the service:
   ```bash
   sprite-studio restart
   ```

> ⚠️ **Security Warning**: Binding to `0.0.0.0` exposes port 3000 to your network. Always configure a firewall (UFW) or place the application behind an authenticating reverse proxy (such as Nginx with SSL) when hosting on public clouds.

### Firewall Configuration (UFW):
```bash
# Allow traffic on port 3000 (if exposing directly to trusted LAN)
sudo ufw allow 3000/tcp comment 'Elysian Sprite Studio'

# Or restrict access to your specific internal subnet:
sudo ufw allow from 192.168.1.0/24 to any port 3000 proto tcp
```

---

## 4. Service Management CLI (`sprite-studio`)

Manage the production background service using the global `sprite-studio` command:

| Command | Description |
| :--- | :--- |
| `sprite-studio status` | Displays systemd service state, port, and `/api/health` response |
| `sprite-studio start` | Starts the background systemd service |
| `sprite-studio stop` | Stops the service safely |
| `sprite-studio restart` | Gracefully restarts the application |
| `sprite-studio logs` | Views the 50 most recent journal logs |
| `sprite-studio logs -f` | Streams real-time logs (press Ctrl+C to exit) |
| `sprite-studio update` | Pulls updates, rebuilds frontend, and reloads service |

You can also use standard systemctl commands:
```bash
sudo systemctl status sprite-studio
sudo systemctl restart sprite-studio
sudo journalctl -u sprite-studio -f
```

---

## 5. Direct Management Scripts

If you prefer using direct scripts without the CLI launcher:

```bash
# Check status and health endpoint
bash status.sh

# Start service
bash start.sh

# Stop service
bash stop.sh

# Run updates
sudo bash update.sh
```

---

## 6. Optional Production Nginx Reverse Proxy & SSL

For enterprise or internet-facing deployments with custom domains and HTTPS, use Nginx:

### 1. Install Nginx:
```bash
sudo apt install -y nginx
```

### 2. Configure Virtual Host:
Create `/etc/nginx/sites-available/sprite-studio`:

```nginx
server {
    listen 80;
    server_name sprites.yourdomain.com;

    # Allow sprite uploads up to 25MB
    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static assets caching
    location /assets/ {
        proxy_pass http://127.0.0.1:3000;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
```

### 3. Enable Site & Reload:
```bash
sudo ln -s /etc/nginx/sites-available/sprite-studio /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 4. Enable Free HTTPS (Let's Encrypt):
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d sprites.yourdomain.com
```

---

## 7. Configuration Details (`.env`)

Configuration resides in `/opt/elysian-sprite-studio/.env`:

```ini
# Server Port (default: 3000)
PORT=3000

# Server Host Binding (0.0.0.0 for external/LAN access)
HOST=0.0.0.0

# Node Environment
NODE_ENV=production

# Optional Gemini API Key
# The studio is fully operational without this key.
# It is only utilized if you choose to use the AI animation breakdown assistant.
GEMINI_API_KEY=""

# Public Application URL
APP_URL="http://0.0.0.0:3000"
```

---

## 8. Upgrading & Updating

To update Elysian Sprite Studio to the latest version:

```bash
sprite-studio update
```
or:
```bash
sudo bash update.sh
```

**Data Safety Guarantee**: Updates preserve your `.env` settings and persistent data in `/opt/elysian-sprite-studio/data/`.

---

## 9. Safe Uninstallation

To remove the application and service:

```bash
sudo bash uninstall.sh
```

- Displays the **DELAVAR STUDIO** terminal banner (in bold white) upon execution.
- Stops and deletes the `sprite-studio` systemd service.
- Removes `/usr/local/bin/sprite-studio`.
- **Preserves your data and `.env` by default** in `/opt/elysian-sprite-studio-backup-TIMESTAMP`.
- To completely purge everything (including backups), run:
  ```bash
  sudo bash uninstall.sh --purge
  ```

---

## 10. Animation Rules & Standards

For sprite dimensions, frame counts, pivot point alignment, and engine export specifications, see **`SPRITE_RULES.md`**.
