#!/usr/bin/env sh
set -eu

if [ $# -ne 2 ]; then
  echo "usage: release-gate-set.sh <gate_name> <true|false>" >&2
  exit 2
fi

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"
npm run release:gate:set -- "$1" "$2"
