#!/usr/bin/env sh
set -eu

REPO_URL="${SVEN_REPO_URL:-}"
SOURCE_ARCHIVE_URL="${SVEN_SOURCE_ARCHIVE_URL:-https://sven.systems/source/thesven-src.tar.gz}"
BRANCH="${SVEN_BRANCH:-main}"
INSTALL_DIR="${SVEN_INSTALL_DIR:-$HOME/.sven-src}"
GATEWAY_URL="${SVEN_GATEWAY_URL:-https://app.sven.systems}"
DRY_RUN="${SVEN_INSTALLER_DRY_RUN:-0}"
BOOTSTRAP="${SVEN_INSTALL_BOOTSTRAP:-0}"

CLI_INSTALLED="false"
SERVICES_INSTALLED="false"
STACK_HEALTHY="false"
BOOTSTRAP_REQUESTED="false"
BOOTSTRAP_EXECUTED="false"

emit_status() {
  printf 'INSTALL_STATUS_JSON={"cli_installed":%s,"services_installed":%s,"stack_healthy":%s,"bootstrap_requested":%s,"bootstrap_executed":%s}\n' \
    "$CLI_INSTALLED" "$SERVICES_INSTALLED" "$STACK_HEALTHY" "$BOOTSTRAP_REQUESTED" "$BOOTSTRAP_EXECUTED"
}

echo "==> Sven quick installer (Unix)"
if [ -n "$REPO_URL" ]; then
  echo "repo:    $REPO_URL"
else
  echo "archive: $SOURCE_ARCHIVE_URL"
fi
echo "branch:  $BRANCH"
echo "install: $INSTALL_DIR"
echo "dry-run: $DRY_RUN"
echo "bootstrap: $BOOTSTRAP"

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 2
  fi
}

need_cmd npm
need_cmd node

if [ -n "$REPO_URL" ]; then
  need_cmd git
else
  need_cmd curl
  need_cmd tar
fi

if [ "$DRY_RUN" = "1" ]; then
  echo "==> Dry-run mode enabled. Prerequisite checks passed."
  echo "==> Would clone/update repository and install Sven CLI globally."
  emit_status
  exit 0
fi

if [ -n "$REPO_URL" ]; then
  if [ ! -d "$INSTALL_DIR/.git" ]; then
    mkdir -p "$INSTALL_DIR"
    git clone --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
  else
    git -C "$INSTALL_DIR" fetch origin
    git -C "$INSTALL_DIR" checkout "$BRANCH"
    git -C "$INSTALL_DIR" pull --ff-only origin "$BRANCH"
  fi
else
  TMP_ARCHIVE="$(mktemp "${TMPDIR:-/tmp}/sven-src.XXXXXX.tar.gz")"
  trap 'rm -f "$TMP_ARCHIVE"' EXIT INT TERM
  rm -rf "$INSTALL_DIR"
  mkdir -p "$INSTALL_DIR"
  curl -fsSL "$SOURCE_ARCHIVE_URL" -o "$TMP_ARCHIVE"
  tar -xzf "$TMP_ARCHIVE" -C "$INSTALL_DIR"
fi

echo "==> Installing Sven CLI globally"
npm install -g "$INSTALL_DIR/packages/cli"

if command -v sven >/dev/null 2>&1; then
  CLI_INSTALLED="true"
  echo "==> Sven CLI installed: $(sven --version 2>/dev/null || echo ok)"
  echo "==> Suggested default gateway:"
  echo "    export SVEN_GATEWAY_URL=$GATEWAY_URL"
else
  echo "Install failed: 'sven' is not resolvable in PATH after install." >&2
  echo "Ensure npm global bin is on PATH, then re-run installer." >&2
  emit_status
  exit 3
fi

if [ "$BOOTSTRAP" = "1" ]; then
  BOOTSTRAP_REQUESTED="true"
  echo "==> Bootstrap requested: running 'sven install' and 'sven doctor'"
  if sven install; then
    SERVICES_INSTALLED="true"
    BOOTSTRAP_EXECUTED="true"
  else
    echo "Bootstrap failed: 'sven install' exited non-zero." >&2
    emit_status
    exit 4
  fi
  if sven doctor; then
    STACK_HEALTHY="true"
  else
    echo "Bootstrap failed: 'sven doctor' exited non-zero." >&2
    emit_status
    exit 5
  fi
fi

emit_status
