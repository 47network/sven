import type pg from 'pg';
import { analyzeMedia, extractKeyFramesWithFfmpeg, readResponseBufferWithinLimit, resolveMediaSubprocessTimeoutMs } from '../src/media-analysis';

function mockPool(): pg.Pool {
  return {
    query: async () => ({ rows: [{ pattern: 'example.com' }] }),
  } as unknown as pg.Pool;
}

function makeFetch(buffer: Buffer, status = 200, headers: Record<string, string> = {}): any {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (key: string) => headers[key.toLowerCase()] || headers[key] || null,
    },
    arrayBuffer: async () => buffer,
  });
}

describe('analyzeMedia', () => {
  it('analyzes audio via URL and returns transcript + summary', async () => {
    const pool = mockPool();
    const deps = {
      fetch: makeFetch(Buffer.from('audio-bytes')),
      getWebAllowlist: async () => ['example.com'],
      writeFile: async () => {},
      mkdtemp: async () => 'C:\\tmp\\media-test',
      tmpdir: () => 'C:\\tmp',
      unlink: async () => {},
      transcribeAudio: async () => 'hello world',
      summarizeTranscript: async () => ({ summary: 'summary', topics: ['topic1'] }),
      describeImage: async () => 'desc',
      extractKeyFrames: async () => [],
    };

    const result = await analyzeMedia(
      { url: 'https://example.com/test.mp3', media_type: 'audio' },
      pool,
      deps as any,
    );

    expect(result.error).toBeUndefined();
    expect(result.outputs.media_type).toBe('audio');
    expect(result.outputs.transcript).toBe('hello world');
    expect(result.outputs.summary).toBe('summary');
  });

  it('analyzes video via URL and returns key frame descriptions', async () => {
    const pool = mockPool();
    const deps = {
      fetch: makeFetch(Buffer.from('video-bytes')),
      getWebAllowlist: async () => ['example.com'],
      writeFile: async () => {},
      mkdtemp: async () => 'C:\\tmp\\media-test',
      tmpdir: () => 'C:\\tmp',
      unlink: async () => {},
      rm: async () => {},
      transcribeAudio: async () => '',
      summarizeTranscript: async () => ({ summary: 'video summary', topics: ['topicA'] }),
      describeImage: async () => 'frame description',
      extractKeyFrames: async () => ['C:\\tmp\\frame-001.jpg', 'C:\\tmp\\frame-002.jpg'],
    };

    const result = await analyzeMedia(
      { url: 'https://example.com/test.mp4', media_type: 'video' },
      pool,
      deps as any,
    );

    expect(result.error).toBeUndefined();
    const frames = result.outputs.key_frames as Array<{ description: string }>;
    expect(frames.length).toBe(2);
    expect(frames[0].description).toBe('frame description');
    expect(result.outputs.summary).toBe('video summary');
  });

  it('enforces max file size', async () => {
    const pool = mockPool();
    const deps = {
      fetch: makeFetch(Buffer.from('too-big')),
      getWebAllowlist: async () => ['example.com'],
      writeFile: async () => {},
      mkdtemp: async () => 'C:\\tmp\\media-test',
      tmpdir: () => 'C:\\tmp',
      unlink: async () => {},
      transcribeAudio: async () => '',
      summarizeTranscript: async () => ({ summary: '', topics: [] }),
      describeImage: async () => '',
      extractKeyFrames: async () => [],
    };

    const result = await analyzeMedia(
      { url: 'https://example.com/test.mp3', media_type: 'audio', max_bytes: 1 },
      pool,
      deps as any,
    );

    expect(result.error).toMatch(/exceeds size limit/i);
  });

  it('rejects lookalike suffix domain when exact allowlist entry is configured', async () => {
    const pool = mockPool();
    const deps = {
      fetch: makeFetch(Buffer.from('audio-bytes')),
      getWebAllowlist: async () => ['example.com'],
      writeFile: async () => {},
      mkdtemp: async () => 'C:\\tmp\\media-test',
      tmpdir: () => 'C:\\tmp',
      unlink: async () => {},
      transcribeAudio: async () => '',
      summarizeTranscript: async () => ({ summary: '', topics: [] }),
      describeImage: async () => '',
      extractKeyFrames: async () => [],
    };

    const result = await analyzeMedia(
      { url: 'https://badexample.com/test.mp3', media_type: 'audio' },
      pool,
      deps as any,
    );

    expect(result.error).toMatch(/URL domain not allowlisted/i);
  });

  it('allows explicit wildcard subdomain match', async () => {
    const pool = mockPool();
    const deps = {
      fetch: makeFetch(Buffer.from('audio-bytes')),
      getWebAllowlist: async () => ['*.example.com'],
      writeFile: async () => {},
      mkdtemp: async () => 'C:\\tmp\\media-test',
      tmpdir: () => 'C:\\tmp',
      unlink: async () => {},
      transcribeAudio: async () => 'ok',
      summarizeTranscript: async () => ({ summary: 'ok', topics: [] }),
      describeImage: async () => '',
      extractKeyFrames: async () => [],
    };

    const result = await analyzeMedia(
      { url: 'https://api.example.com/test.mp3', media_type: 'audio' },
      pool,
      deps as any,
    );

    expect(result.error).toBeUndefined();
    expect(result.outputs.media_type).toBe('audio');
  });

  it('rejects non-numeric max_bytes with validation error', async () => {
    const pool = mockPool();
    const deps = {
      fetch: makeFetch(Buffer.from('audio-bytes')),
      getWebAllowlist: async () => ['example.com'],
      writeFile: async () => {},
      mkdtemp: async () => 'C:\\tmp\\media-test',
      tmpdir: () => 'C:\\tmp',
      unlink: async () => {},
      transcribeAudio: async () => '',
      summarizeTranscript: async () => ({ summary: '', topics: [] }),
      describeImage: async () => '',
      extractKeyFrames: async () => [],
    };

    const result = await analyzeMedia(
      { url: 'https://example.com/test.mp3', media_type: 'audio', max_bytes: 'abc' },
      pool,
      deps as any,
    );

    expect(result.error).toMatch(/max_bytes must be a finite number/i);
  });

  it('rejects non-positive max_bytes with validation error', async () => {
    const pool = mockPool();
    const deps = {
      fetch: makeFetch(Buffer.from('audio-bytes')),
      getWebAllowlist: async () => ['example.com'],
      writeFile: async () => {},
      mkdtemp: async () => 'C:\\tmp\\media-test',
      tmpdir: () => 'C:\\tmp',
      unlink: async () => {},
      transcribeAudio: async () => '',
      summarizeTranscript: async () => ({ summary: '', topics: [] }),
      describeImage: async () => '',
      extractKeyFrames: async () => [],
    };

    const result = await analyzeMedia(
      { url: 'https://example.com/test.mp3', media_type: 'audio', max_bytes: 0 },
      pool,
      deps as any,
    );

    expect(result.error).toMatch(/max_bytes must be greater than 0/i);
  });

  it('fails with deterministic timeout error when media URL fetch hangs', async () => {
    const pool = mockPool();
    const prevFetchTimeout = process.env.MEDIA_ANALYSIS_FETCH_TIMEOUT_MS;
    try {
      process.env.MEDIA_ANALYSIS_FETCH_TIMEOUT_MS = '10';
      const deps = {
        fetch: (_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          }, { once: true });
        }),
        getWebAllowlist: async () => ['example.com'],
        writeFile: async () => {},
        mkdtemp: async () => 'C:\\tmp\\media-test',
        tmpdir: () => 'C:\\tmp',
        unlink: async () => {},
        transcribeAudio: async () => '',
        summarizeTranscript: async () => ({ summary: '', topics: [] }),
        describeImage: async () => '',
        extractKeyFrames: async () => [],
      };

      const result = await analyzeMedia(
        { url: 'https://example.com/test.mp3', media_type: 'audio' },
        pool,
        deps as any,
      );

      expect(result.error).toMatch(/Media URL fetch timed out after/i);
    } finally {
      if (prevFetchTimeout === undefined) {
        delete process.env.MEDIA_ANALYSIS_FETCH_TIMEOUT_MS;
      } else {
        process.env.MEDIA_ANALYSIS_FETCH_TIMEOUT_MS = prevFetchTimeout;
      }
    }
  });

  it('returns bounded fallback summary when OpenAI summarize call times out', async () => {
    const pool = mockPool();
    const prevOpenAiKey = process.env.OPENAI_API_KEY;
    const prevOpenAiTimeout = process.env.MEDIA_ANALYSIS_OPENAI_TIMEOUT_MS;
    const prevFetch = global.fetch;
    try {
      process.env.OPENAI_API_KEY = 'test-key';
      process.env.MEDIA_ANALYSIS_OPENAI_TIMEOUT_MS = '10';
      global.fetch = jest.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(Object.assign(new Error('timed out'), { name: 'TimeoutError' }));
        }, { once: true });
      })) as any;

      const transcript = 'x'.repeat(600);
      const deps = {
        fetch: makeFetch(Buffer.from('audio-bytes')),
        transcribeAudio: async () => transcript,
        mkdtemp: async () => 'C:\\tmp\\media-test',
        tmpdir: () => 'C:\\tmp',
        unlink: async () => {},
        writeFile: async () => {},
        getWebAllowlist: async () => ['example.com'],
        describeImage: async () => '',
        extractKeyFrames: async () => [],
      };

      const result = await analyzeMedia(
        { url: 'https://example.com/test.mp3', media_type: 'audio' },
        pool,
        deps as any,
      );

      expect(result.error).toBeUndefined();
      expect(result.outputs.summary).toBe(transcript.slice(0, 280));
      expect(result.outputs.topics).toEqual([]);
    } finally {
      if (prevOpenAiKey === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = prevOpenAiKey;
      }
      if (prevOpenAiTimeout === undefined) {
        delete process.env.MEDIA_ANALYSIS_OPENAI_TIMEOUT_MS;
      } else {
        process.env.MEDIA_ANALYSIS_OPENAI_TIMEOUT_MS = prevOpenAiTimeout;
      }
      global.fetch = prevFetch;
    }
  });

  it('removes URL temp directory after successful analysis', async () => {
    const pool = mockPool();
    const rm = jest.fn(async () => {});
    const unlink = jest.fn(async () => {});
    const deps = {
      fetch: makeFetch(Buffer.from('audio-bytes')),
      getWebAllowlist: async () => ['example.com'],
      writeFile: async () => {},
      mkdtemp: async () => 'C:\\tmp\\media-test-success',
      tmpdir: () => 'C:\\tmp',
      unlink,
      rm,
      transcribeAudio: async () => 'ok transcript',
      summarizeTranscript: async () => ({ summary: 'ok', topics: [] }),
      describeImage: async () => '',
      extractKeyFrames: async () => [],
    };

    const result = await analyzeMedia(
      { url: 'https://example.com/test.mp3', media_type: 'audio' },
      pool,
      deps as any,
    );
    expect(result.error).toBeUndefined();
    expect(unlink).toHaveBeenCalledWith('C:\\tmp\\media-test-success\\media.mp3');
    expect(rm).toHaveBeenCalledWith('C:\\tmp\\media-test-success', { recursive: true, force: true });
  });

  it('removes URL temp directory when analysis fails after download', async () => {
    const pool = mockPool();
    const rm = jest.fn(async () => {});
    const unlink = jest.fn(async () => {});
    const deps = {
      fetch: makeFetch(Buffer.from('audio-bytes')),
      getWebAllowlist: async () => ['example.com'],
      writeFile: async () => {},
      mkdtemp: async () => 'C:\\tmp\\media-test-fail',
      tmpdir: () => 'C:\\tmp',
      unlink,
      rm,
      transcribeAudio: async () => {
        throw new Error('transcriber boom');
      },
      summarizeTranscript: async () => ({ summary: '', topics: [] }),
      describeImage: async () => '',
      extractKeyFrames: async () => [],
    };

    const result = await analyzeMedia(
      { url: 'https://example.com/test.mp3', media_type: 'audio' },
      pool,
      deps as any,
    );
    expect(result.error).toMatch(/transcriber boom/i);
    expect(unlink).toHaveBeenCalledWith('C:\\tmp\\media-test-fail\\media.mp3');
    expect(rm).toHaveBeenCalledWith('C:\\tmp\\media-test-fail', { recursive: true, force: true });
  });
});

