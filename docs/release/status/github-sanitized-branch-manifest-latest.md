# GitHub Sanitized Publish Branch Manifest

Generated: 2026-03-16T06:31:00Z
Base: origin/thesven @ 0a8b24b918e2c816e43803d91a7f25ea688ba85f
Branch: release/clean-publish-2026-03-16

## Scope
This branch is a sanitized publish surface intended for external repository visibility.

## Removed From Publish Surface
- archive/**
- docs/examples/**

## Rationale
- Remove development/archive artifacts and competitor snapshot mirrors from the public runtime codebase.
- Keep core product/application/deployment/docs code paths intact.

## Impact Summary
- 7,678 tracked files removed
- 1,332,094 lines removed
