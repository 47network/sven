/**
 * Layout & spacing system — spacing scales, grid generation,
 * breakpoint strategies, z-index management.
 *
 * Generates CSS for grid systems, spacing tokens, and responsive
 * breakpoint utilities.
 */

// ──── Types ──────────────────────────────────────────────────────

export type SpacingScaleMethod = 'linear' | 'geometric' | 'modular';

export interface SpacingScale {
  method: SpacingScaleMethod;
  basePx: number;
  steps: SpacingStep[];
}

export interface SpacingStep {
  name: string;
  valuePx: number;
  valueRem: number;
}

export interface GridConfig {
  columns: number;
  gapPx: number;
  maxWidthPx: number;
  /** CSS output */
  css: string;
}

export type BreakpointStrategy = 'mobile-first' | 'desktop-first';

export interface Breakpoint {
  name: string;
  minPx: number;
  maxPx: number | null;
}

export interface BreakpointSet {
  strategy: BreakpointStrategy;
  breakpoints: Breakpoint[];
  css: string;
}

export interface ZIndexLayer {
  name: string;
  value: number;
}

export interface LayoutPattern {
  name: string;
  description: string;
  css: string;
}

// ──── Spacing Scale ──────────────────────────────────────────────

const SPACING_STEP_NAMES = ['0', 'px', '0.5', '1', '1.5', '2', '2.5', '3', '4', '5', '6', '8', '10', '12', '16', '20', '24'];

/** Generate a spacing scale. */
export function generateSpacingScale(basePx: number = 4, method: SpacingScaleMethod = 'linear'): SpacingScale {
  let steps: SpacingStep[];

  switch (method) {
    case 'linear': {
      const multipliers = [0, 1, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96];
      steps = multipliers.map((m, i) => {
        const valuePx = basePx * (m / 4);
        return {
          name: SPACING_STEP_NAMES[i] ?? `${m}`,
          valuePx,
          valueRem: Math.round((valuePx / 16) * 1000) / 1000,
        };
      });
      break;
    }

    case 'geometric': {
      const ratio = 1.5;
      steps = [];
      for (let i = 0; i < 12; i++) {
        const valuePx = Math.round(basePx * Math.pow(ratio, i));
        steps.push({
          name: `${i}`,
          valuePx,
          valueRem: Math.round((valuePx / 16) * 1000) / 1000,
        });
      }
      break;
    }

    case 'modular': {
      const ratio = 1.618; // Golden ratio
      steps = [];
      for (let i = 0; i < 12; i++) {
        const valuePx = Math.round(basePx * Math.pow(ratio, i - 2));
        steps.push({
          name: `${i}`,
          valuePx: Math.max(0, valuePx),
          valueRem: Math.round((Math.max(0, valuePx) / 16) * 1000) / 1000,
        });
      }
      break;
    }

    default:
      throw new Error(`Unknown spacing scale method: ${method}`);
  }

  return { method, basePx, steps };
}

/** Export spacing scale as CSS custom properties. */
export function spacingScaleToCSS(scale: SpacingScale): string {
  const lines = [':root {'];
  for (const step of scale.steps) {
    lines.push(`  --space-${step.name}: ${step.valueRem}rem; /* ${step.valuePx}px */`);
  }
  lines.push('}');
  return lines.join('\n');
}

// ──── Grid System ────────────────────────────────────────────────

