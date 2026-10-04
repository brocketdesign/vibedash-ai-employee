#!/usr/bin/env bash
#
# Installs the VibeDash hosting agent on a VPS.
#
#   MGMT_SECRET=... BASE_DOMAIN=your-domain.com bash setup-vps.sh
#
# The agent (vps-agent.js, alongside this script) creates an Nginx vhost and
# webroot per company at {slug}.{BASE_DOMAIN}, and exposes the small HTTP API
# that src/lib/employee/vps.ts calls.
#
# IMPORTANT — this box may already be hosting something else. The agent is
# installed under its own name (/opt/vibedash-agent, vibedash-agent.service)
# and the script REFUSES to start if the chosen port is already taken, so it
# can coexist with an existing agent rather than silently replacing it.
set -euo pipefail

AGENT_DIR="/opt/vibedash-agent"
AGENT_FILE="$AGENT_DIR/agent.js"
SERVICE_NAME="vibedash-agent"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
SOURCE_AGENT="$(dirname "$0")/vps-agent.js"

PORT="${PORT:-7854}"
BASE_DOMAIN="${BASE_DOMAIN:-}"
SITES_ROOT="${SITES_ROOT:-/var/www/vibedash}"

# ── Preconditions ────────────────────────────────────────────────────────────

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: run as root (sudo bash setup-vps.sh)." >&2
  exit 1
fi

if [ -z "${MGMT_SECRET:-}" ]; then
  echo "ERROR: set MGMT_SECRET before running. It must match HOSTINGER_MGMT_SECRET" >&2
  echo "       in the app's environment, or every request will be rejected." >&2
  echo "       Generate one with: openssl rand -hex 32" >&2
  exit 1
fi

if [ -z "$BASE_DOMAIN" ]; then
  echo "ERROR: set BASE_DOMAIN to the domain whose wildcard (*.BASE_DOMAIN) points" >&2
  echo "       at this server. It must match VPS_ROOT_DOMAIN in the app's environment." >&2
  exit 1
fi

if [ ! -f "$SOURCE_AGENT" ]; then
  echo "ERROR: vps-agent.js not found next to this script ($SOURCE_AGENT)." >&2
  exit 1
fi

# Something else may already be serving on this port. By default we refuse
# rather than fight for it; TAKEOVER=1 says the old occupant is expendable.
if ss -lntp 2>/dev/null | grep -q ":${PORT} "; then
  if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo "[setup] $SERVICE_NAME already owns port $PORT — reinstalling in place."
  elif [ "${TAKEOVER:-0}" = "1" ]; then
    # Find the systemd unit holding the port and retire it. Matching on the pid
    # is what makes this precise — no guessing at service names.
    HOLDER_PID="$(ss -lntpH 2>/dev/null | grep ":${PORT} " | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2)"
    HOLDER_UNIT=""
    if [ -n "$HOLDER_PID" ]; then
      # systemctl is the canonical lookup; ps -o unit= is the fallback for
      # procps builds that expose it.
      HOLDER_UNIT="$(systemctl status "$HOLDER_PID" 2>/dev/null | head -1 | grep -oE '[a-zA-Z0-9@_.-]+\.service' | head -1 || true)"
      if [ -z "$HOLDER_UNIT" ]; then
        HOLDER_UNIT="$(ps -o unit= -p "$HOLDER_PID" 2>/dev/null | tr -d ' ' || true)"
      fi
    fi

    if [ -n "$HOLDER_UNIT" ] && [ "$HOLDER_UNIT" != "-" ] && [[ "$HOLDER_UNIT" == *.service ]]; then
      echo "[setup] TAKEOVER=1 — stopping and disabling $HOLDER_UNIT to claim port $PORT"
      systemctl stop "$HOLDER_UNIT" || true
      systemctl disable "$HOLDER_UNIT" >/dev/null 2>&1 || true
    elif [ -n "$HOLDER_PID" ]; then
      echo "[setup] TAKEOVER=1 — killing pid $HOLDER_PID to claim port $PORT"
      kill "$HOLDER_PID" 2>/dev/null || true
      sleep 2
      kill -9 "$HOLDER_PID" 2>/dev/null || true
    else
      echo "ERROR: port $PORT is busy but its owner could not be identified." >&2
      ss -lntp | grep ":${PORT} " >&2
      exit 1
    fi
    sleep 1
  else
    echo "ERROR: port $PORT is already in use by another process:" >&2
    ss -lntp | grep ":${PORT} " >&2
    echo "       To take the port anyway (stops whatever holds it):" >&2
    echo "         TAKEOVER=1 MGMT_SECRET=... bash setup-vps.sh" >&2
    echo "       Or install alongside it on a free port:" >&2
    echo "         PORT=7856 MGMT_SECRET=... bash setup-vps.sh" >&2
    echo "       and set VPS_AGENT_PORT to match in the app's environment." >&2
    exit 1
  fi
