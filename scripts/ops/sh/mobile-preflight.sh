#!/usr/bin/env sh
set -eu
. "$(dirname "$0")/common.sh"
ROOT="$(repo_root)"
cd "$ROOT"

if command -v powershell >/dev/null 2>&1; then
  powershell -ExecutionPolicy Bypass -File scripts/ops/mobile/mobile-preflight.ps1
  exit 0
fi

if command -v powershell.exe >/dev/null 2>&1; then
  powershell.exe -ExecutionPolicy Bypass -File scripts/ops/mobile/mobile-preflight.ps1
  exit 0
fi

echo "Neither powershell nor powershell.exe found in PATH." >&2
exit 2
