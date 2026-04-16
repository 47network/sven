#!/usr/bin/env sh
set -eu

DIR="$(cd "$(dirname "$0")" && pwd)"
find "$DIR" -maxdepth 1 -name '*.sh' -exec basename {} \; | sort