fi

echo "[setup] Installing the VibeDash agent"
echo "        port        $PORT"
echo "        base domain $BASE_DOMAIN"
echo "        sites root  $SITES_ROOT"

# ── Dependencies ─────────────────────────────────────────────────────────────

if ! command -v node >/dev/null 2>&1; then
  echo "[setup] Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

for pkg in nginx certbot python3-certbot-nginx; do
  if ! dpkg -s "$pkg" >/dev/null 2>&1; then
    echo "[setup] Installing $pkg..."
    apt-get install -y "$pkg"
  fi
done

# ── Install the agent ────────────────────────────────────────────────────────

mkdir -p "$AGENT_DIR" "$SITES_ROOT"
install -m 600 "$SOURCE_AGENT" "$AGENT_FILE"

cat > "$SERVICE_FILE" << SERVICE_EOF
[Unit]
Description=VibeDash hosting agent
After=network.target nginx.service

[Service]
Type=simple
ExecStart=/usr/bin/node ${AGENT_FILE}
Restart=always
RestartSec=3
Environment=MGMT_SECRET=${MGMT_SECRET}
Environment=PORT=${PORT}
Environment=BASE_DOMAIN=${BASE_DOMAIN}
Environment=SITES_ROOT=${SITES_ROOT}

[Install]
WantedBy=multi-user.target
SERVICE_EOF

chmod 600 "$SERVICE_FILE"   # the secret lives in here

systemctl daemon-reload
systemctl enable "$SERVICE_NAME" >/dev/null 2>&1 || true
systemctl restart "$SERVICE_NAME"

# ── Firewall: the agent must only be reachable by the app ────────────────────
#
# The API is guarded by a shared secret, but there is no reason to expose it to
# the whole internet as well. If ufw is managing the firewall, open the port
# only to the hosts you name in ALLOW_FROM (comma-separated).
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  if [ -n "${ALLOW_FROM:-}" ]; then
    IFS=',' read -ra SOURCES <<< "$ALLOW_FROM"
    for src in "${SOURCES[@]}"; do
      ufw allow from "$src" to any port "$PORT" proto tcp >/dev/null
      echo "[setup] ufw: allowed $src → :$PORT"
    done
  else
    echo "[setup] WARNING: ufw is active but ALLOW_FROM was not set, so port $PORT"
    echo "        was left closed. Vercel does not publish fixed egress IPs on all"
    echo "        plans — either open it with 'ufw allow $PORT/tcp' and rely on the"
    echo "        shared secret, or put the agent behind a proxy you control."
  fi
fi

# ── Verify ───────────────────────────────────────────────────────────────────

sleep 2
if ! systemctl is-active --quiet "$SERVICE_NAME"; then
  echo "ERROR: the agent failed to start. Logs:" >&2
  journalctl -u "$SERVICE_NAME" -n 30 --no-pager >&2
  exit 1
fi

HEALTH="$(curl -s -o /dev/null -w '%{http_code}' -H "X-Secret: ${MGMT_SECRET}" \
  "http://127.0.0.1:${PORT}/health" || echo 000)"

if [ "$HEALTH" = "200" ]; then
  echo "[setup] ✓ Agent healthy on port $PORT"
else
  echo "[setup] WARNING: /health returned $HEALTH — check: journalctl -u $SERVICE_NAME -f"
fi

cat << NEXT

Done. Now, in the app's environment (Vercel → Settings → Environment Variables):

  HOSTINGER_HOST_VPS_IP  = $(curl -4 -s --max-time 5 ifconfig.me || echo "<this server's public IPv4>")
  HOSTINGER_MGMT_SECRET  = ${MGMT_SECRET}
  VPS_ROOT_DOMAIN        = ${BASE_DOMAIN}$([ "$PORT" != "7854" ] && echo "
  VPS_AGENT_PORT         = ${PORT}")

And point a wildcard DNS A record at this server:

  *.${BASE_DOMAIN}  A  $(curl -4 -s --max-time 5 ifconfig.me || echo "<this server's public IPv4>")

Useful commands:
  systemctl status ${SERVICE_NAME}
  journalctl -u ${SERVICE_NAME} -f
NEXT
