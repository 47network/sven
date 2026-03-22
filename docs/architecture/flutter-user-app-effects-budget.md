# Flutter User App Effects Budget

Date: 2026-02-16
Scope: Cinematic + Classic UI effects guardrails for Flutter mobile + web.

## Goals

- Keep GPU/CPU costs predictable for both modes.
- Provide explicit fallbacks when motion is reduced or disabled.
- Avoid stacking expensive effects on large surfaces.

## Budget by Effect Type

- Blur/glass: 1 major surface per screen (full motion only).
- Shadows/glow: 1-2 layered shadows per card/panel.
- Particles: none in baseline screens (reserved for future gated use).
- Animated gradients: allowed only for small headers or hero cards.

## Fallback Rules

- Motion level `reduced`: disable blur, keep light shadows.
- Motion level `off`: disable blur and decorative shadows.
- Reduce transparency for text-heavy panels to keep contrast high.

## Verification Checklist

- No full-screen blur layers.
- Text contrast remains readable in bright and dark ambient settings.
- Performance remains stable on reference devices and web builds.
