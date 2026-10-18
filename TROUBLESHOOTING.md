# Troubleshooting Guide — Elysian Sprite Studio
> Diagnostic solutions for common issues on Linux deployments.

---

## 1. Port Conflict (`Error: listen EADDRINUSE: address already in use :::3000`)

### Cause:
Another service (like a previous node process, Gunicorn, Grafana, or another web server) is already listening on port 3000.

### Diagnosis:
Run:
```bash
sudo lsof -i :3000
# or
sudo ss -tulpn | grep :3000
```

### Solution:
1. **Let the installer auto-assign**: The `install.sh` script automatically detects occupied ports and assigns the next free port (e.g. 3001, 3002).
2. **Manually change the port**:
   Edit `/opt/elysian-sprite-studio/.env`:
   ```ini
   PORT=8080
   APP_URL="http://127.0.0.1:8080"
   ```
   Then restart:
   ```bash
   sprite-studio restart
   ```

---

## 2. Inaccessible Browser URL (Connection Refused / Timeout)

### Cause 1: Binding to `127.0.0.1` on a Remote Server
By default, the server binds to `127.0.0.1` for local machine security. If you are accessing the server from another computer or over the internet, requests to `http://YOUR_SERVER_IP:3000` will be rejected.

**Solution**:
1. Edit `/opt/elysian-sprite-studio/.env`:
   ```ini
   HOST=0.0.0.0
   ```
2. Restart the service:
   ```bash
   sprite-studio restart
   ```

### Cause 2: Linux Firewall (UFW / iptables) Blocking Port
If `HOST=0.0.0.0` is set but the page still hangs:

**Solution**:
Check and allow port 3000 through your firewall:
```bash
sudo ufw status
sudo ufw allow 3000/tcp comment "Elysian Sprite Studio"
```

If hosted on AWS, GCP, Azure, or DigitalOcean, ensure the cloud provider's **Security Group** allows inbound TCP traffic on port 3000 (or use Nginx on port 80/443).

---

## 3. Service Failed to Start (`systemctl status sprite-studio` shows failed)

### Diagnosis:
Inspect the systemd journal logs to find the exact stack trace:
```bash
sprite-studio logs
# or
sudo journalctl -u sprite-studio -n 50 --no-pager
```

### Common Causes & Fixes:

#### A. Missing build output (`dist/index.html not found`)
If the build was interrupted:
```bash
cd /opt/elysian-sprite-studio
sudo -u spritestudio bun run build
sprite-studio restart
```

#### B. Permission Denied on `/opt/elysian-sprite-studio`
If files were modified as `root` without updating ownership:
```bash
sudo chown -R spritestudio:spritestudio /opt/elysian-sprite-studio
sudo chmod 750 /opt/elysian-sprite-studio
sprite-studio restart
```

---

## 4. Build Fails on Low-Memory VPS (Killed / Out of Memory)

### Cause:
Vite bundling on micro VPS instances (512MB RAM) can exceed memory limits during minification.

### Solution:
Add a temporary 1GB Linux swap file:
```bash
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Now rerun the build
cd /opt/elysian-sprite-studio
sudo bun run build
sprite-studio restart
```

---

## 5. `GEMINI_API_KEY` Warnings or 503 Service Unavailable

### Cause:
The server has optional AI animation breakdown capabilities. If `GEMINI_API_KEY` is empty, the application runs normally for all manual sprite slicing, animation playback, tileset export, and physics arena testing, but the AI prompt helper returns a 503 informational notice.

### Solution:
If you want to use the AI animation breakdown assistant:
1. Obtain an API key from Google AI Studio.
2. Add it to `/opt/elysian-sprite-studio/.env`:
   ```ini
   GEMINI_API_KEY="AIzaSy..."
   ```
3. Restart the service:
   ```bash
   sprite-studio restart
   ```

---

## 6. Dependency Installation Fails (Network / Proxy / Frozen Lockfile)

### Cause:
Network timeout or firewall preventing connection to package registries.

### Solution:
Test your connection to registry endpoints:
```bash
curl -I https://registry.npmjs.org
curl -I https://bun.sh
```

If you are behind a corporate proxy, export your proxy variables before running `install.sh`:
```bash
export http_proxy=http://proxy.yourcompany.com:8080
export https_proxy=http://proxy.yourcompany.com:8080
sudo -E bash install.sh
```

---

## 7. Diagnostic Quick Check

Run this 1-line health prober to test your installation:
```bash
curl -s http://127.0.0.1:3000/api/health | jq . || curl -s http://127.0.0.1:3000/api/health
```

Expected output:
```json
{
  "status": "ok",
  "app": "Elysian Sprite Studio",
  "mode": "production",
  "host": "127.0.0.1",
  "port": 3000,
  "aiAvailable": false,
  "uptimeSeconds": 142
}
```

---

## 8. Terminal Banner Display & Non-Interactive Pipes

The installer and uninstaller display a centered **DELAVAR STUDIO** ASCII banner.

- **Piped / CI / Log Redirects**: If `install.sh` or `uninstall.sh` is piped to a file or CI log (`sudo bash install.sh > install.log`), ANSI color codes are automatically stripped to keep the log file clean and readable.
- **Dumb Terminals**: If `TERM=dumb`, color escapes are suppressed automatically.
- **Non-Fatal**: Banner rendering errors never interrupt or abort installation or uninstallation routines.
