#!/usr/bin/env sh
set -eu
. "$(dirname "$0")/common.sh"
run_npm run test:parity-e2e:local