describe('media-analysis timeout guards', () => {
  it('rejects non-finite subprocess timeout env values', () => {
    expect(() => resolveMediaSubprocessTimeoutMs('abc', 'MEDIA_ANALYSIS_TRANSCRIBE_TIMEOUT_MS', 300000)).toThrow(
      /must be a finite number/i,
    );
  });

  it('clamps subprocess timeout env values to safe bounds', () => {
    expect(resolveMediaSubprocessTimeoutMs('10', 'MEDIA_ANALYSIS_TRANSCRIBE_TIMEOUT_MS', 300000)).toBe(1000);
    expect(resolveMediaSubprocessTimeoutMs('999999999', 'MEDIA_ANALYSIS_TRANSCRIBE_TIMEOUT_MS', 300000)).toBe(900000);
  });

  it('maps ffmpeg timeout to deterministic keyframe extraction error', async () => {
    const prev = process.env.MEDIA_ANALYSIS_KEYFRAME_TIMEOUT_MS;
    process.env.MEDIA_ANALYSIS_KEYFRAME_TIMEOUT_MS = '1500';
    const spawnSyncMock = jest.fn(() => ({
      error: Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' }),
      status: null,
      stderr: '',
    }));
    const readdirMock = jest.fn(async () => []);

    await expect(
      extractKeyFramesWithFfmpeg(
        spawnSyncMock as any,
        readdirMock as any,
        '/tmp/video.mp4',
        '/tmp/out',
        10,
        5,
      ),
    ).rejects.toThrow(/timed out after 1500ms/i);

    expect(readdirMock).not.toHaveBeenCalled();
    if (prev === undefined) {
      delete process.env.MEDIA_ANALYSIS_KEYFRAME_TIMEOUT_MS;
    } else {
      process.env.MEDIA_ANALYSIS_KEYFRAME_TIMEOUT_MS = prev;
    }
  });
});

describe('media-analysis streaming size guard', () => {
  it('rejects oversized chunked responses during streaming read', async () => {
    const chunks = [
      Uint8Array.from([1, 2, 3, 4]),
      Uint8Array.from([5, 6, 7, 8]),
      Uint8Array.from([9, 10, 11, 12]),
    ];
    let readCalls = 0;
    let cancelled = false;
    const reader = {
      read: async () => {
        if (readCalls >= chunks.length) {
          return { done: true, value: undefined };
        }
        const value = chunks[readCalls];
        readCalls += 1;
        return { done: false, value };
      },
      cancel: async () => {
        cancelled = true;
      },
      releaseLock: () => {},
    };
    const response = {
      body: {
        getReader: () => reader,
      },
      arrayBuffer: async () => {
        throw new Error('arrayBuffer should not be used when stream body exists');
      },
    } as unknown as Response;

    await expect(readResponseBufferWithinLimit(response, 8)).rejects.toThrow(/exceeds size limit/i);
    expect(readCalls).toBe(3);
    expect(cancelled).toBe(true);
  });
});
