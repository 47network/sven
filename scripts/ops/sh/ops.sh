#!/usr/bin/env sh
set -eu

DIR="$(cd "$(dirname "$0")" && pwd)"

usage() {
  cat <<'EOF'
Sven Ops Shell Dispatcher

Usage:
  sh scripts/ops/sh/ops.sh <group> <command> [args...]

Groups:
  release
    soak start|status|stop
    status
    post-verify
    verify-post-local
    gate
    versioning-check
    reproducibility-check
    artifacts-check
    rollout-check
    supply-chain-check
    env-secrets-check
    edge-network-check
    edge-network-continuous-check
    legacy-cleanup-check
    onboarding-check
    onboarding-day1-check
    client-env-check
    key-rotation-check
    gate-set <gate_name> <true|false>
    checklist-update

  qa
    lint|format|format-check|check-no-todo|typecheck|test|test-gateway|test-gateway-agents

  docker
    up|up-adapters|down|build

  dev
    gateway|runtime|admin|canvas|discord|slack|telegram|matrix|zalo|teams|google-chat|line|voice-call|whatsapp|signal|imessage|webchat|wake-word

  mobile
    start [auto|nvm|portable]
    preflight
    monitor-run
    securestore-check
    newarch-check
    release-device-validate [PowerShell args...]

  device
    confirm                  (uses env vars for MODE/GATEWAY_URL/USER_CODE/...)
    approve-db <code> <user_id>
    query-session <session_id>
    auto-approve-ui          (uses env vars for DEVICE_ID/MODE/...)

  ingress
    smoke-47matrix [install_host] [app_host]
    quickstart-publish [target_dir]
    quickstart-publish-smoke [target_dir] [install_host] [app_host]
    install-systemd-core [compose_workdir]

  list
EOF
}

if [ "$#" -lt 1 ]; then
  usage
  exit 2
fi

group="$1"
shift

