#!/usr/bin/env sh
set -eu

DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Running sh syntax checks..."
for f in "$DIR"/*.sh; do
  sh -n "$f"
done

if command -v shellcheck >/dev/null 2>&1; then
  echo "Running shellcheck..."
  shellcheck -x "$DIR"/*.sh
else
  echo "shellcheck not found; skipping shellcheck step."
fi

echo "Running ops dispatcher smoke tests..."
sh "$DIR/test-ops-dispatch.sh"

echo "Running quickstart installer smoke tests..."
sh "$DIR/test-quickstart-installers.sh"

echo "Shell ops checks passed."
