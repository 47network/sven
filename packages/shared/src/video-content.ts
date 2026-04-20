// ---------------------------------------------------------------------------
// Video Content Generation — shared types (Batch 32)
// Re-exports and complements types from services/agent-runtime/src/video-engine.ts
// ---------------------------------------------------------------------------

// ── Render status ──────────────────────────────────────────────
export type RenderStatus = 'pending' | 'rendering' | 'completed' | 'failed' | 'cancelled';

// ── Aspect ratios ──────────────────────────────────────────────
export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:3';

// ── Transition types ───────────────────────────────────────────
export type TransitionType =
  | 'cut'
  | 'fade'
  | 'dissolve'
  | 'wipe_left'
  | 'wipe_right'
  | 'slide_up'
  | 'slide_down';

// ── Element types ──────────────────────────────────────────────
export type ElementType = 'text' | 'image' | 'shape' | 'chart' | 'overlay';

// ── Template domains ───────────────────────────────────────────
export type TemplateDomain = 'social_media' | 'data_dashboard' | 'product_showcase' | 'tutorial' | 'custom';

// ── Asset types ────────────────────────────────────────────────
export type VideoAssetType = 'image' | 'font' | 'overlay' | 'audio' | 'logo';

// ── Output format ──────────────────────────────────────────────
export type VideoOutputFormat = 'mp4' | 'webm';

// ── Constants ──────────────────────────────────────────────────
export const RENDER_STATUSES: readonly RenderStatus[] = [
  'pending', 'rendering', 'completed', 'failed', 'cancelled',
] as const;

export const ASPECT_RATIOS: readonly AspectRatio[] = [
  '16:9', '9:16', '1:1', '4:3',
] as const;

export const TRANSITION_TYPES: readonly TransitionType[] = [
  'cut', 'fade', 'dissolve', 'wipe_left', 'wipe_right', 'slide_up', 'slide_down',
] as const;

export const ELEMENT_TYPES: readonly ElementType[] = [
  'text', 'image', 'shape', 'chart', 'overlay',
] as const;

export const TEMPLATE_DOMAINS: readonly TemplateDomain[] = [
  'social_media', 'data_dashboard', 'product_showcase', 'tutorial', 'custom',
] as const;

export const VIDEO_ASSET_TYPES: readonly VideoAssetType[] = [
  'image', 'font', 'overlay', 'audio', 'logo',
] as const;

export const DEFAULT_VIDEO_CONFIG = {
  maxConcurrentRenders: 3,
  defaultQualityCrf: 23,
  maxDurationS: 600,
  defaultFps: 30,
  outputFormat: 'mp4' as VideoOutputFormat,
} as const;

// ── Interfaces ─────────────────────────────────────────────────

export interface VideoElement {
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  props: Record<string, unknown>;
}

export interface Scene {
  id: string;
  durationS: number;
  elements: VideoElement[];
  transition: TransitionType;
  transitionDuration: number;
}

export interface AudioTrack {
  src: string;
  startTime: number;
  duration?: number;
  volume: number;
  fadeIn?: number;
  fadeOut?: number;
}

export interface VideoSpec {
  title: string;
  description: string;
  width: number;
  height: number;
  fps: number;
  bgColor: string;
  scenes: Scene[];
  audio?: AudioTrack[];
  format: VideoOutputFormat;
  quality: number;
}

export interface VideoTemplate {
  domain: TemplateDomain;
  name: string;
  description: string;
  aspectRatio: AspectRatio;
  defaultSpec: VideoSpec;
}

export interface RenderJobRecord {
  id: string;
  orgId: string;
  userId: string;
  status: RenderStatus;
  spec: VideoSpec;
  template?: TemplateDomain;
  progress: number;
  outputPath?: string;
  outputSize?: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface VideoAssetRecord {
  id: string;
  orgId: string;
  assetType: VideoAssetType;
  name: string;
  filePath: string;
  fileSize?: number;
  mimeType?: string;
  width?: number;
  height?: number;
  durationMs?: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface VideoTemplateRecord {
  id: string;
  orgId: string;
  domain: TemplateDomain;
  name: string;
  description?: string;
  aspectRatio: AspectRatio;
  defaultSpec: VideoSpec;
  isPublic: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RenderResult {
  jobId: string;
  status: RenderStatus;
  progress: number;
  outputPath?: string;
  outputSize?: number;
  durationMs?: number;
  error?: string;
}

export interface VideoEngineStats {
  totalJobs: number;
  completed: number;
  failed: number;
  rendering: number;
  pending: number;
  avgRenderTimeMs: number;
  totalOutputBytes: number;
}

// ── Utility functions ──────────────────────────────────────────

/** Check whether a render job is in a terminal state */
export function isTerminalRenderStatus(s: RenderStatus): boolean {
  return s === 'completed' || s === 'failed' || s === 'cancelled';
}

/** Compute total duration of a spec from its scenes */
export function computeSpecDuration(spec: VideoSpec): number {
  return spec.scenes.reduce((sum, s) => sum + s.durationS, 0);
}

/** Validate that a spec doesn't exceed the max duration */
export function isWithinDurationLimit(spec: VideoSpec, maxS = DEFAULT_VIDEO_CONFIG.maxDurationS): boolean {
  return computeSpecDuration(spec) <= maxS;
}

/** Pick resolution dimensions from an aspect ratio */
export function dimensionsForAspect(ratio: AspectRatio, base = 1080): { width: number; height: number } {
  switch (ratio) {
    case '16:9':  return { width: Math.round(base * 16 / 9), height: base };
    case '9:16':  return { width: base, height: Math.round(base * 16 / 9) };
    case '1:1':   return { width: base, height: base };
    case '4:3':   return { width: Math.round(base * 4 / 3), height: base };
  }
}

/** Estimate output file size in bytes (rough CRF-based heuristic) */
export function estimateOutputSize(spec: VideoSpec): number {
  const durationS = computeSpecDuration(spec);
  const pixels = spec.width * spec.height;
  const bitsPerPixel = 0.1 * (51 - spec.quality) / 51;
  return Math.round(pixels * bitsPerPixel * spec.fps * durationS / 8);
}
