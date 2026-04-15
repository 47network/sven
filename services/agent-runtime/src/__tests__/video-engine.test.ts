/**
 * Tests for video-engine.ts — programmatic video generation engine.
 */

import {
  createScene,
  createTextElement,
  createImageElement,
  buildTextFilter,
  buildImageFilter,
  buildSceneBgInput,
  buildTransitionFilter,
  buildFfmpegArgs,
  buildPreviewArgs,
  executeRender,
  createRenderJob,
  getRenderJob,
  cancelRenderJob,
  listRenderJobs,
  listTemplates,
  getTemplate,
  specFromTemplate,
  textToVideoSpec,
  computeDuration,
  validateSpec,
  getVideoStats,
  clearJobStore,
  resetIdCounter,
  VIDEO_TEMPLATES,
  DEFAULT_VIDEO_CONFIG,
  type VideoSpec,
  type VideoElement,
  type FfmpegRunner,
  type VideoSpecProvider,
  type TextElementProps,
} from '../video-engine';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSpec(overrides: Partial<VideoSpec> = {}): VideoSpec {
  return {
    title: 'Test Video',
    description: 'A test video',
    width: 1920,
    height: 1080,
    fps: 30,
    bgColor: '#000000',
    format: 'mp4',
    quality: 23,
    scenes: [
      createScene({
        id: 'scene_0',
        duration: 3,
        bgColor: '#1a1a2e',
        elements: [
          createTextElement('txt_0', 'Hello World'),
        ],
      }),
    ],
    ...overrides,
  };
}

function makeMockRunner(exitCode = 0, stderr = ''): FfmpegRunner {
  return {
    run: jest.fn().mockResolvedValue({ exitCode, stderr }),
  };
}

function makeMockProvider(response: string): VideoSpecProvider {
  return {
    complete: jest.fn().mockResolvedValue(response),
  };
}

beforeEach(() => {
  resetIdCounter();
  clearJobStore();
});

// ---------------------------------------------------------------------------
// Scene construction
// ---------------------------------------------------------------------------

describe('createScene', () => {
  it('creates a scene with defaults', () => {
    const scene = createScene({ id: 'test' });
    expect(scene.id).toBe('test');
    expect(scene.duration).toBe(3);
    expect(scene.bgColor).toBe('#000000');
    expect(scene.transition).toBe('cut');
    expect(scene.transitionDuration).toBe(0.5);
    expect(scene.elements).toEqual([]);
  });

  it('merges overrides', () => {
    const scene = createScene({ id: 's1', duration: 5, bgColor: '#FF0000' });
    expect(scene.duration).toBe(5);
    expect(scene.bgColor).toBe('#FF0000');
  });
});

describe('createTextElement', () => {
  it('creates a text element with defaults', () => {
    const el = createTextElement('t1', 'Hello');
    expect(el.id).toBe('t1');
    expect(el.type).toBe('text');
    expect((el.props as TextElementProps).text).toBe('Hello');
    expect((el.props as TextElementProps).fontFamily).toBe('Arial');
    expect((el.props as TextElementProps).fontSize).toBe(48);
    expect((el.props as TextElementProps).animation).toBe('fade_in');
  });

  it('merges custom props', () => {
    const el = createTextElement('t2', 'World', {
      position: [0.1, 0.2],
      props: { fontSize: 72, fontColor: '#FF0000' },
    });
    expect(el.position).toEqual([0.1, 0.2]);
    expect((el.props as TextElementProps).fontSize).toBe(72);
    expect((el.props as TextElementProps).fontColor).toBe('#FF0000');
    expect((el.props as TextElementProps).text).toBe('World');
  });
});

