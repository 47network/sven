# Mobile Release Signing Evidence

Date: 2026-02-15
Release: RC

## Android Signing
keystore alias: sven-release
artifact path: apps/companion-mobile/android/app/build/outputs/apk/release/app-release.apk
signature verification command: apksigner verify --print-certs app-release.apk
verification output summary: Verified signer CN=47network, SHA256 digest validated

## iOS Signing
signing identity: Apple Distribution: 47network
provisioning profile: SvenProdProfile
artifact path: apps/companion-mobile/ios/build/Sven.ipa
verification command: codesign -dv --verbose=4 Sven.app
verification output summary: Code signature valid, TeamIdentifier verified

## Approval
Engineering: approved:hantz
Security: approved:hantz
Release owner: approved:hantz
