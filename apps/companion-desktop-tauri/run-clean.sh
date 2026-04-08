#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TAURI_DIR="$ROOT_DIR/src-tauri"
BINARY="$TAURI_DIR/target/debug/sven-companion-desktop-tauri"

if [[ ! -x "$BINARY" ]]; then
  echo "Desktop binary not found at $BINARY"
  echo "Build it first:"
  echo "  cd $TAURI_DIR && cargo build"
  exit 1
fi

DISPLAY_VALUE="${DISPLAY:-:0}"
XAUTHORITY_VALUE="${XAUTHORITY:-$HOME/.Xauthority}"
DBUS_VALUE="${DBUS_SESSION_BUS_ADDRESS:-}"
XDG_RUNTIME_VALUE="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"

# Snap-hosted shells can leak incompatible GTK/glibc paths into the Tauri
# process. Launch with a clean host environment so Sven uses system GTK/WebKit.
exec env -i \
  HOME="$HOME" \
  USER="${USER:-$(id -un)}" \
  LOGNAME="${LOGNAME:-${USER:-$(id -un)}}" \
  SHELL="${SHELL:-/bin/bash}" \
  DISPLAY="$DISPLAY_VALUE" \
  XAUTHORITY="$XAUTHORITY_VALUE" \
  DBUS_SESSION_BUS_ADDRESS="$DBUS_VALUE" \
  XDG_RUNTIME_DIR="$XDG_RUNTIME_VALUE" \
  PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
  "$BINARY"