case "$group" in
  release)
    if [ "$#" -lt 1 ]; then usage; exit 2; fi
    cmd="$1"; shift
    case "$cmd" in
      soak)
        if [ "$#" -lt 1 ]; then usage; exit 2; fi
        sub="$1"; shift
        case "$sub" in
          start) exec sh "$DIR/release-soak-start.sh" "$@" ;;
          status) exec sh "$DIR/release-soak-status.sh" "$@" ;;
          stop) exec sh "$DIR/release-soak-stop.sh" "$@" ;;
          *) usage; exit 2 ;;
        esac
        ;;
      status) exec sh "$DIR/release-status.sh" "$@" ;;
      post-verify) exec sh "$DIR/release-post-verify.sh" "$@" ;;
      verify-post-local) exec sh "$DIR/release-verify-post-local.sh" "$@" ;;
      gate) exec sh "$DIR/release-gate.sh" "$@" ;;
      versioning-check) exec sh "$DIR/release-versioning-check.sh" "$@" ;;
      reproducibility-check) exec sh "$DIR/release-reproducibility-check.sh" "$@" ;;
      artifacts-check) exec sh "$DIR/release-artifacts-check.sh" "$@" ;;
      rollout-check) exec sh "$DIR/release-rollout-check.sh" "$@" ;;
      supply-chain-check) exec sh "$DIR/release-supply-chain-check.sh" "$@" ;;
      env-secrets-check) exec sh "$DIR/release-env-secrets-check.sh" "$@" ;;
      edge-network-check) exec sh "$DIR/release-edge-network-check.sh" "$@" ;;
      edge-network-continuous-check) exec sh "$DIR/release-edge-network-continuous-check.sh" "$@" ;;
      legacy-cleanup-check) exec sh "$DIR/release-legacy-cleanup-check.sh" "$@" ;;
      onboarding-check) exec sh "$DIR/release-onboarding-check.sh" "$@" ;;
      onboarding-day1-check) exec sh "$DIR/release-onboarding-day1-check.sh" "$@" ;;
      client-env-check) exec sh "$DIR/release-client-env-check.sh" "$@" ;;
      key-rotation-check) exec sh "$DIR/release-key-rotation-check.sh" "$@" ;;
      gate-set) exec sh "$DIR/release-gate-set.sh" "$@" ;;
      checklist-update) exec sh "$DIR/release-checklist-update.sh" "$@" ;;
      *) usage; exit 2 ;;
    esac
    ;;

  qa)
    if [ "$#" -lt 1 ]; then usage; exit 2; fi
    cmd="$1"; shift
    case "$cmd" in
      lint) exec sh "$DIR/lint.sh" "$@" ;;
      format) exec sh "$DIR/format.sh" "$@" ;;
      format-check) exec sh "$DIR/format-check.sh" "$@" ;;
      check-no-todo) exec sh "$DIR/check-no-todo.sh" "$@" ;;
      typecheck) exec sh "$DIR/typecheck.sh" "$@" ;;
      test) exec sh "$DIR/test.sh" "$@" ;;
      test-gateway) exec sh "$DIR/test-gateway.sh" "$@" ;;
      test-gateway-agents) exec sh "$DIR/test-gateway-agents.sh" "$@" ;;
      *) usage; exit 2 ;;
    esac
    ;;

  docker)
    if [ "$#" -lt 1 ]; then usage; exit 2; fi
    cmd="$1"; shift
    case "$cmd" in
      up) exec sh "$DIR/docker-up.sh" "$@" ;;
      up-adapters) exec sh "$DIR/docker-up-adapters.sh" "$@" ;;
      down) exec sh "$DIR/docker-down.sh" "$@" ;;
      build) exec sh "$DIR/docker-build.sh" "$@" ;;
      *) usage; exit 2 ;;
    esac
    ;;

  dev)
    if [ "$#" -lt 1 ]; then usage; exit 2; fi
    service="$1"; shift
    case "$service" in
      gateway|runtime|admin|canvas|discord|slack|telegram|matrix|zalo|teams|google-chat|line|voice-call|whatsapp|signal|imessage|webchat|wake-word)
        exec sh "$DIR/dev-$service.sh" "$@"
        ;;
      *)
        usage
        exit 2
        ;;
    esac
    ;;

  mobile)
    if [ "$#" -lt 1 ]; then usage; exit 2; fi
    cmd="$1"; shift
    case "$cmd" in
      start)
        mode="${1:-auto}"
        NODE_MODE="$mode" exec sh "$DIR/mobile-start-expo.sh"
        ;;
      preflight)
        exec sh "$DIR/mobile-preflight.sh" "$@"
        ;;
      monitor-run)
        exec sh "$DIR/ops-expo-monitor-run.sh" "$@"
        ;;
      securestore-check)
        exec sh "$DIR/mobile-securestore-check.sh" "$@"
        ;;
      newarch-check)
        exec sh "$DIR/mobile-newarch-check.sh" "$@"
        ;;
      release-device-validate)
        exec sh "$DIR/mobile-release-device-validate.sh" "$@"
        ;;
      *)
        usage
        exit 2
        ;;
    esac
    ;;

  device)
    if [ "$#" -lt 1 ]; then usage; exit 2; fi
    cmd="$1"; shift
    case "$cmd" in
      confirm)
        exec sh "$DIR/device-confirm.sh" "$@"
        ;;
      approve-db)
        if [ "$#" -ne 2 ]; then usage; exit 2; fi
        exec sh "$DIR/device-approve-db.sh" "$1" "$2"
        ;;
      query-session)
        if [ "$#" -ne 1 ]; then usage; exit 2; fi
        exec sh "$DIR/device-query-session.sh" "$1"
        ;;
      auto-approve-ui)
        exec sh "$DIR/device-auto-approve-ui.sh" "$@"
        ;;
      *)
        usage
        exit 2
        ;;
    esac
    ;;

  ingress)
    if [ "$#" -lt 1 ]; then usage; exit 2; fi
    cmd="$1"; shift
    case "$cmd" in
      smoke-47matrix)
        exec sh "$DIR/smoke-47matrix-domains.sh" "$@"
        ;;
      quickstart-publish)
        exec sh "$DIR/publish-quickstart.sh" "$@"
        ;;
      quickstart-publish-smoke)
        exec sh "$DIR/quickstart-publish-and-smoke.sh" "$@"
        ;;
      install-systemd-core)
        exec sh "$DIR/install-systemd-compose-core.sh" "$@"
        ;;
      *)
        usage
        exit 2
        ;;
    esac
    ;;

  list)
    exec sh "$DIR/list.sh"
    ;;

  *)
    usage
    exit 2
    ;;
esac
