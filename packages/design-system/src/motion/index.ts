/**
 * Motion & animation system — easing curves, duration intelligence,
 * spring physics, animation composition.
 *
 * Generates CSS animations and transitions with proper timing, easing,
 * and accessibility (prefers-reduced-motion fallbacks).
 */

// ──── Types ──────────────────────────────────────────────────────

export interface EasingPreset {
  name: string;
  cubicBezier: string;
  description: string;
  category: 'standard' | 'entrance' | 'exit' | 'emphasis' | 'spring';
}

export interface SpringConfig {
  mass: number;
  stiffness: number;
  damping: number;
}

export interface SpringKeyframes {
  config: SpringConfig;
  keyframes: { offset: number; value: number }[];
  duration: number;
  cssKeyframes: string;
}

export interface AnimationSpec {
  name: string;
  keyframes: string;
  duration: string;
  easing: string;
  fillMode: string;
  reducedMotionFallback: string;
}

export type AnimationIntent =
  | 'enter'
  | 'exit'
  | 'fade-in'
  | 'fade-out'
  | 'slide-up'
  | 'slide-down'
  | 'slide-left'
  | 'slide-right'
  | 'scale-up'
  | 'scale-down'
  | 'attention'
  | 'loading';

export type ElementCategory = 'micro' | 'small' | 'medium' | 'large' | 'page';

// ──── Easing Presets ─────────────────────────────────────────────

export const EASING_PRESETS: EasingPreset[] = [
  // Standard
  { name: 'ease', cubicBezier: 'cubic-bezier(0.25, 0.1, 0.25, 1.0)', description: 'Default ease', category: 'standard' },
  { name: 'ease-in', cubicBezier: 'cubic-bezier(0.42, 0, 1, 1)', description: 'Accelerating from zero', category: 'standard' },
  { name: 'ease-out', cubicBezier: 'cubic-bezier(0, 0, 0.58, 1)', description: 'Decelerating to zero', category: 'standard' },
  { name: 'ease-in-out', cubicBezier: 'cubic-bezier(0.42, 0, 0.58, 1)', description: 'Symmetric acceleration', category: 'standard' },
  { name: 'linear', cubicBezier: 'linear', description: 'Constant speed', category: 'standard' },

  // Entrance
  { name: 'enter-smooth', cubicBezier: 'cubic-bezier(0, 0, 0.2, 1)', description: 'Smooth deceleration for entering elements', category: 'entrance' },
  { name: 'enter-expressive', cubicBezier: 'cubic-bezier(0.0, 0.0, 0.15, 1.0)', description: 'Expressive entrance with sharp deceleration', category: 'entrance' },
  { name: 'enter-overshoot', cubicBezier: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)', description: 'Entrance with slight overshoot', category: 'entrance' },

  // Exit
  { name: 'exit-smooth', cubicBezier: 'cubic-bezier(0.4, 0, 1, 1)', description: 'Smooth acceleration for exiting elements', category: 'exit' },
  { name: 'exit-sharp', cubicBezier: 'cubic-bezier(0.4, 0, 0.6, 1)', description: 'Sharp exit', category: 'exit' },

  // Emphasis / Attention
  { name: 'bounce', cubicBezier: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)', description: 'Bouncy overshoot effect', category: 'emphasis' },
  { name: 'elastic', cubicBezier: 'cubic-bezier(0.68, -0.6, 0.32, 1.6)', description: 'Elastic snap effect', category: 'emphasis' },
  { name: 'snap', cubicBezier: 'cubic-bezier(0.2, 0, 0, 1)', description: 'Quick snap into place', category: 'emphasis' },

  // Spring-like (approximated as cubic-bezier)
  { name: 'spring-gentle', cubicBezier: 'cubic-bezier(0.2, 0.8, 0.2, 1)', description: 'Gentle spring (low stiffness)', category: 'spring' },
  { name: 'spring-default', cubicBezier: 'cubic-bezier(0.175, 0.885, 0.32, 1.1)', description: 'Default spring motion', category: 'spring' },
  { name: 'spring-snappy', cubicBezier: 'cubic-bezier(0.3, 1.3, 0.3, 1)', description: 'Snappy spring (high stiffness)', category: 'spring' },
  { name: 'spring-wobbly', cubicBezier: 'cubic-bezier(0.175, 0.885, 0.32, 1.5)', description: 'Wobbly spring (low damping)', category: 'spring' },

  // Material Design inspired
  { name: 'md-standard', cubicBezier: 'cubic-bezier(0.2, 0, 0, 1)', description: 'Material Design 3 standard', category: 'standard' },
  { name: 'md-emphasized', cubicBezier: 'cubic-bezier(0.05, 0.7, 0.1, 1.0)', description: 'Material Design 3 emphasized', category: 'emphasis' },
  { name: 'md-decelerated', cubicBezier: 'cubic-bezier(0, 0, 0, 1)', description: 'Material Design 3 decelerated', category: 'entrance' },
  { name: 'md-accelerated', cubicBezier: 'cubic-bezier(0.3, 0, 1, 1)', description: 'Material Design 3 accelerated', category: 'exit' },
];

