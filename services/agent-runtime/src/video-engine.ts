/**
 * Video Engine — ffmpeg-based programmatic video generation.
 *
 * Converts declarative VideoSpec JSON → ffmpeg commands → rendered MP4.
 * Supports 4 pre-built templates (social, data-viz, product, tutorial),
 * async render queue with status tracking, and natural-language-to-spec pipeline.
 */

// ---------------------------------------------------------------------------
import { createLogger } from '@sven/shared';

const logger = createLogger('video-engine');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RenderStatus = 'pending' | 'rendering' | 'completed' | 'failed' | 'cancelled';

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:3';

export type TransitionType = 'cut' | 'fade' | 'dissolve' | 'wipe_left' | 'wipe_right' | 'slide_up' | 'slide_down';

export type ElementType = 'text' | 'image' | 'shape' | 'chart' | 'overlay';

export type TemplateDomain = 'social_media' | 'data_dashboard' | 'product_showcase' | 'tutorial' | 'custom';

export interface VideoElement {
  id: string;
  type: ElementType;
  /** Start time in seconds */
  startTime: number;
  /** Duration in seconds */
  duration: number;
  /** Position [x, y] as fraction 0..1 */
  position: [number, number];
  /** Size [w, h] as fraction 0..1 */
  size: [number, number];
  /** z-index layer order */
  layer: number;
  /** Type-specific properties */
  props: Record<string, unknown>;
}

export interface TextElementProps {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontColor: string;
  bgColor?: string;
  align?: 'left' | 'center' | 'right';
  animation?: 'none' | 'fade_in' | 'slide_up' | 'typewriter';
}

export interface ImageElementProps {
  src: string;
  fit: 'cover' | 'contain' | 'fill';
  animation?: 'none' | 'zoom_in' | 'zoom_out' | 'pan_left' | 'pan_right';
}

export interface ShapeElementProps {
  shape: 'rectangle' | 'circle' | 'line';
  fillColor: string;
  borderColor?: string;
  borderWidth?: number;
  opacity?: number;
}

export interface Scene {
  id: string;
  /** Duration in seconds */
  duration: number;
  /** Background color hex or 'transparent' */
  bgColor: string;
  /** Background image path (optional) */
  bgImage?: string;
  elements: VideoElement[];
  /** Transition to next scene */
  transition: TransitionType;
  /** Transition duration in seconds */
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
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** Frames per second */
  fps: number;
  /** Background color hex */
  bgColor: string;
  scenes: Scene[];
  audio?: AudioTrack[];
  /** Output format */
  format: 'mp4' | 'webm';
  /** H.264 CRF quality (0-51, lower = better, default 23) */
  quality: number;
}

export interface VideoTemplate {
  domain: TemplateDomain;
  name: string;
  description: string;
  aspectRatio: AspectRatio;
  defaultSpec: VideoSpec;
}

export interface RenderJob {
  id: string;
  orgId: string;
  userId: string;
  spec: VideoSpec;
  template?: TemplateDomain;
  status: RenderStatus;
  progress: number;
  outputPath?: string;
  outputSize?: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
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

// ---------------------------------------------------------------------------
// Aspect ratio presets
// ---------------------------------------------------------------------------

const ASPECT_DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1':  { width: 1080, height: 1080 },
  '4:3':  { width: 1440, height: 1080 },
};

// ---------------------------------------------------------------------------
// Default config
// ---------------------------------------------------------------------------

export const DEFAULT_VIDEO_CONFIG: Omit<VideoSpec, 'title' | 'description' | 'scenes'> = {
  width: 1920,
  height: 1080,
  fps: 30,
  bgColor: '#000000',
  format: 'mp4',
  quality: 23,
};

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

let idCounter = 0;
export function resetIdCounter(): void { idCounter = 0; }

function nextId(prefix: string): string {
  return `${prefix}_${++idCounter}`;
}

// ---------------------------------------------------------------------------
// Job store (in-memory, capped)
// ---------------------------------------------------------------------------

const MAX_JOBS = 100;
const jobStore = new Map<string, RenderJob>();

