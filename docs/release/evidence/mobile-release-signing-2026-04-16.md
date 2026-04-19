# Mobile Release Signing Evidence

Date: 2026-04-16
Release: v0.2.1-rc

## Android Signing
keystore alias: sven-release
artifact path: apps/companion-user-flutter/build/app/outputs/apk/dev/debug/app-dev-debug.apk
signature verification command: apksigner verify --print-certs app-debug.apk
verification output summary: Debug build signed with Android debug keystore; release signing via CI pipeline

## iOS Signing
signing identity: Apple Distribution: 47network
provisioning profile: SvenProdProfile
artifact path: apps/companion-user-flutter/ios/build/Sven.ipa
verification command: codesign -dv --verbose=4 Sven.app
verification output summary: iOS build deferred — no macOS build host available; CI pipeline handles release signing
status: deferred

## Approval
Engineering: approved:hantz
Security: approved:hantz
Release owner: approved:hantz
