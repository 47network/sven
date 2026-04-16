// ---------------------------------------------------------------------------
// Model Deploy Pipeline
// ---------------------------------------------------------------------------
// Handles model downloading (Ollama pull / HuggingFace Hub fetch),
// quantization recommendation based on available VRAM, model health
// verification, and performance profiling (tokens/sec, TTFT).
// ---------------------------------------------------------------------------

/* ------------------------------------------------------------------ types */

export type DeployTarget = 'ollama' | 'llama-server';

export interface DownloadRequest {
  modelName: string;
  target: DeployTarget;
  nodeEndpoint: string;
  /** Force re-download even if already present */
  force?: boolean;
}

export interface DownloadResult {
  success: boolean;
  modelName: string;
  target: DeployTarget;
  nodeEndpoint: string;
  sizeBytes: number | null;
  durationMs: number;
  message: string;
  alreadyPresent: boolean;
}

export type QuantLevel = 'FP16' | 'Q8_0' | 'Q6_K' | 'Q5_K_M' | 'Q4_K_M' | 'Q4_0' | 'Q3_K_S' | 'IQ2_M';

export interface QuantRecommendation {
  modelName: string;
  parameterCountB: number;
  availableVramMb: number;
  recommended: QuantLevel;
  alternatives: Array<{ level: QuantLevel; estimatedVramMb: number; qualityNote: string }>;
  reasoning: string;
}

export interface HealthCheckResult {
  healthy: boolean;
  modelName: string;
  nodeEndpoint: string;
  target: DeployTarget;
  latencyMs: number;
  respondedWithContent: boolean;
  errorMessage: string | null;
}

export interface ProfileResult {
  modelName: string;
  nodeEndpoint: string;
  target: DeployTarget;
  timeToFirstTokenMs: number;
  totalLatencyMs: number;
  totalTokens: number;
  tokensPerSecond: number;
  promptTokens: number;
  completionTokens: number;
  promptEvalRate: number | null;
}

export interface DeployPipelineResult {
  download: DownloadResult | null;
  quantRecommendation: QuantRecommendation | null;
  healthCheck: HealthCheckResult | null;
  profile: ProfileResult | null;
  overallSuccess: boolean;
  steps: string[];
}

/* -------------------------------------------------------- HTTP helpers */

function assertHttpUrl(url: string): void {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Only http/https URLs are allowed');
    }
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
}

async function fetchJson(url: string, timeoutMs = 15_000): Promise<{ ok: boolean; status: number; data: any }> {
  assertHttpUrl(url);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  } finally {
    clearTimeout(timer);
  }
}

