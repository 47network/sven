#!/usr/bin/env sh
set -eu

DIR="$(cd "$(dirname "$0")" && pwd)"
ls -1 "$DIR"/*.sh | sed 's#.*/##' | sort
