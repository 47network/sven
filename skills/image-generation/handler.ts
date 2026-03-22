type InputPayload = {
  prompt: string;
  provider?: 'openai' | 'stable_diffusion';
  size?: '256x256' | '512x512' | '1024x1024' | '1024x768' | '768x1024';
  n?: number;
  style?: string;
};

type ImageResult = {
  data_url: string;
  seed?: number;
  width?: number;
  height?: number;
};

function parseSize(size: string): { width: number; height: number } {
  const [w, h] = size.split('x').map((v) => Number(v));
  if (!Number.isFinite(w) || !Number.isFinite(h)) {
    return { width: 1024, height: 1024 };
  }
  return { width: w, height: h };
}

async function generateOpenAI(input: InputPayload): Promise<{ model: string; images: ImageResult[] }> {
  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for OpenAI image generation');
  }
  const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
  const size = input.size || '1024x1024';
  const n = Math.max(1, Math.min(Number(input.n || 1), 4));
  const prompt = input.style ? `${input.prompt}\nStyle: ${input.style}` : input.prompt;

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt,
      size,
      n,
      response_format: 'b64_json',
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAI image generation failed (${res.status}): ${body}`);
  }
  const data = (await res.json()) as { data?: Array<{ b64_json?: string }> };
  const images = (data.data || [])
    .map((item) => item.b64_json)
    .filter((b64): b64 is string => Boolean(b64))
    .map((b64) => ({
      data_url: `data:image/png;base64,${b64}`,
    }));
  return { model, images };
}

async function generateStableDiffusion(input: InputPayload): Promise<{ model: string; images: ImageResult[] }> {
  const baseUrl = (process.env.STABLE_DIFFUSION_URL || 'http://127.0.0.1:7860').replace(/\/+$/, '');
  const apiKey = process.env.STABLE_DIFFUSION_API_KEY || '';
  const { width, height } = parseSize(input.size || '1024x1024');
  const prompt = input.style ? `${input.prompt}, ${input.style}` : input.prompt;

  const res = await fetch(`${baseUrl}/sdapi/v1/txt2img`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      prompt,
      width,
      height,
      steps: 30,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Stable Diffusion txt2img failed (${res.status}): ${body}`);
  }
  const data = (await res.json()) as { images?: string[]; info?: string };
  const images = (data.images || []).map((b64) => ({
    data_url: `data:image/png;base64,${b64}`,
  }));
  let model = 'stable-diffusion';
  if (data.info) {
    try {
      const parsed = JSON.parse(data.info) as { model?: string };
      if (parsed.model) model = parsed.model;
    } catch {
      // ignore info parse failure
    }
  }
  return { model, images };
}

export default async function handler(input: Record<string, unknown>) {
  const payload = input as InputPayload;
  if (!payload?.prompt) {
    throw new Error('prompt is required');
  }
  const provider = payload.provider || 'openai';
  if (provider === 'stable_diffusion') {
    const result = await generateStableDiffusion(payload);
    return { provider, model: result.model, images: result.images };
  }
  const result = await generateOpenAI(payload);
  return { provider, model: result.model, images: result.images };
}