/** Get an easing preset by name. */
export function getEasing(name: string): EasingPreset | undefined {
  return EASING_PRESETS.find((p) => p.name === name);
}

/** Get all easing presets in a category. */
export function getEasingsByCategory(category: EasingPreset['category']): EasingPreset[] {
  return EASING_PRESETS.filter((p) => p.category === category);
}

// ──── Duration Intelligence ──────────────────────────────────────

const DURATION_MAP: Record<ElementCategory, { min: number; typical: number; max: number }> = {
  micro:  { min: 50,  typical: 100,  max: 200 },   // Toggles, checkboxes, small feedback
  small:  { min: 100, typical: 150,  max: 250 },   // Buttons, tooltips, hovers
  medium: { min: 200, typical: 300,  max: 450 },   // Cards, panels, dropdowns
  large:  { min: 300, typical: 450,  max: 600 },   // Modals, drawers, sheets
  page:   { min: 400, typical: 600,  max: 800 },   // Page transitions, route changes
};

/** Recommend an animation duration based on element category. */
export function recommendDuration(category: ElementCategory): { min: number; typical: number; max: number; css: string } {
  const d = DURATION_MAP[category];
  return { ...d, css: `${d.typical}ms` };
}

/** Generate all duration tokens as CSS custom properties. */
export function durationTokensToCSS(): string {
  const lines = [':root {'];
  for (const [category, timing] of Object.entries(DURATION_MAP)) {
    lines.push(`  --duration-${category}: ${timing.typical}ms;`);
    lines.push(`  --duration-${category}-min: ${timing.min}ms;`);
    lines.push(`  --duration-${category}-max: ${timing.max}ms;`);
  }
  lines.push('}');
  return lines.join('\n');
}

// ──── Spring Physics ─────────────────────────────────────────────

const SPRING_PRESETS: Record<string, SpringConfig> = {
  gentle:  { mass: 1.0, stiffness: 120, damping: 14 },
  default: { mass: 1.0, stiffness: 180, damping: 12 },
  snappy:  { mass: 0.8, stiffness: 300, damping: 20 },
  wobbly:  { mass: 1.0, stiffness: 180, damping: 8 },
  stiff:   { mass: 0.5, stiffness: 400, damping: 30 },
  slow:    { mass: 2.0, stiffness: 100, damping: 20 },
};

/** Get a named spring configuration. */
export function getSpringPreset(name: string): SpringConfig | undefined {
  return SPRING_PRESETS[name];
}

/** Simulate a spring and return CSS @keyframes. */
export function simulateSpring(config: SpringConfig, fromValue: number = 0, toValue: number = 1, steps: number = 60): SpringKeyframes {
  const { mass, stiffness, damping } = config;
  const keyframes: { offset: number; value: number }[] = [];

  let position = fromValue;
  let velocity = 0;
  const dt = 1 / 60; // 60fps time step
  const threshold = 0.001;
  let settled = false;
  let frameCount = 0;
  const maxFrames = steps * 4;

  while (!settled && frameCount < maxFrames) {
    const springForce = -stiffness * (position - toValue);
    const dampingForce = -damping * velocity;
    const acceleration = (springForce + dampingForce) / mass;

    velocity += acceleration * dt;
    position += velocity * dt;
    frameCount++;

    if (frameCount % 2 === 0) {
      keyframes.push({ offset: frameCount, value: position });
    }

    if (Math.abs(position - toValue) < threshold && Math.abs(velocity) < threshold) {
      settled = true;
    }
  }

  // Normalize offsets to 0–1
  const maxOffset = keyframes.length > 0 ? keyframes[keyframes.length - 1].offset : 1;
  for (const kf of keyframes) {
    kf.offset = kf.offset / maxOffset;
  }
  keyframes.push({ offset: 1, value: toValue });

  const duration = Math.round((frameCount / 60) * 1000);

  // Generate CSS @keyframes
  const cssLines = ['@keyframes spring-animation {'];
  for (const kf of keyframes) {
    const pct = Math.round(kf.offset * 100);
    const scale = kf.value;
    cssLines.push(`  ${pct}% { transform: scale(${scale.toFixed(4)}); }`);
  }
  cssLines.push('}');

  return { config, keyframes, duration, cssKeyframes: cssLines.join('\n') };
}

// ──── Animation Composition ──────────────────────────────────────

