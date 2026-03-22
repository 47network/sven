#!/usr/bin/env sh
set -eu

repo_root() {
  if command -v git >/dev/null 2>&1; then
    git rev-parse --show-toplevel
    return
  fi
  pwd
}

run_npm() {
  (cd "$(repo_root)" && npm "$@")
}
