#!/usr/bin/env sh
set -eu

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SERVICE_NAME="sven-compose-core.service"
SRC="$ROOT/config/systemd/$SERVICE_NAME"
DST="/etc/systemd/system/$SERVICE_NAME"
WORKDIR_DEFAULT="/opt/sven/app"
WORKDIR="${1:-$WORKDIR_DEFAULT}"

if [ ! -f "$SRC" ]; then
  echo "Missing unit template: $SRC"
  exit 1
fi

# Avoid hanging in non-interactive sessions when sudo needs a password.
if ! sudo -n true >/dev/null 2>&1 && [ ! -t 0 ]; then
  echo "sudo password is required. Run this script in an interactive terminal."
  exit 1
fi

echo "Installing $SERVICE_NAME to $DST"
sudo install -m 0644 "$SRC" "$DST"

echo "Setting compose working dir to: $WORKDIR"
sudo sed -i "s#^WorkingDirectory=.*#WorkingDirectory=$WORKDIR#g" "$DST"

echo "Reloading systemd daemon and enabling service..."
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"
sudo systemctl restart "$SERVICE_NAME"

echo "Service status:"
sudo systemctl --no-pager --full status "$SERVICE_NAME" || true

echo "Done."