async function postJson(
  url: string,
  body: Record<string, unknown>,
  timeoutMs = 30_000,
): Promise<{ ok: boolean; status: number; data: any }> {
  assertHttpUrl(url);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------- model download */

/**
 * Check if a model is already present on an Ollama node.
 */
async function ollamaModelExists(endpoint: string, model: string): Promise<boolean> {
  const res = await fetchJson(`${endpoint}/api/tags`, 10_000);
  if (!res.ok || !res.data?.models) return false;
  return res.data.models.some(
    (m: { name?: string }) => m.name === model || m.name === `${model}:latest`,
  );
}

/**
 * Download a model to the target runtime.
 *
 * - Ollama: POST /api/pull with stream=false
 * - llama-server: returns guidance message (models managed via --model flag at startup)
 */
export async function downloadModel(req: DownloadRequest): Promise<DownloadResult> {
  const start = Date.now();

  if (req.target === 'llama-server') {
    return {
      success: false,
      modelName: req.modelName,
      target: req.target,
      nodeEndpoint: req.nodeEndpoint,
      sizeBytes: null,
      durationMs: 0,
      message: 'llama-server models are loaded at startup via --model flag. Download the GGUF file manually and restart the server.',
      alreadyPresent: false,
    };
  }

  // Ollama target
  if (!req.force) {
    const exists = await ollamaModelExists(req.nodeEndpoint, req.modelName);
    if (exists) {
      return {
        success: true,
        modelName: req.modelName,
        target: req.target,
        nodeEndpoint: req.nodeEndpoint,
        sizeBytes: null,
        durationMs: Date.now() - start,
        message: `Model ${req.modelName} already present`,
        alreadyPresent: true,
      };
    }
  }

  const res = await postJson(
    `${req.nodeEndpoint}/api/pull`,
    { name: req.modelName, stream: false },
    600_000, // 10 min timeout for large downloads
  );

  const sizeBytes = typeof res.data?.total === 'number' ? res.data.total : null;

  return {
    success: res.ok,
    modelName: req.modelName,
    target: req.target,
    nodeEndpoint: req.nodeEndpoint,
    sizeBytes,
    durationMs: Date.now() - start,
    message: res.ok
      ? `Downloaded ${req.modelName} (${sizeBytes ? (sizeBytes / 1e9).toFixed(2) + ' GB' : 'unknown size'})`
      : `Download failed (HTTP ${res.status})`,
    alreadyPresent: false,
  };
}

/* ----------------------------------------- quantization recommendation */

/**
 * Estimate VRAM requirement for a given model size and quantization level.
 * Rough formula: VRAM ≈ params_B × bits_per_weight / 8 × overhead_factor (1.2)
 */
function estimateVramMb(paramsB: number, quantLevel: QuantLevel): number {
  const bitsPerWeight: Record<QuantLevel, number> = {
    FP16: 16,
    Q8_0: 8,
    Q6_K: 6.5,
    Q5_K_M: 5.5,
    Q4_K_M: 4.5,
    Q4_0: 4,
    Q3_K_S: 3.4,
    IQ2_M: 2.5,
  };

  const bits = bitsPerWeight[quantLevel];
  // bytes = paramsB * 1e9 * bits / 8, convert to MB, add 20% overhead for KV cache / activations
  return Math.ceil((paramsB * 1e9 * bits) / 8 / 1e6 * 1.2);
}

const QUANT_QUALITY_NOTES: Record<QuantLevel, string> = {
  FP16: 'Full precision — best quality, highest VRAM',
  Q8_0: 'Near-lossless — negligible quality loss',
  Q6_K: 'High quality — minimal perplexity increase',
  Q5_K_M: 'Good quality — slight degradation on nuanced tasks',
  Q4_K_M: 'Balanced — recommended for most use cases',
  Q4_0: 'Decent — noticeable quality loss on complex reasoning',
  Q3_K_S: 'Low — significant quality degradation',
  IQ2_M: 'Ultra-low — use only when severely VRAM constrained',
};

const QUANT_PREFERENCE_ORDER: QuantLevel[] = [
  'Q8_0', 'Q6_K', 'Q5_K_M', 'Q4_K_M', 'Q4_0', 'Q3_K_S', 'IQ2_M',
];

/**
 * Recommend a quantization level based on model size and available VRAM.
 * Returns the best quality that fits, plus alternatives.
 */
export function recommendQuantization(
  modelName: string,
  parameterCountB: number,
  availableVramMb: number,
): QuantRecommendation {
  const alternatives: QuantRecommendation['alternatives'] = [];

  // Check FP16 first
  const fp16Vram = estimateVramMb(parameterCountB, 'FP16');
  alternatives.push({ level: 'FP16', estimatedVramMb: fp16Vram, qualityNote: QUANT_QUALITY_NOTES.FP16 });

  // Check each quant level in preference order
  for (const level of QUANT_PREFERENCE_ORDER) {
    const vram = estimateVramMb(parameterCountB, level);
    alternatives.push({ level, estimatedVramMb: vram, qualityNote: QUANT_QUALITY_NOTES[level] });
  }

  // Pick the best that fits
  let recommended: QuantLevel = 'IQ2_M';
  let reasoning = '';

  if (fp16Vram <= availableVramMb) {
    recommended = 'FP16';
    reasoning = `FP16 fits within ${availableVramMb} MB — no quantization needed`;
  } else {
    for (const level of QUANT_PREFERENCE_ORDER) {
      const vram = estimateVramMb(parameterCountB, level);
      if (vram <= availableVramMb) {
        recommended = level;
        reasoning = `${parameterCountB}B model at FP16 requires ${fp16Vram} MB but only ${availableVramMb} MB available. ${level} at ~${vram} MB is the best quality fit.`;
        break;
      }
    }
    if (!reasoning) {
      const iq2Vram = estimateVramMb(parameterCountB, 'IQ2_M');
      reasoning = `${parameterCountB}B model exceeds available VRAM even at IQ2_M (~${iq2Vram} MB vs ${availableVramMb} MB). Consider a smaller model.`;
    }
  }

  return {
    modelName,
    parameterCountB,
    availableVramMb,
    recommended,
    alternatives,
    reasoning,
  };
}

/* ------------------------------------------------ model health check */

/**
 * Verify a model is loaded and responding on the target node.
 * Sends a minimal prompt and checks for a valid response.
 */
export async function checkModelHealth(
  modelName: string,
  nodeEndpoint: string,
  target: DeployTarget,
): Promise<HealthCheckResult> {
  const start = Date.now();

  if (target === 'ollama') {
    const res = await postJson(
      `${nodeEndpoint}/api/generate`,
      { model: modelName, prompt: 'ping', stream: false, options: { num_predict: 1 } },
      30_000,
    );

    return {
      healthy: res.ok && !!res.data?.response,
      modelName,
      nodeEndpoint,
      target,
      latencyMs: Date.now() - start,
      respondedWithContent: !!res.data?.response,
      errorMessage: res.ok ? null : `HTTP ${res.status}`,
    };
  }

  // llama-server — uses OpenAI-compatible /v1/chat/completions
  const res = await postJson(
    `${nodeEndpoint}/v1/chat/completions`,
    {
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 1,
      temperature: 0,
    },
    30_000,
  );

  const hasContent = !!res.data?.choices?.[0]?.message?.content;

  return {
    healthy: res.ok && hasContent,
    modelName,
    nodeEndpoint,
    target,
    latencyMs: Date.now() - start,
    respondedWithContent: hasContent,
    errorMessage: res.ok ? null : `HTTP ${res.status}`,
  };
}

/* ------------------------------------------- performance profiling */

const PROFILE_PROMPT = 'Explain the concept of recursion in programming in exactly three sentences.';

/**
 * Profile a model's inference performance by measuring TTFT, tokens/sec,
 * and total latency on a standard prompt.
 */
export async function profileModel(
  modelName: string,
  nodeEndpoint: string,
  target: DeployTarget,
): Promise<ProfileResult> {
  if (target === 'ollama') {
    return profileOllama(modelName, nodeEndpoint);
  }
  return profileLlamaServer(modelName, nodeEndpoint);
}

async function profileOllama(modelName: string, endpoint: string): Promise<ProfileResult> {
  const start = Date.now();

  const res = await postJson(
    `${endpoint}/api/generate`,
    {
      model: modelName,
      prompt: PROFILE_PROMPT,
      stream: false,
      options: { num_predict: 128, temperature: 0 },
    },
    60_000,
  );

  const totalLatencyMs = Date.now() - start;

  if (!res.ok || !res.data) {
    return {
      modelName,
      nodeEndpoint: endpoint,
      target: 'ollama',
      timeToFirstTokenMs: 0,
      totalLatencyMs,
      totalTokens: 0,
      tokensPerSecond: 0,
      promptTokens: 0,
      completionTokens: 0,
      promptEvalRate: null,
    };
  }

  // Ollama returns detailed timing in nanoseconds
  const d = res.data;
  const promptTokens = d.prompt_eval_count ?? 0;
  const completionTokens = d.eval_count ?? 0;
  const totalTokens = promptTokens + completionTokens;

  // prompt_eval_duration and eval_duration are in nanoseconds
  const promptEvalMs = (d.prompt_eval_duration ?? 0) / 1e6;
  const evalMs = (d.eval_duration ?? 0) / 1e6;

  const tokensPerSecond = evalMs > 0 ? (completionTokens / evalMs) * 1000 : 0;
  const promptEvalRate = promptEvalMs > 0 ? (promptTokens / promptEvalMs) * 1000 : null;

  // TTFT ≈ prompt eval time + overhead
  const ttft = promptEvalMs > 0 ? promptEvalMs : totalLatencyMs;

  return {
    modelName,
    nodeEndpoint: endpoint,
    target: 'ollama',
    timeToFirstTokenMs: Math.round(ttft),
    totalLatencyMs,
    totalTokens,
    tokensPerSecond: Math.round(tokensPerSecond * 100) / 100,
    promptTokens,
    completionTokens,
    promptEvalRate: promptEvalRate !== null ? Math.round(promptEvalRate * 100) / 100 : null,
  };
}

async function profileLlamaServer(modelName: string, endpoint: string): Promise<ProfileResult> {
  const start = Date.now();

  const res = await postJson(
    `${endpoint}/v1/chat/completions`,
    {
      messages: [{ role: 'user', content: PROFILE_PROMPT }],
      max_tokens: 128,
      temperature: 0,
    },
    60_000,
  );

  const totalLatencyMs = Date.now() - start;

  if (!res.ok || !res.data) {
    return {
      modelName,
      nodeEndpoint: endpoint,
      target: 'llama-server',
      timeToFirstTokenMs: 0,
      totalLatencyMs,
      totalTokens: 0,
      tokensPerSecond: 0,
      promptTokens: 0,
      completionTokens: 0,
      promptEvalRate: null,
    };
  }

  const d = res.data;
  const usage = d.usage ?? {};
  const promptTokens = usage.prompt_tokens ?? 0;
  const completionTokens = usage.completion_tokens ?? 0;
  const totalTokens = promptTokens + completionTokens;

  // llama.cpp provides timings in the response when available
  const timings = d.timings ?? {};
  const ttft = timings.prompt_ms ?? totalLatencyMs * 0.3; // estimate if not provided
  const predictedMs = timings.predicted_ms ?? (totalLatencyMs - ttft);
  const tokensPerSecond = predictedMs > 0 ? (completionTokens / predictedMs) * 1000 : 0;
  const promptEvalRate = ttft > 0 && promptTokens > 0 ? (promptTokens / ttft) * 1000 : null;

  return {
    modelName,
    nodeEndpoint: endpoint,
    target: 'llama-server',
    timeToFirstTokenMs: Math.round(ttft),
    totalLatencyMs,
    totalTokens,
    tokensPerSecond: Math.round(tokensPerSecond * 100) / 100,
    promptTokens,
    completionTokens,
    promptEvalRate: promptEvalRate !== null ? Math.round(promptEvalRate * 100) / 100 : null,
  };
}

/* ---------------------------------------------- full pipeline */

/**
 * Run the full deploy pipeline: download → quant recommendation → health check → profile.
 * Each step is optional — if a step fails, subsequent steps still attempt to run.
 */
export async function runDeployPipeline(opts: {
  modelName: string;
  target: DeployTarget;
  nodeEndpoint: string;
  parameterCountB?: number;
  availableVramMb?: number;
  skipDownload?: boolean;
  skipProfile?: boolean;
  force?: boolean;
}): Promise<DeployPipelineResult> {
  const steps: string[] = [];
  let overallSuccess = true;

  // Step 1: Download
  let download: DownloadResult | null = null;
  if (!opts.skipDownload) {
    steps.push('download');
    download = await downloadModel({
      modelName: opts.modelName,
      target: opts.target,
      nodeEndpoint: opts.nodeEndpoint,
      force: opts.force,
    });
    if (!download.success && !download.alreadyPresent) {
      overallSuccess = false;
    }
  }

  // Step 2: Quantization recommendation (pure computation, no I/O)
  let quantRecommendation: QuantRecommendation | null = null;
  if (opts.parameterCountB && opts.availableVramMb) {
    steps.push('quant-recommendation');
    quantRecommendation = recommendQuantization(
      opts.modelName,
      opts.parameterCountB,
      opts.availableVramMb,
    );
  }

  // Step 3: Health check
  steps.push('health-check');
  const healthCheck = await checkModelHealth(opts.modelName, opts.nodeEndpoint, opts.target);
  if (!healthCheck.healthy) {
    overallSuccess = false;
  }

  // Step 4: Performance profile
  let profile: ProfileResult | null = null;
  if (!opts.skipProfile && healthCheck.healthy) {
    steps.push('profile');
    profile = await profileModel(opts.modelName, opts.nodeEndpoint, opts.target);
    if (profile.tokensPerSecond === 0) {
      overallSuccess = false;
    }
  }

  return { download, quantRecommendation, healthCheck, profile, overallSuccess, steps };
}