/** Generate a CSS Grid layout. */
export function generateGrid(columns: number = 12, gapPx: number = 16, maxWidthPx: number = 1280): GridConfig {
  const gapRem = gapPx / 16;
  const maxWidthRem = maxWidthPx / 16;

  const css = [
    '.grid-container {',
    `  display: grid;`,
    `  grid-template-columns: repeat(${columns}, 1fr);`,
    `  gap: ${gapRem}rem;`,
    `  max-width: ${maxWidthRem}rem;`,
    `  margin-inline: auto;`,
    `  padding-inline: ${gapRem}rem;`,
    '}',
    '',
    '/* Responsive: stack on small screens */',
    '@media (max-width: 640px) {',
    '  .grid-container {',
    '    grid-template-columns: 1fr;',
    '  }',
    '}',
    '',
    '@media (min-width: 641px) and (max-width: 1024px) {',
    '  .grid-container {',
    `    grid-template-columns: repeat(${Math.min(columns, 6)}, 1fr);`,
    '  }',
    '}',
    '',
    '/* Column span utilities */',
    ...Array.from({ length: columns }, (_, i) => {
      const span = i + 1;
      return `.col-span-${span} { grid-column: span ${span}; }`;
    }),
  ].join('\n');

  return { columns, gapPx, maxWidthPx, css };
}

/** Generate CSS auto-fit grid for card layouts. */
export function generateAutoFitGrid(minItemWidthPx: number = 280, gapPx: number = 16): string {
  const gapRem = gapPx / 16;
  const minWidthRem = minItemWidthPx / 16;

  return [
    '.auto-grid {',
    `  display: grid;`,
    `  grid-template-columns: repeat(auto-fit, minmax(${minWidthRem}rem, 1fr));`,
    `  gap: ${gapRem}rem;`,
    '}',
  ].join('\n');
}

// ──── Breakpoints ────────────────────────────────────────────────

const DEFAULT_BREAKPOINTS: Breakpoint[] = [
  { name: 'sm', minPx: 640, maxPx: 767 },
  { name: 'md', minPx: 768, maxPx: 1023 },
  { name: 'lg', minPx: 1024, maxPx: 1279 },
  { name: 'xl', minPx: 1280, maxPx: 1535 },
  { name: '2xl', minPx: 1536, maxPx: null },
];

/** Generate responsive breakpoint media queries. */
export function generateBreakpoints(
  strategy: BreakpointStrategy = 'mobile-first',
  breakpoints: Breakpoint[] = DEFAULT_BREAKPOINTS,
): BreakpointSet {
  const lines: string[] = [];

  if (strategy === 'mobile-first') {
    for (const bp of breakpoints) {
      lines.push(`/* ${bp.name}: ${bp.minPx}px${bp.maxPx ? ` – ${bp.maxPx}px` : '+'} */`);
      lines.push(`@media (min-width: ${bp.minPx}px) { /* ${bp.name} styles */ }`);
      lines.push('');
    }
  } else {
    for (const bp of [...breakpoints].reverse()) {
      const maxPx = bp.maxPx ?? 9999;
      lines.push(`/* ${bp.name}: up to ${maxPx}px */`);
      lines.push(`@media (max-width: ${maxPx}px) { /* ${bp.name} styles */ }`);
      lines.push('');
    }
  }

  return { strategy, breakpoints, css: lines.join('\n') };
}

/** Generate container query wrappers. */
export function generateContainerQueries(): string {
  return [
    '/* Container query setup */',
    '.container-query { container-type: inline-size; }',
    '',
    '@container (min-width: 400px) {',
    '  /* Styles for containers wider than 400px */',
    '}',
    '',
    '@container (min-width: 700px) {',
    '  /* Styles for containers wider than 700px */',
    '}',
  ].join('\n');
}

// ──── Z-Index Management ─────────────────────────────────────────

const Z_INDEX_LAYERS: ZIndexLayer[] = [
  { name: 'base', value: 0 },
  { name: 'raised', value: 1 },
  { name: 'dropdown', value: 10 },
  { name: 'sticky', value: 20 },
  { name: 'banner', value: 30 },
  { name: 'overlay', value: 40 },
  { name: 'modal', value: 50 },
  { name: 'popover', value: 60 },
  { name: 'toast', value: 70 },
  { name: 'tooltip', value: 80 },
  { name: 'max', value: 9999 },
];

/** Get the z-index layers. */
export function getZIndexLayers(): ZIndexLayer[] {
  return [...Z_INDEX_LAYERS];
}