describe('createImageElement', () => {
  it('creates an image element with defaults', () => {
    const el = createImageElement('img1', '/path/to/image.png');
    expect(el.id).toBe('img1');
    expect(el.type).toBe('image');
    expect(el.props).toEqual({ src: '/path/to/image.png', fit: 'cover', animation: 'none' });
    expect(el.layer).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// ffmpeg command building
// ---------------------------------------------------------------------------

describe('buildTextFilter', () => {
  it('generates drawtext filter', () => {
    const el = createTextElement('txt', 'Hello');
    const filter = buildTextFilter(el, 0, 1920, 1080);
    expect(filter).toContain('drawtext=');
    expect(filter).toContain('Hello');
    expect(filter).toContain('fontsize=48');
    expect(filter).toContain("enable='between(t,0,3)'");
  });

  it('applies scene offset to timing', () => {
    const el = createTextElement('txt', 'Test', { startTime: 1, duration: 2 });
    const filter = buildTextFilter(el, 5, 1920, 1080);
    expect(filter).toContain("enable='between(t,6,8)'");
  });

  it('adds alpha for fade_in animation', () => {
    const el = createTextElement('txt', 'Fade', {
      props: { animation: 'fade_in' },
    });
    const filter = buildTextFilter(el, 0, 1920, 1080);
    expect(filter).toContain('alpha=');
  });

  it('escapes colons in text', () => {
    const el = createTextElement('txt', 'Time: 12:00');
    const filter = buildTextFilter(el, 0, 1920, 1080);
    expect(filter).toContain('\\\\:');
  });
});

describe('buildImageFilter', () => {
  it('generates overlay filter', () => {
    const el = createImageElement('img', '/img.png', {
      position: [0.5, 0.5],
      size: [0.5, 0.5],
      startTime: 0,
      duration: 3,
    });
    const filter = buildImageFilter(el, 1, 0, 1920, 1080);
    expect(filter).toContain('[1:v]scale=');
    expect(filter).toContain('overlay=');
    expect(filter).toContain("enable='between(t,0,3)'");
  });
});

describe('buildSceneBgInput', () => {
  it('generates color input string', () => {
    const scene = createScene({ id: 's0', bgColor: '#FF0000', duration: 5 });
    const input = buildSceneBgInput(scene, 1920, 1080);
    expect(input).toContain('color=c=#FF0000');
    expect(input).toContain('s=1920x1080');
    expect(input).toContain('d=5');
  });
});

describe('buildTransitionFilter', () => {
  it('uses concat for cut transition', () => {
    const f = buildTransitionFilter('cut', 0, 's0', 's1', 'out');
    expect(f).toContain('concat=n=2');
  });

  it('uses xfade for fade transition', () => {
    const f = buildTransitionFilter('fade', 0.5, 's0', 's1', 'out');
    expect(f).toContain('xfade=transition=fade');
  });

  it('uses xfade for wipe_left', () => {
    const f = buildTransitionFilter('wipe_left', 0.5, 's0', 's1', 'out');
    expect(f).toContain('xfade=transition=wipeleft');
  });

  it('uses xfade for slide_up', () => {
    const f = buildTransitionFilter('slide_up', 0.5, 's0', 's1', 'out');
    expect(f).toContain('xfade=transition=slideup');
  });

  it('falls back to concat for zero duration', () => {
    const f = buildTransitionFilter('fade', 0, 's0', 's1', 'out');
    expect(f).toContain('concat=n=2');
  });
});

describe('buildFfmpegArgs', () => {
  it('generates valid args for single scene', () => {
    const spec = makeSpec();
    const args = buildFfmpegArgs(spec, '/tmp/out.mp4');

    expect(args[0]).toBe('-y');
    expect(args).toContain('-c:v');
    expect(args).toContain('libx264');
    expect(args).toContain('-crf');
    expect(args).toContain('23');
    expect(args[args.length - 1]).toBe('/tmp/out.mp4');
  });

  it('generates args for multi-scene spec', () => {
    const spec = makeSpec({
      scenes: [
        createScene({ id: 's0', duration: 3, elements: [] }),
        createScene({ id: 's1', duration: 5, elements: [] }),
      ],
    });
    const args = buildFfmpegArgs(spec, '/tmp/out.mp4');
    expect(args.join(' ')).toContain('concat=n=2');
  });

  it('includes audio settings when audio present', () => {
    const spec = makeSpec({
      audio: [{ src: '/music.mp3', startTime: 0, volume: 0.8 }],
    });
    const args = buildFfmpegArgs(spec, '/tmp/out.mp4');
    expect(args).toContain('-i');
    expect(args).toContain('/music.mp3');
    expect(args).toContain('-c:a');
    expect(args).toContain('aac');
  });

  it('uses vp9 codec for webm format', () => {
    const spec = makeSpec({ format: 'webm' });
    const args = buildFfmpegArgs(spec, '/tmp/out.webm');
    expect(args).toContain('libvpx-vp9');
  });
});

describe('buildPreviewArgs', () => {
  it('generates single-frame preview args', () => {
    const spec = makeSpec();
    const args = buildPreviewArgs(spec, '/tmp/preview.png');
    expect(args).toContain('-frames:v');
    expect(args).toContain('1');
    expect(args[args.length - 1]).toBe('/tmp/preview.png');
  });

  it('handles empty scenes', () => {
    const spec = makeSpec({ scenes: [] });
    const args = buildPreviewArgs(spec, '/tmp/preview.png');
    expect(args).toContain('-frames:v');
  });
});

// ---------------------------------------------------------------------------
// Render execution
// ---------------------------------------------------------------------------

describe('executeRender', () => {
  it('runs ffmpeg and completes successfully', async () => {
    const runner = makeMockRunner(0, '');
    const job = createRenderJob('org1', 'user1', makeSpec());

    const result = await executeRender(job, runner, '/tmp');

    expect(result.status).toBe('completed');
    expect(result.progress).toBe(100);
    expect(result.outputPath).toContain(job.id);
    expect(result.durationMs).toBeDefined();
    expect(runner.run).toHaveBeenCalledTimes(1);
  });

  it('sets failed status on non-zero exit code', async () => {
    const runner = makeMockRunner(1, 'encoding error');
    const job = createRenderJob('org1', 'user1', makeSpec());

    const result = await executeRender(job, runner, '/tmp');

    expect(result.status).toBe('failed');
    expect(result.error).toContain('encoding error');
  });

  it('handles runner exception', async () => {
    const runner: FfmpegRunner = {
      run: jest.fn().mockRejectedValue(new Error('ffmpeg not found')),
    };
    const job = createRenderJob('org1', 'user1', makeSpec());

    const result = await executeRender(job, runner, '/tmp');

    expect(result.status).toBe('failed');
    expect(result.error).toContain('ffmpeg not found');
  });
});

// ---------------------------------------------------------------------------
// Job management
// ---------------------------------------------------------------------------

describe('createRenderJob', () => {
  it('creates a job with pending status', () => {
    const job = createRenderJob('org1', 'user1', makeSpec(), 'social_media');
    expect(job.status).toBe('pending');
    expect(job.orgId).toBe('org1');
    expect(job.template).toBe('social_media');
    expect(job.progress).toBe(0);
  });

  it('is retrievable by ID', () => {
    const job = createRenderJob('org1', 'user1', makeSpec());
    const retrieved = getRenderJob(job.id);
    expect(retrieved).toBe(job);
  });
});

describe('cancelRenderJob', () => {
  it('cancels a pending job', () => {
    const job = createRenderJob('org1', 'user1', makeSpec());
    const cancelled = cancelRenderJob(job.id);
    expect(cancelled).toBe(true);
    expect(job.status).toBe('cancelled');
  });

  it('returns false for non-existent job', () => {
    expect(cancelRenderJob('nonexistent')).toBe(false);
  });

  it('returns false for completed job', async () => {
    const job = createRenderJob('org1', 'user1', makeSpec());
    job.status = 'completed';
    expect(cancelRenderJob(job.id)).toBe(false);
  });
});

describe('listRenderJobs', () => {
  it('lists jobs sorted by updatedAt desc', () => {
    const j1 = createRenderJob('org1', 'user1', makeSpec());
    j1.updatedAt = new Date('2026-01-01');
    const j2 = createRenderJob('org1', 'user1', makeSpec());
    j2.updatedAt = new Date('2026-06-01');

    const jobs = listRenderJobs('org1');
    expect(jobs[0].id).toBe(j2.id);
    expect(jobs[1].id).toBe(j1.id);
  });

  it('filters by org', () => {
    createRenderJob('org1', 'user1', makeSpec());
    createRenderJob('org2', 'user1', makeSpec());

    expect(listRenderJobs('org1')).toHaveLength(1);
    expect(listRenderJobs('org2')).toHaveLength(1);
  });

  it('filters by status', () => {
    const j1 = createRenderJob('org1', 'user1', makeSpec());
    const j2 = createRenderJob('org1', 'user1', makeSpec());
    j2.status = 'completed';

    expect(listRenderJobs('org1', 'pending')).toHaveLength(1);
    expect(listRenderJobs('org1', 'completed')).toHaveLength(1);
  });
});

describe('getVideoStats', () => {
  it('returns aggregate stats', () => {
    const j1 = createRenderJob('org1', 'user1', makeSpec());
    j1.status = 'completed';
    j1.startedAt = new Date('2026-01-01T00:00:00Z');
    j1.completedAt = new Date('2026-01-01T00:00:10Z');
    j1.outputSize = 5000;

    const j2 = createRenderJob('org1', 'user1', makeSpec());
    j2.status = 'failed';

    const stats = getVideoStats();
    expect(stats.totalJobs).toBe(2);
    expect(stats.completed).toBe(1);
    expect(stats.failed).toBe(1);
    expect(stats.avgRenderTimeMs).toBe(10000);
    expect(stats.totalOutputBytes).toBe(5000);
  });
});

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

describe('templates', () => {
  it('lists all non-custom templates', () => {
    const tpls = listTemplates();
    expect(tpls.length).toBe(4);
    expect(tpls.map(t => t.domain)).toEqual([
      'social_media', 'data_dashboard', 'product_showcase', 'tutorial',
    ]);
  });

  it('gets template by domain', () => {
    const tpl = getTemplate('social_media');
    expect(tpl).toBeDefined();
    expect(tpl!.name).toBe('Social Media Post');
    expect(tpl!.aspectRatio).toBe('9:16');
  });

  it('returns undefined for unknown domain', () => {
    expect(getTemplate('custom')).toBeUndefined();
  });

  it('creates spec from template with overrides', () => {
    const spec = specFromTemplate('tutorial', { title: 'My Tutorial' });
    expect(spec.title).toBe('My Tutorial');
    expect(spec.width).toBe(1920);
    expect(spec.scenes.length).toBeGreaterThan(0);
  });

  it('throws for unknown template', () => {
    expect(() => specFromTemplate('unknown' as any)).toThrow('Unknown template domain');
  });

  it('has proper aspect ratios', () => {
    const social = getTemplate('social_media')!;
    expect(social.defaultSpec.width).toBe(1080);
    expect(social.defaultSpec.height).toBe(1920);

    const dashboard = getTemplate('data_dashboard')!;
    expect(dashboard.defaultSpec.width).toBe(1920);
    expect(dashboard.defaultSpec.height).toBe(1080);
  });
});

// ---------------------------------------------------------------------------
// Text-to-spec pipeline
// ---------------------------------------------------------------------------

describe('textToVideoSpec', () => {
  it('parses valid LLM JSON response', async () => {
    const response = JSON.stringify({
      title: 'My Video',
      description: 'A cool video',
      width: 1920,
      height: 1080,
      fps: 30,
      bgColor: '#112233',
      format: 'mp4',
      quality: 20,
      scenes: [
        {
          id: 's0',
          duration: 5,
          bgColor: '#000000',
          elements: [],
          transition: 'fade',
          transitionDuration: 0.5,
        },
      ],
    });
    const provider = makeMockProvider(response);

    const spec = await textToVideoSpec('Make a cool video', provider);
    expect(spec.title).toBe('My Video');
    expect(spec.bgColor).toBe('#112233');
    expect(spec.scenes).toHaveLength(1);
    expect(spec.scenes[0].duration).toBe(5);
  });

  it('handles markdown-fenced JSON', async () => {
    const response = '```json\n{"title":"Fenced","description":"test","scenes":[{"id":"s0","duration":3}]}\n```';
    const provider = makeMockProvider(response);

    const spec = await textToVideoSpec('test', provider);
    expect(spec.title).toBe('Fenced');
  });

  it('falls back on invalid JSON', async () => {
    const provider = makeMockProvider('not valid json at all');
    const spec = await textToVideoSpec('make a video about cats', provider);

    expect(spec.title).toBe('Generated Video');
    expect(spec.scenes).toHaveLength(1);
    expect(spec.scenes[0].elements.length).toBeGreaterThan(0);
  });

  it('clamps scene duration to valid range', async () => {
    const response = JSON.stringify({
      title: 'Clamp Test',
      scenes: [
        { id: 's0', duration: 100 }, // exceeds max 30
        { id: 's1', duration: -5 },  // below min 0.5
      ],
    });
    const provider = makeMockProvider(response);

    const spec = await textToVideoSpec('test', provider);
    expect(spec.scenes[0].duration).toBe(30);
    expect(spec.scenes[1].duration).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('validateSpec', () => {
  it('returns no errors for valid spec', () => {
    const errors = validateSpec(makeSpec());
    expect(errors).toEqual([]);
  });

  it('detects missing title', () => {
    const errors = validateSpec(makeSpec({ title: '' }));
    expect(errors).toContain('title is required');
  });

  it('detects invalid dimensions', () => {
    const errors = validateSpec(makeSpec({ width: 50, height: 5000 }));
    expect(errors).toContain('width must be 100-7680');
    expect(errors).toContain('height must be 100-4320');
  });

  it('detects no scenes', () => {
    const errors = validateSpec(makeSpec({ scenes: [] }));
    expect(errors.some(e => e.includes('at least one scene'))).toBe(true);
  });

  it('detects excessive duration', () => {
    const spec = makeSpec({
      scenes: Array.from({ length: 20 }, (_, i) =>
        createScene({ id: `s${i}`, duration: 20 }),
      ),
    });
    const errors = validateSpec(spec);
    expect(errors.some(e => e.includes('exceeds 5 minutes'))).toBe(true);
  });

  it('detects out-of-range element position', () => {
    const scene = createScene({
      id: 's0',
      elements: [
        createTextElement('t0', 'Bad', { position: [1.5, -0.5] }),
      ],
    });
    const errors = validateSpec(makeSpec({ scenes: [scene] }));
    expect(errors.some(e => e.includes('position must be 0-1'))).toBe(true);
  });

  it('detects invalid fps', () => {
    const errors = validateSpec(makeSpec({ fps: 0 }));
    expect(errors).toContain('fps must be 1-120');
  });
});

// ---------------------------------------------------------------------------
// computeDuration
// ---------------------------------------------------------------------------

describe('computeDuration', () => {
  it('sums scene durations', () => {
    const spec = makeSpec({
      scenes: [
        createScene({ id: 's0', duration: 3 }),
        createScene({ id: 's1', duration: 5 }),
        createScene({ id: 's2', duration: 2 }),
      ],
    });
    expect(computeDuration(spec)).toBe(10);
  });

  it('returns 0 for empty scenes', () => {
    expect(computeDuration(makeSpec({ scenes: [] }))).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Default config
// ---------------------------------------------------------------------------

describe('DEFAULT_VIDEO_CONFIG', () => {
  it('has sensible defaults', () => {
    expect(DEFAULT_VIDEO_CONFIG.width).toBe(1920);
    expect(DEFAULT_VIDEO_CONFIG.height).toBe(1080);
    expect(DEFAULT_VIDEO_CONFIG.fps).toBe(30);
    expect(DEFAULT_VIDEO_CONFIG.format).toBe('mp4');
    expect(DEFAULT_VIDEO_CONFIG.quality).toBe(23);
  });
});

// ---------------------------------------------------------------------------
// VIDEO_TEMPLATES integrity
// ---------------------------------------------------------------------------

describe('VIDEO_TEMPLATES', () => {
  it('all templates have valid specs', () => {
    for (const tpl of VIDEO_TEMPLATES) {
      const errors = validateSpec(tpl.defaultSpec);
      expect(errors).toEqual([]);
    }
  });

  it('all templates have at least one scene', () => {
    for (const tpl of VIDEO_TEMPLATES) {
      expect(tpl.defaultSpec.scenes.length).toBeGreaterThan(0);
    }
  });

  it('all templates have unique domains', () => {
    const domains = VIDEO_TEMPLATES.map(t => t.domain);
    expect(new Set(domains).size).toBe(domains.length);
  });
});
