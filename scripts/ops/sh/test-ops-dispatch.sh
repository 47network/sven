#!/usr/bin/env sh
set -eu

DIR="$(cd "$(dirname "$0")" && pwd)"

# Basic router smoke tests: verify command parsing and representative routes.
sh "$DIR/ops.sh" list >/dev/null
sh "$DIR/ops.sh" release status >/dev/null
sh "$DIR/ops.sh" qa check-no-todo >/dev/null

# Unknown route should fail.
if sh "$DIR/ops.sh" does-not-exist >/dev/null 2>&1; then
  echo "ops.sh accepted invalid route unexpectedly" >&2
  exit 1
fi

echo "ops.sh dispatch smoke test passed."
