#!/usr/bin/env bash
# =============================================================================
# deploy/setup.sh
#
# Run ONCE as root on a fresh Ubuntu/Debian VPS to:
#   1. Create a non-root user for the application
#   2. Harden the UFW firewall (block direct app port, allow 22/80/443)
#   3. Install Node.js (via nvm), PM2, and Nginx
#   4. Register PM2 as a systemd service under the app user
#
# Usage:
#   chmod +x deploy/setup.sh
#   sudo bash deploy/setup.sh
#
# After this script, copy your app to /home/leaseapp/app and run:
#   sudo -u leaseapp bash -c "cd /home/leaseapp/app && npm ci && npm run build"
#   sudo -u leaseapp pm2 start ecosystem.config.js --env production
#   sudo -u leaseapp pm2 save
# =============================================================================
set -euo pipefail

APP_USER="leaseapp"
APP_PORT=5000          # must match PORT in your .env
NODE_VERSION="20"      # LTS

# ── 1. Create dedicated non-root application user ─────────────────────────────
if ! id "$APP_USER" &>/dev/null; then
  useradd --create-home --shell /bin/bash --comment "Lease API" "$APP_USER"
  echo "Created user: $APP_USER"
fi

# ── 2. UFW firewall ───────────────────────────────────────────────────────────
apt-get install -y ufw

# Reset to a known state (only if ufw is inactive to avoid locking yourself out)
ufw --force reset

ufw default deny incoming
ufw default allow outgoing

ufw allow 22/tcp    comment "SSH"
ufw allow 80/tcp    comment "HTTP (Nginx)"
ufw allow 443/tcp   comment "HTTPS (Nginx)"

# Block direct access to the Node.js port from external IPs;
# allow only the local Nginx reverse proxy.
ufw deny in on eth0 to any port "$APP_PORT" proto tcp comment "Block direct Node port"

ufw --force enable
ufw status verbose

# ── 3. Install Node.js via NodeSource ─────────────────────────────────────────
if ! command -v node &>/dev/null; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash -
  apt-get install -y nodejs
fi

node -v && npm -v

# ── 4. Install PM2 globally ───────────────────────────────────────────────────
npm install -g pm2

# ── 5. Create log directory ───────────────────────────────────────────────────
mkdir -p /var/log/lease-api
chown "$APP_USER":"$APP_USER" /var/log/lease-api

# ── 6. Install Nginx ──────────────────────────────────────────────────────────
apt-get install -y nginx certbot python3-certbot-nginx

# Copy Nginx site config (adjust path as needed)
# cp nginx/lease-api.conf /etc/nginx/sites-available/lease-api
# ln -sf /etc/nginx/sites-available/lease-api /etc/nginx/sites-enabled/
# nginx -t && systemctl reload nginx

# ── 7. Register PM2 startup with systemd (run as the app user) ───────────────
# This generates a systemd unit and enables it.
sudo -u "$APP_USER" pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" || true
# The output will ask you to run a 'sudo env ...' command – run it manually.

echo ""
echo "=== Setup complete ==="
echo "Next steps:"
echo "  1. Place your app in /home/$APP_USER/app and copy .env there."
echo "  2. sudo -u $APP_USER bash -c 'cd /home/$APP_USER/app && npm ci && npm run build'"
echo "  3. Update nginx/lease-api.conf: replace YOUR_DOMAIN, then:"
echo "     cp nginx/lease-api.conf /etc/nginx/sites-available/lease-api"
echo "     ln -sf /etc/nginx/sites-available/lease-api /etc/nginx/sites-enabled/"
echo "     certbot --nginx -d YOUR_DOMAIN"
echo "     nginx -t && systemctl reload nginx"
echo "  4. sudo -u $APP_USER pm2 start /home/$APP_USER/app/ecosystem.config.js --env production"
echo "  5. sudo -u $APP_USER pm2 save"
