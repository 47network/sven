#!/usr/bin/env sh
set -eu
. "$(dirname "$0")/common.sh"
run_npm run release:onboarding:day1:check