/** Export z-index layers as CSS custom properties. */
export function zIndexToCSS(): string {
  const lines = [':root {'];
  for (const layer of Z_INDEX_LAYERS) {
    lines.push(`  --z-${layer.name}: ${layer.value};`);
  }
  lines.push('}');
  return lines.join('\n');
}

// ──── Layout Patterns ────────────────────────────────────────────

function getHolyGrailPattern(): LayoutPattern {
  return {
    name: 'holy-grail',
    description: 'Header, sidebar, main content, sidebar, footer',
    css: [
      '.holy-grail {',
      '  display: grid;',
      '  grid-template: "header header header" auto',
      '                 "nav main aside" 1fr',
      '                 "footer footer footer" auto',
      '                 / 200px 1fr 200px;',
      '  min-height: 100dvh;',
      '}',
      '.holy-grail > header { grid-area: header; }',
      '.holy-grail > nav { grid-area: nav; }',
      '.holy-grail > main { grid-area: main; }',
      '.holy-grail > aside { grid-area: aside; }',
      '.holy-grail > footer { grid-area: footer; }',
    ].join('\n'),
  };
}

function getSidebarContentPattern(): LayoutPattern {
  return {
    name: 'sidebar-content',
    description: 'Fixed sidebar with scrolling main content',
    css: [
      '.sidebar-layout {',
      '  display: grid;',
      '  grid-template-columns: 280px 1fr;',
      '  min-height: 100dvh;',
      '}',
      '.sidebar-layout > .sidebar {',
      '  position: sticky;',
      '  top: 0;',
      '  height: 100dvh;',
      '  overflow-y: auto;',
      '}',
    ].join('\n'),
  };
}

function getCardGridPattern(): LayoutPattern {
  return {
    name: 'card-grid',
    description: 'Responsive card grid with auto-fit',
    css: [
      '.card-grid {',
      '  display: grid;',
      '  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));',
      '  gap: 1.5rem;',
      '  padding: 1.5rem;',
      '}',
    ].join('\n'),
  };
}

function getDashboardPattern(): LayoutPattern {
  return {
    name: 'dashboard',
    description: 'Dashboard layout with header, sidebar, and grid content',
    css: [
      '.dashboard {',
      '  display: grid;',
      '  grid-template: "sidebar header" auto',
      '                 "sidebar content" 1fr',
      '                 / 64px 1fr;',
      '  min-height: 100dvh;',
      '}',
      '.dashboard > .sidebar { grid-area: sidebar; }',
      '.dashboard > .header { grid-area: header; }',
      '.dashboard > .content {',
      '  grid-area: content;',
      '  display: grid;',
      '  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));',
      '  gap: 1rem;',
      '  padding: 1rem;',
      '  align-content: start;',
      '}',
    ].join('\n'),
  };
}

function getSplitScreenPattern(): LayoutPattern {
  return {
    name: 'split-screen',
    description: 'Two equal columns, full height',
    css: [
      '.split-screen {',
      '  display: grid;',
      '  grid-template-columns: 1fr 1fr;',
      '  min-height: 100dvh;',
      '}',
      '@media (max-width: 768px) {',
      '  .split-screen { grid-template-columns: 1fr; }',
      '}',
    ].join('\n'),
  };
}

function getCenteredContentPattern(): LayoutPattern {
  return {
    name: 'centered-content',
    description: 'Horizontally and vertically centered content',
    css: [
      '.centered-content {',
      '  display: grid;',
      '  place-items: center;',
      '  min-height: 100dvh;',
      '}',
      '.centered-content > * { max-width: 65ch; width: 100%; }',
    ].join('\n'),
  };
}

export function getLayoutPatterns(): LayoutPattern[] {
  return [
    getHolyGrailPattern(),
    getSidebarContentPattern(),
    getCardGridPattern(),
    getDashboardPattern(),
    getSplitScreenPattern(),
    getCenteredContentPattern(),
  ];
}

/** Get a layout pattern by name. */
export function getLayoutPattern(name: string): LayoutPattern | undefined {
  return getLayoutPatterns().find((p) => p.name === name);
}
