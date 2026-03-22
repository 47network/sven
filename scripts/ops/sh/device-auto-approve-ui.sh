#!/usr/bin/env sh
set -eu

DEVICE_ID="${DEVICE_ID:-R58N94KML7J}"
MODE="${MODE:-db}" # db | login
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

adb -s "$DEVICE_ID" logcat -c
sleep 1
adb -s "$DEVICE_ID" shell input tap 540 597
sleep 1
adb -s "$DEVICE_ID" shell input tap 540 405
sleep 2
adb -s "$DEVICE_ID" shell uiautomator dump /sdcard/ui_auto.xml >/dev/null
adb -s "$DEVICE_ID" pull /sdcard/ui_auto.xml "$ROOT/ui_auto.xml" >/dev/null

USER_CODE="$(sed -nE "s/.*Code:[[:space:]]*([A-Z0-9]{4}-[A-Z0-9]{4}).*/\\1/p" "$ROOT/ui_auto.xml" | head -n 1)"
if [ -z "$USER_CODE" ]; then
  echo "No user code found in ui_auto.xml" >&2
  exit 1
fi
echo "Found user code: $USER_CODE"

if [ "$MODE" = "login" ]; then
  USER_CODE="$USER_CODE" sh "$(dirname "$0")/device-confirm.sh"
  exit 0
fi

USER_ID="${USER_ID:-019c44b0-66b9-7227-9c6a-7ebdc33ba940}"
sh "$(dirname "$0")/device-approve-db.sh" "$USER_CODE" "$USER_ID"