function evictOldJobs(): void {
  if (jobStore.size < MAX_JOBS) return;
  const candidates = [...jobStore.values()]
    .filter(j => j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled')
    .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
  for (const c of candidates) {
    if (jobStore.size < MAX_JOBS) break;
    jobStore.delete(c.id);
  }
}

export function clearJobStore(): void { jobStore.clear(); }

// ---------------------------------------------------------------------------
// Scene helpers
// ---------------------------------------------------------------------------

export function createScene(partial: Partial<Scene> & { id: string }): Scene {
  return {
    duration: 3,
    bgColor: '#000000',
    elements: [],
    transition: 'cut',
    transitionDuration: 0.5,
    ...partial,
  };
}

export function createTextElement(
  id: string,
  text: string,
  opts: Partial<VideoElement & { props: Partial<TextElementProps> }> = {},
): VideoElement {
  return {
    id,
    type: 'text',
    startTime: 0,
    duration: 3,
    position: [0.5, 0.5],
    size: [0.8, 0.1],
    layer: 1,
    ...opts,
    props: {
      text,
      fontFamily: 'Arial',
      fontSize: 48,
      fontColor: '#FFFFFF',
      align: 'center',
      animation: 'fade_in',
      ...(opts.props ?? {}),
    },
  };
}

export function createImageElement(
  id: string,
  src: string,
  opts: Partial<VideoElement & { props: Partial<ImageElementProps> }> = {},
): VideoElement {
  return {
    id,
    type: 'image',
    startTime: 0,
    duration: 3,
    position: [0.5, 0.5],
    size: [1.0, 1.0],
    layer: 0,
    ...opts,
    props: {
      src,
      fit: 'cover',
      animation: 'none',
      ...(opts.props ?? {}),
    },
  };
}

// ---------------------------------------------------------------------------
// ffmpeg command builder
// ---------------------------------------------------------------------------

/**
 * Build drawtext filter string for a text element.
 */
export function buildTextFilter(el: VideoElement, sceneOffset: number, videoW: number, videoH: number): string {
  const p = el.props as unknown as TextElementProps;
  const x = Math.round(el.position[0] * videoW - (el.size[0] * videoW) / 2);
  const y = Math.round(el.position[1] * videoH - (el.size[1] * videoH) / 2);
  const start = sceneOffset + el.startTime;
  const end = start + el.duration;

  // Escape text for ffmpeg drawtext: single quotes, colons, backslashes
  const escaped = p.text
    .replace(/\\/g, '\\\\\\\\')
    .replace(/'/g, "'\\\\\\''")
    .replace(/:/g, '\\\\:');

  let filter = `drawtext=text='${escaped}'`;
  filter += `:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf`;
  filter += `:fontsize=${p.fontSize}`;
  filter += `:fontcolor=${p.fontColor}`;
  filter += `:x=${x}:y=${y}`;
  filter += `:enable='between(t,${start},${end})'`;

  if (p.animation === 'fade_in') {
    filter += `:alpha='if(lt(t-${start},0.5),(t-${start})/0.5,1)'`;
  }

  return filter;
}

/**
 * Build overlay filter for an image element.
 */
export function buildImageFilter(
  el: VideoElement,
  inputIdx: number,
  sceneOffset: number,
  videoW: number,
  videoH: number,
): string {
  const w = Math.round(el.size[0] * videoW);
  const h = Math.round(el.size[1] * videoH);
  const x = Math.round(el.position[0] * videoW - w / 2);
  const y = Math.round(el.position[1] * videoH - h / 2);
  const start = sceneOffset + el.startTime;
  const end = start + el.duration;

  return `[${inputIdx}:v]scale=${w}:${h}[img${inputIdx}];` +
    `[prev]overlay=${x}:${y}:enable='between(t,${start},${end})'[prev]`;
}

/**
 * Build color background input for a scene.
 */
export function buildSceneBgInput(scene: Scene, videoW: number, videoH: number): string {
  return `color=c=${scene.bgColor}:s=${videoW}x${videoH}:d=${scene.duration}:r=30`;
}

/**
 * Build transition filter between two scenes.
 */
export function buildTransitionFilter(
  t: TransitionType,
  duration: number,
  scene1Label: string,
  scene2Label: string,
  outputLabel: string,
): string {
  if (t === 'cut' || duration <= 0) {
    return `[${scene1Label}][${scene2Label}]concat=n=2:v=1:a=0[${outputLabel}]`;
  }

  if (t === 'fade' || t === 'dissolve') {
    return `[${scene1Label}][${scene2Label}]xfade=transition=fade:duration=${duration}:offset=auto[${outputLabel}]`;
  }

  if (t === 'wipe_left') {
    return `[${scene1Label}][${scene2Label}]xfade=transition=wipeleft:duration=${duration}:offset=auto[${outputLabel}]`;
  }
  if (t === 'wipe_right') {
    return `[${scene1Label}][${scene2Label}]xfade=transition=wiperight:duration=${duration}:offset=auto[${outputLabel}]`;
  }
  if (t === 'slide_up') {
    return `[${scene1Label}][${scene2Label}]xfade=transition=slideup:duration=${duration}:offset=auto[${outputLabel}]`;
  }
  if (t === 'slide_down') {
    return `[${scene1Label}][${scene2Label}]xfade=transition=slidedown:duration=${duration}:offset=auto[${outputLabel}]`;
  }

  // Fallback to concat
  return `[${scene1Label}][${scene2Label}]concat=n=2:v=1:a=0[${outputLabel}]`;
}

/**
 * Build complete ffmpeg command arguments from a VideoSpec.
 * Returns array of string arguments (not including `ffmpeg` binary itself).
 */
export function buildFfmpegArgs(spec: VideoSpec, outputPath: string): string[] {
  const args: string[] = ['-y']; // overwrite output

  const totalDuration = spec.scenes.reduce((sum, s) => sum + s.duration, 0);

  // Build scene inputs: color sources
  const filterParts: string[] = [];
  let sceneOffset = 0;

  for (let i = 0; i < spec.scenes.length; i++) {
    const scene = spec.scenes[i];
    // Color input for this scene
    args.push('-f', 'lavfi', '-i',
      `color=c=${scene.bgColor}:s=${spec.width}x${spec.height}:d=${scene.duration}:r=${spec.fps}`);
  }

  // Image inputs
  const imageInputs: { sceneIdx: number; elIdx: number; inputIdx: number; el: VideoElement }[] = [];
  let inputIdx = spec.scenes.length;
  for (let si = 0; si < spec.scenes.length; si++) {
    for (let ei = 0; ei < spec.scenes[si].elements.length; ei++) {
      const el = spec.scenes[si].elements[ei];
      if (el.type === 'image') {
        const p = el.props as unknown as ImageElementProps;
        args.push('-i', p.src);
        imageInputs.push({ sceneIdx: si, elIdx: ei, inputIdx, el });
        inputIdx++;
      }
    }
  }

  // Audio inputs
  if (spec.audio && spec.audio.length > 0) {
    for (const a of spec.audio) {
      args.push('-i', a.src);
      inputIdx++;
    }
  }

  // Build filter_complex
  const filters: string[] = [];

  // Process each scene: apply text overlays
  sceneOffset = 0;
  for (let i = 0; i < spec.scenes.length; i++) {
    const scene = spec.scenes[i];
    const textEls = scene.elements.filter(e => e.type === 'text');
    const textFilters = textEls.map(e =>
      buildTextFilter(e, sceneOffset, spec.width, spec.height),
    );

    if (textFilters.length > 0) {
      filters.push(`[${i}:v]${textFilters.join(',')}[scene${i}]`);
    } else {
      filters.push(`[${i}:v]null[scene${i}]`);
    }

    sceneOffset += scene.duration;
  }

  // Concat all scenes
  if (spec.scenes.length === 1) {
    filters.push(`[scene0]null[vout]`);
  } else {
    const sceneLabels = spec.scenes.map((_, i) => `[scene${i}]`).join('');
    filters.push(`${sceneLabels}concat=n=${spec.scenes.length}:v=1:a=0[vout]`);
  }

  if (filters.length > 0) {
    args.push('-filter_complex', filters.join(';'));
    args.push('-map', '[vout]');
  }

  // Audio mapping
  const audioStartIdx = spec.scenes.length + imageInputs.length;
  if (spec.audio && spec.audio.length > 0) {
    // Mix all audio tracks
    const audioFilters: string[] = [];
    for (let ai = 0; ai < spec.audio.length; ai++) {
      const a = spec.audio[ai];
      const idx = audioStartIdx + ai;
      let af = `[${idx}:a]volume=${a.volume}`;
      if (a.fadeIn && a.fadeIn > 0) {
        af += `,afade=t=in:d=${a.fadeIn}`;
      }
      if (a.fadeOut && a.fadeOut > 0) {
        af += `,afade=t=out:d=${a.fadeOut}:st=${(a.duration ?? totalDuration) - a.fadeOut}`;
      }
      af += `[a${ai}]`;
      audioFilters.push(af);
    }
    // If filter_complex already set, we need to append
    const existingFc = args.indexOf('-filter_complex');
    if (existingFc >= 0) {
      args[existingFc + 1] += ';' + audioFilters.join(';');
      if (spec.audio.length > 1) {
        const mixLabels = spec.audio.map((_, i) => `[a${i}]`).join('');
        args[existingFc + 1] += `;${mixLabels}amix=inputs=${spec.audio.length}[aout]`;
        args.push('-map', '[aout]');
      } else {
        args.push('-map', '[a0]');
      }
    }
  }

  // Output codec settings
  if (spec.format === 'mp4') {
    args.push('-c:v', 'libx264', '-crf', String(spec.quality), '-preset', 'medium');
    args.push('-pix_fmt', 'yuv420p');
  } else {
    args.push('-c:v', 'libvpx-vp9', '-crf', String(spec.quality), '-b:v', '0');
  }

  if (spec.audio && spec.audio.length > 0) {
    args.push('-c:a', 'aac', '-b:a', '192k');
  }

  args.push('-t', String(totalDuration));
  args.push(outputPath);

  return args;
}

// ---------------------------------------------------------------------------
// Render execution (simulated in-memory for now; real impl uses child_process)
// ---------------------------------------------------------------------------

/**
 * FfmpegRunner interface — decoupled for testability.
 * Real implementation spawns `ffmpeg` child process.
 */
export interface FfmpegRunner {
  run(args: string[]): Promise<{ exitCode: number; stderr: string }>;
}

/**
 * Execute a render job using the provided ffmpeg runner.
 */
export async function executeRender(
  job: RenderJob,
  runner: FfmpegRunner,
  outputDir: string,
): Promise<RenderResult> {
  const now = new Date();
  job.status = 'rendering';
  job.startedAt = now;
  job.updatedAt = now;
  job.progress = 0;

  logger.info('render started', { jobId: job.id });

  const outputPath = `${outputDir}/${job.id}.${job.spec.format}`;

  try {
    const args = buildFfmpegArgs(job.spec, outputPath);
    const result = await runner.run(args);

    if (result.exitCode !== 0) {
      job.status = 'failed';
      job.error = result.stderr.slice(0, 2000);
      job.updatedAt = new Date();
      logger.error('render failed', { jobId: job.id, stderr: job.error });
      return {
        jobId: job.id,
        status: 'failed',
        progress: 0,
        error: job.error,
      };
    }

    job.status = 'completed';
    job.progress = 100;
    job.outputPath = outputPath;
    job.completedAt = new Date();
    job.updatedAt = job.completedAt;

    const durationMs = job.completedAt.getTime() - (job.startedAt?.getTime() ?? now.getTime());
    logger.info('render completed', { jobId: job.id, durationMs, outputPath });

    return {
      jobId: job.id,
      status: 'completed',
      progress: 100,
      outputPath,
      durationMs,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    job.status = 'failed';
    job.error = msg;
    job.updatedAt = new Date();
    logger.error('render error', { jobId: job.id, error: msg });
    return {
      jobId: job.id,
      status: 'failed',
      progress: 0,
      error: msg,
    };
  }
}

// ---------------------------------------------------------------------------
// Job management
// ---------------------------------------------------------------------------

export function createRenderJob(
  orgId: string,
  userId: string,
  spec: VideoSpec,
  template?: TemplateDomain,
): RenderJob {
  evictOldJobs();
  const now = new Date();
  const job: RenderJob = {
    id: nextId('vid'),
    orgId,
    userId,
    spec,
    template,
    status: 'pending',
    progress: 0,
    createdAt: now,
    updatedAt: now,
  };
  jobStore.set(job.id, job);
  logger.info('render job created', { jobId: job.id, orgId, template });
  return job;
}

export function getRenderJob(jobId: string): RenderJob | undefined {
  return jobStore.get(jobId);
}

export function cancelRenderJob(jobId: string): boolean {
  const job = jobStore.get(jobId);
  if (!job) return false;
  if (job.status === 'completed' || job.status === 'failed') return false;
  job.status = 'cancelled';
  job.updatedAt = new Date();
  logger.info('render job cancelled', { jobId });
  return true;
}

export function listRenderJobs(orgId?: string, status?: RenderStatus): RenderJob[] {
  let jobs = [...jobStore.values()];
  if (orgId) jobs = jobs.filter(j => j.orgId === orgId);
  if (status) jobs = jobs.filter(j => j.status === status);
  return jobs.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export function getVideoStats(): VideoEngineStats {
  const jobs = [...jobStore.values()];
  const completed = jobs.filter(j => j.status === 'completed');
  const renderTimes = completed
    .filter(j => j.startedAt && j.completedAt)
    .map(j => j.completedAt!.getTime() - j.startedAt!.getTime());

  return {
    totalJobs: jobs.length,
    completed: completed.length,
    failed: jobs.filter(j => j.status === 'failed').length,
    rendering: jobs.filter(j => j.status === 'rendering').length,
    pending: jobs.filter(j => j.status === 'pending').length,
    avgRenderTimeMs: renderTimes.length > 0
      ? Math.round(renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length)
      : 0,
    totalOutputBytes: completed.reduce((sum, j) => sum + (j.outputSize ?? 0), 0),
  };
}

// ---------------------------------------------------------------------------
// Natural-language to VideoSpec pipeline
// ---------------------------------------------------------------------------

export interface VideoSpecProvider {
  complete(prompt: string): Promise<string>;
}

/**
 * Convert natural language description to a VideoSpec using an LLM.
 */
export async function textToVideoSpec(
  description: string,
  provider: VideoSpecProvider,
  aspectRatio: AspectRatio = '16:9',
): Promise<VideoSpec> {
  const dims = ASPECT_DIMENSIONS[aspectRatio];

  const prompt = `You are a video composition designer. Convert the following description into a JSON VideoSpec object.

Rules:
- Output ONLY valid JSON, no markdown fences, no explanation
- Use these exact fields: title (string), description (string), width (${dims.width}), height (${dims.height}), fps (30), bgColor (hex), scenes (array), format ("mp4"), quality (23)
- Each scene: { id (string), duration (seconds), bgColor (hex), elements (array), transition ("cut"|"fade"|"dissolve"|"wipe_left"|"wipe_right"|"slide_up"|"slide_down"), transitionDuration (seconds) }
- Each element: { id (string), type ("text"|"image"|"shape"), startTime (seconds), duration (seconds), position ([x,y] 0-1), size ([w,h] 0-1), layer (int), props (object) }
- Text props: { text, fontFamily ("Arial"), fontSize (int), fontColor (hex), align, animation ("none"|"fade_in"|"slide_up"|"typewriter") }
- Shape props: { shape ("rectangle"|"circle"), fillColor (hex), opacity (0-1) }
- Keep videos under 60 seconds total
- Use professional color palettes

Description: ${description}`;

  const raw = await provider.complete(prompt);

  // Extract JSON from response (handle markdown fences)
  let jsonStr = raw.trim();
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonStr);
    // Validate and apply defaults
    return {
      title: String(parsed.title ?? 'Untitled Video'),
      description: String(parsed.description ?? description),
      width: Number(parsed.width) || dims.width,
      height: Number(parsed.height) || dims.height,
      fps: Number(parsed.fps) || 30,
      bgColor: String(parsed.bgColor ?? '#000000'),
      scenes: Array.isArray(parsed.scenes)
        ? parsed.scenes.map((s: Record<string, unknown>, i: number) => ({
            id: String(s.id ?? `scene_${i}`),
            duration: Math.max(0.5, Math.min(30, Number(s.duration) || 3)),
            bgColor: String(s.bgColor ?? '#000000'),
            elements: Array.isArray(s.elements) ? (s.elements as VideoElement[]) : [],
            transition: String(s.transition ?? 'fade') as TransitionType,
            transitionDuration: Math.max(0, Math.min(3, Number(s.transitionDuration) || 0.5)),
          }))
        : [createScene({ id: 'scene_0' })],
      format: parsed.format === 'webm' ? 'webm' : 'mp4',
      quality: Math.max(0, Math.min(51, Number(parsed.quality) || 23)),
    };
  } catch {
    logger.warn('failed to parse LLM video spec, using fallback', { raw: raw.slice(0, 500) });
    // Fallback: single text scene
    return {
      title: 'Generated Video',
      description,
      width: dims.width,
      height: dims.height,
      fps: 30,
      bgColor: '#1a1a2e',
      scenes: [
        createScene({
          id: 'scene_0',
          duration: 5,
          bgColor: '#1a1a2e',
          elements: [
            createTextElement('txt_0', description.slice(0, 100), {
              position: [0.5, 0.5],
              size: [0.8, 0.15],
              props: { fontColor: '#FFFFFF', fontSize: 42, animation: 'fade_in' },
            }),
          ],
        }),
      ],
      format: 'mp4',
      quality: 23,
    };
  }
}

// ---------------------------------------------------------------------------
// Preview generation (single frame)
// ---------------------------------------------------------------------------

/**
 * Build ffmpeg args for generating a single-frame preview image.
 */
export function buildPreviewArgs(spec: VideoSpec, outputPath: string, atTime: number = 0): string[] {
  const args: string[] = ['-y'];

  // Single color bg input
  const scene = spec.scenes[0];
  if (!scene) {
    return ['-y', '-f', 'lavfi', '-i',
      `color=c=${spec.bgColor}:s=${spec.width}x${spec.height}:d=0.1:r=1`,
      '-frames:v', '1', outputPath];
  }

  args.push('-f', 'lavfi', '-i',
    `color=c=${scene.bgColor}:s=${spec.width}x${spec.height}:d=${scene.duration}:r=${spec.fps}`);

  // Apply text elements
  const textEls = scene.elements.filter(e => e.type === 'text');
  if (textEls.length > 0) {
    const textFilters = textEls.map(e => buildTextFilter(e, 0, spec.width, spec.height));
    args.push('-vf', textFilters.join(','));
  }

  args.push('-ss', String(atTime));
  args.push('-frames:v', '1');
  args.push(outputPath);

  return args;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const BRAND_COLORS = {
  primary: '#0A0F1C',
  accent: '#6C5CE7',
  text: '#FFFFFF',
  secondary: '#A29BFE',
  warning: '#FDCB6E',
};

export const VIDEO_TEMPLATES: VideoTemplate[] = [
  {
    domain: 'social_media',
    name: 'Social Media Post',
    description: 'Short-form social media video (9:16 vertical, 15s max)',
    aspectRatio: '9:16',
    defaultSpec: {
      title: 'Social Post',
      description: 'Engaging social media video',
      width: 1080,
      height: 1920,
      fps: 30,
      bgColor: '#1a1a2e',
      format: 'mp4',
      quality: 23,
      scenes: [
        createScene({
          id: 'hook',
          duration: 3,
          bgColor: BRAND_COLORS.primary,
          elements: [
            createTextElement('hook_text', 'Your Hook Here', {
              position: [0.5, 0.35],
              size: [0.85, 0.12],
              props: { fontColor: BRAND_COLORS.text, fontSize: 64, animation: 'slide_up' },
            }),
          ],
          transition: 'fade',
          transitionDuration: 0.5,
        }),
        createScene({
          id: 'body',
          duration: 5,
          bgColor: BRAND_COLORS.primary,
          elements: [
            createTextElement('body_text', 'Main content goes here', {
              position: [0.5, 0.4],
              size: [0.85, 0.2],
              props: { fontColor: BRAND_COLORS.secondary, fontSize: 48, animation: 'fade_in' },
            }),
          ],
          transition: 'dissolve',
          transitionDuration: 0.5,
        }),
        createScene({
          id: 'cta',
          duration: 3,
          bgColor: BRAND_COLORS.accent,
          elements: [
            createTextElement('cta_text', 'Follow for more!', {
              position: [0.5, 0.5],
              size: [0.8, 0.1],
              props: { fontColor: BRAND_COLORS.text, fontSize: 56, animation: 'fade_in' },
            }),
          ],
          transition: 'cut',
          transitionDuration: 0,
        }),
      ],
    },
  },
  {
    domain: 'data_dashboard',
    name: 'Data Dashboard Animation',
    description: 'Animated data visualization video (16:9, charts + metrics)',
    aspectRatio: '16:9',
    defaultSpec: {
      title: 'Data Dashboard',
      description: 'Animated data visualization',
      width: 1920,
      height: 1080,
      fps: 30,
      bgColor: '#0D1117',
      format: 'mp4',
      quality: 20,
      scenes: [
        createScene({
          id: 'title_scene',
          duration: 3,
          bgColor: '#0D1117',
          elements: [
            createTextElement('dashboard_title', 'Monthly Report', {
              position: [0.5, 0.3],
              size: [0.6, 0.1],
              props: { fontColor: '#58A6FF', fontSize: 56, animation: 'fade_in' },
            }),
            createTextElement('dashboard_subtitle', 'Key Metrics Overview', {
              position: [0.5, 0.45],
              size: [0.5, 0.06],
              props: { fontColor: '#8B949E', fontSize: 32, animation: 'fade_in' },
            }),
          ],
          transition: 'fade',
          transitionDuration: 0.8,
        }),
        createScene({
          id: 'metrics_scene',
          duration: 5,
          bgColor: '#0D1117',
          elements: [
            createTextElement('metric1', 'Revenue: $1.2M', {
              position: [0.25, 0.35],
              size: [0.3, 0.08],
              layer: 1,
              props: { fontColor: '#3FB950', fontSize: 36, animation: 'slide_up' },
            }),
            createTextElement('metric2', 'Users: 45.2K', {
              position: [0.5, 0.35],
              size: [0.3, 0.08],
              startTime: 0.3,
              layer: 1,
              props: { fontColor: '#58A6FF', fontSize: 36, animation: 'slide_up' },
            }),
            createTextElement('metric3', 'Growth: +23%', {
              position: [0.75, 0.35],
              size: [0.3, 0.08],
              startTime: 0.6,
              layer: 1,
              props: { fontColor: '#D29922', fontSize: 36, animation: 'slide_up' },
            }),
          ],
          transition: 'dissolve',
          transitionDuration: 0.5,
        }),
        createScene({
          id: 'closing',
          duration: 2,
          bgColor: '#0D1117',
          elements: [
            createTextElement('closing_text', 'Full report at dashboard.example.com', {
              position: [0.5, 0.5],
              size: [0.7, 0.06],
              props: { fontColor: '#8B949E', fontSize: 28, animation: 'fade_in' },
            }),
          ],
          transition: 'cut',
          transitionDuration: 0,
        }),
      ],
    },
  },
  {
    domain: 'product_showcase',
    name: 'Product Showcase',
    description: 'Product presentation video with text + image slots (16:9)',
    aspectRatio: '16:9',
    defaultSpec: {
      title: 'Product Showcase',
      description: 'Professional product presentation',
      width: 1920,
      height: 1080,
      fps: 30,
      bgColor: '#FFFFFF',
      format: 'mp4',
      quality: 20,
      scenes: [
        createScene({
          id: 'intro',
          duration: 3,
          bgColor: '#FFFFFF',
          elements: [
            createTextElement('product_name', 'Product Name', {
              position: [0.5, 0.4],
              size: [0.6, 0.1],
              props: { fontColor: '#1A1A2E', fontSize: 60, animation: 'slide_up' },
            }),
            createTextElement('tagline', 'Your tagline here', {
              position: [0.5, 0.55],
              size: [0.5, 0.06],
              startTime: 0.5,
              props: { fontColor: '#666666', fontSize: 28, animation: 'fade_in' },
            }),
          ],
          transition: 'wipe_left',
          transitionDuration: 0.8,
        }),
        createScene({
          id: 'features',
          duration: 5,
          bgColor: '#F5F5F5',
          elements: [
            createTextElement('feat_title', 'Key Features', {
              position: [0.5, 0.15],
              size: [0.5, 0.08],
              props: { fontColor: '#1A1A2E', fontSize: 42, animation: 'fade_in' },
            }),
            createTextElement('feat1', '✓ Feature One', {
              position: [0.5, 0.35],
              size: [0.6, 0.06],
              startTime: 0.5,
              props: { fontColor: '#333333', fontSize: 32, animation: 'slide_up' },
            }),
            createTextElement('feat2', '✓ Feature Two', {
              position: [0.5, 0.45],
              size: [0.6, 0.06],
              startTime: 1.0,
              props: { fontColor: '#333333', fontSize: 32, animation: 'slide_up' },
            }),
            createTextElement('feat3', '✓ Feature Three', {
              position: [0.5, 0.55],
              size: [0.6, 0.06],
              startTime: 1.5,
              props: { fontColor: '#333333', fontSize: 32, animation: 'slide_up' },
            }),
          ],
          transition: 'fade',
          transitionDuration: 0.5,
        }),
        createScene({
          id: 'cta',
          duration: 3,
          bgColor: '#1A1A2E',
          elements: [
            createTextElement('cta_text', 'Get Started Today', {
              position: [0.5, 0.45],
              size: [0.6, 0.1],
              props: { fontColor: '#FFFFFF', fontSize: 52, animation: 'fade_in' },
            }),
            createTextElement('url', 'www.example.com', {
              position: [0.5, 0.6],
              size: [0.4, 0.05],
              startTime: 0.5,
              props: { fontColor: '#A29BFE', fontSize: 28, animation: 'fade_in' },
            }),
          ],
          transition: 'cut',
          transitionDuration: 0,
        }),
      ],
    },
  },
  {
    domain: 'tutorial',
    name: 'Tutorial / Walkthrough',
    description: 'Step-by-step tutorial video with numbered steps (16:9)',
    aspectRatio: '16:9',
    defaultSpec: {
      title: 'Tutorial',
      description: 'Step-by-step walkthrough',
      width: 1920,
      height: 1080,
      fps: 30,
      bgColor: '#1E1E2E',
      format: 'mp4',
      quality: 23,
      scenes: [
        createScene({
          id: 'title',
          duration: 3,
          bgColor: '#1E1E2E',
          elements: [
            createTextElement('tut_title', 'How to Get Started', {
              position: [0.5, 0.4],
              size: [0.7, 0.1],
              props: { fontColor: '#CDD6F4', fontSize: 52, animation: 'fade_in' },
            }),
          ],
          transition: 'slide_up',
          transitionDuration: 0.6,
        }),
        createScene({
          id: 'step1',
          duration: 5,
          bgColor: '#1E1E2E',
          elements: [
            createTextElement('step1_num', 'Step 1', {
              position: [0.5, 0.25],
              size: [0.3, 0.08],
              props: { fontColor: '#89B4FA', fontSize: 36, animation: 'slide_up' },
            }),
            createTextElement('step1_text', 'Install the dependencies', {
              position: [0.5, 0.45],
              size: [0.7, 0.08],
              startTime: 0.3,
              props: { fontColor: '#CDD6F4', fontSize: 40, animation: 'fade_in' },
            }),
          ],
          transition: 'slide_up',
          transitionDuration: 0.6,
        }),
        createScene({
          id: 'step2',
          duration: 5,
          bgColor: '#1E1E2E',
          elements: [
            createTextElement('step2_num', 'Step 2', {
              position: [0.5, 0.25],
              size: [0.3, 0.08],
              props: { fontColor: '#89B4FA', fontSize: 36, animation: 'slide_up' },
            }),
            createTextElement('step2_text', 'Configure your settings', {
              position: [0.5, 0.45],
              size: [0.7, 0.08],
              startTime: 0.3,
              props: { fontColor: '#CDD6F4', fontSize: 40, animation: 'fade_in' },
            }),
          ],
          transition: 'fade',
          transitionDuration: 0.5,
        }),
        createScene({
          id: 'done',
          duration: 3,
          bgColor: '#1E1E2E',
          elements: [
            createTextElement('done_text', "You're all set!", {
              position: [0.5, 0.45],
              size: [0.5, 0.1],
              props: { fontColor: '#A6E3A1', fontSize: 48, animation: 'fade_in' },
            }),
          ],
          transition: 'cut',
          transitionDuration: 0,
        }),
      ],
    },
  },
];

// ---------------------------------------------------------------------------
// Template helpers
// ---------------------------------------------------------------------------

export function getTemplate(domain: TemplateDomain): VideoTemplate | undefined {
  return VIDEO_TEMPLATES.find(t => t.domain === domain);
}

export function listTemplates(): VideoTemplate[] {
  return VIDEO_TEMPLATES.filter(t => t.domain !== 'custom');
}

/**
 * Create a VideoSpec from a template with user overrides.
 */
export function specFromTemplate(
  domain: TemplateDomain,
  overrides: Partial<VideoSpec> = {},
): VideoSpec {
  const tpl = getTemplate(domain);
  if (!tpl) {
    throw new Error(`Unknown template domain: ${domain}`);
  }
  return {
    ...tpl.defaultSpec,
    ...overrides,
    scenes: overrides.scenes ?? tpl.defaultSpec.scenes,
  };
}

/**
 * Compute total duration of a VideoSpec.
 */
export function computeDuration(spec: VideoSpec): number {
  return spec.scenes.reduce((sum, s) => sum + s.duration, 0);
}

/**
 * Validate a VideoSpec for common issues.
 */
export function validateSpec(spec: VideoSpec): string[] {
  const errors: string[] = [];

  if (!spec.title || spec.title.length === 0) errors.push('title is required');
  if (spec.width < 100 || spec.width > 7680) errors.push('width must be 100-7680');
  if (spec.height < 100 || spec.height > 4320) errors.push('height must be 100-4320');
  if (spec.fps < 1 || spec.fps > 120) errors.push('fps must be 1-120');
  if (spec.quality < 0 || spec.quality > 51) errors.push('quality must be 0-51');
  if (!spec.scenes || spec.scenes.length === 0) errors.push('at least one scene is required');

  const totalDuration = computeDuration(spec);
  if (totalDuration > 300) errors.push('total duration exceeds 5 minutes');
  if (totalDuration <= 0) errors.push('total duration must be positive');

  for (const scene of spec.scenes) {
    if (scene.duration <= 0) errors.push(`scene ${scene.id}: duration must be positive`);
    if (scene.duration > 60) errors.push(`scene ${scene.id}: duration exceeds 60 seconds`);
    for (const el of scene.elements) {
      if (el.position[0] < 0 || el.position[0] > 1 || el.position[1] < 0 || el.position[1] > 1) {
        errors.push(`element ${el.id}: position must be 0-1`);
      }
      if (el.size[0] <= 0 || el.size[0] > 2 || el.size[1] <= 0 || el.size[1] > 2) {
        errors.push(`element ${el.id}: size must be >0 and <=2`);
      }
    }
  }

  return errors;
}