function buildKeyframes(intent: AnimationIntent): { name: string; css: string } {
  switch (intent) {
    case 'enter':
    case 'fade-in':
      return {
        name: 'sven-fade-in',
        css: '@keyframes sven-fade-in {\n  from { opacity: 0; }\n  to { opacity: 1; }\n}',
      };
    case 'exit':
    case 'fade-out':
      return {
        name: 'sven-fade-out',
        css: '@keyframes sven-fade-out {\n  from { opacity: 1; }\n  to { opacity: 0; }\n}',
      };
    case 'slide-up':
      return {
        name: 'sven-slide-up',
        css: '@keyframes sven-slide-up {\n  from { opacity: 0; transform: translateY(16px); }\n  to { opacity: 1; transform: translateY(0); }\n}',
      };
    case 'slide-down':
      return {
        name: 'sven-slide-down',
        css: '@keyframes sven-slide-down {\n  from { opacity: 0; transform: translateY(-16px); }\n  to { opacity: 1; transform: translateY(0); }\n}',
      };
    case 'slide-left':
      return {
        name: 'sven-slide-left',
        css: '@keyframes sven-slide-left {\n  from { opacity: 0; transform: translateX(16px); }\n  to { opacity: 1; transform: translateX(0); }\n}',
      };
    case 'slide-right':
      return {
        name: 'sven-slide-right',
        css: '@keyframes sven-slide-right {\n  from { opacity: 0; transform: translateX(-16px); }\n  to { opacity: 1; transform: translateX(0); }\n}',
      };
    case 'scale-up':
      return {
        name: 'sven-scale-up',
        css: '@keyframes sven-scale-up {\n  from { opacity: 0; transform: scale(0.95); }\n  to { opacity: 1; transform: scale(1); }\n}',
      };
    case 'scale-down':
      return {
        name: 'sven-scale-down',
        css: '@keyframes sven-scale-down {\n  from { opacity: 1; transform: scale(1); }\n  to { opacity: 0; transform: scale(0.95); }\n}',
      };
    case 'attention':
      return {
        name: 'sven-attention',
        css: '@keyframes sven-attention {\n  0%, 100% { transform: scale(1); }\n  25% { transform: scale(1.05); }\n  50% { transform: scale(0.98); }\n  75% { transform: scale(1.02); }\n}',
      };
    case 'loading':
      return {
        name: 'sven-loading',
        css: '@keyframes sven-loading {\n  0% { opacity: 0.4; }\n  50% { opacity: 1; }\n  100% { opacity: 0.4; }\n}',
      };
    default:
      throw new Error(`Unknown animation intent: ${intent}`);
  }
}

const EXIT_INTENTS = new Set<AnimationIntent>(['exit', 'fade-out', 'scale-down']);

/** Compose a full animation spec from intent and element category. */
export function composeAnimation(intent: AnimationIntent, category: ElementCategory = 'medium'): AnimationSpec {
  const { name, css } = buildKeyframes(intent);
  const duration = recommendDuration(category);
  const isExit = EXIT_INTENTS.has(intent);
  const easing = isExit ? 'cubic-bezier(0.4, 0, 1, 1)' : 'cubic-bezier(0, 0, 0.2, 1)';
  const fillMode = isExit ? 'forwards' : 'both';

  // Reduced motion fallback: instant opacity change
  const reducedMotionFallback = [
    '@media (prefers-reduced-motion: reduce) {',
    `  .${name} {`,
    `    animation: none;`,
    isExit ? '    opacity: 0;' : '    opacity: 1;',
    '  }',
    '}',
  ].join('\n');

  return {
    name,
    keyframes: css,
    duration: duration.css,
    easing,
    fillMode,
    reducedMotionFallback,
  };
}

/** Generate a stagger pattern for a list of elements. */
export function generateStagger(
  count: number,
  intent: AnimationIntent = 'slide-up',
  category: ElementCategory = 'medium',
  staggerMs: number = 50,
): string {
  const anim = composeAnimation(intent, category);
  const lines: string[] = [anim.keyframes, ''];

  for (let i = 0; i < count; i++) {
    lines.push(`.stagger-item:nth-child(${i + 1}) {`);
    lines.push(`  animation: ${anim.name} ${anim.duration} ${anim.easing} ${staggerMs * i}ms ${anim.fillMode};`);
    lines.push('}');
  }

  lines.push('');
  lines.push(anim.reducedMotionFallback);

  return lines.join('\n');
}

/** Export all easing presets as CSS custom properties. */
export function easingTokensToCSS(): string {
  const lines = [':root {'];
  for (const preset of EASING_PRESETS) {
    const varName = `--ease-${preset.name}`;
    lines.push(`  ${varName}: ${preset.cubicBezier};`);
  }
  lines.push('}');
  return lines.join('\n');
}
