/**
 * Speech-to-text providers (docs/ai-models.md). Raw audio cannot be de-identified, so production uses
 * Sarvam (Indian company, India data, DPA, no training). Demo uses Groq Whisper with FAKE data only.
 * Audio never reaches the LLM — only the patient-confirmed, de-identified text does.
 */
export interface Transcript {
  text: string;
  /** 0–1 where the provider reports it; null when unknown. */
  confidence: number | null;
  language: string | null;
  audioSeconds: number;
  provider: string;
  model: string;
  latencyMs: number;
}

export interface SttRequest {
  audio: Buffer;
  mime: string;
  /** Client-measured duration (used for cost when the provider does not report it). */
  durationMs: number;
  languageHint?: 'hi' | 'en' | 'hi-en';
  /** Mock only: which answer in the scripted interview this is. */
  sequence?: number;
}

export interface SttProvider {
  readonly name: string;
  readonly model: string;
  transcribe(req: SttRequest): Promise<Transcript>;
}

export const STT_PROVIDERS = ['mock', 'groq', 'sarvam'] as const;
export type SttProviderName = (typeof STT_PROVIDERS)[number];

/** Deterministic Hinglish answers for dev/demo/tests (no network, no real audio needed). */
export const MOCK_STT_SCRIPT = [
  'Haan, main hi hoon',
  'Haan, shuru karein',
  'Mujhe do din se bukhar hai, raat ko 101 tak jaata hai',
  'Do din se',
  'Halka hai, aata jaata hai',
  'Raat ko zyada hota hai',
  'Gale mein kharash hai, khansi nahi',
];

export class MockSttProvider implements SttProvider {
  readonly name = 'mock';
  readonly model = 'mock-stt-v1';
  async transcribe(req: SttRequest): Promise<Transcript> {
    const i = req.sequence ?? 0;
    return {
      text: MOCK_STT_SCRIPT[i] ?? 'Nahi',
      confidence: 0.95,
      language: 'hi-en',
      audioSeconds: Math.round(req.durationMs / 100) / 10,
      provider: this.name,
      model: this.model,
      latencyMs: 0,
    };
  }
}

const extFor = (mime: string) => (mime.includes('ogg') ? 'ogg' : mime.includes('mp4') || mime.includes('m4a') ? 'm4a' : mime.includes('wav') ? 'wav' : 'webm');

async function postForm(url: string, headers: Record<string, string>, form: FormData): Promise<unknown> {
  const res = await fetch(url, { method: 'POST', headers, body: form, signal: AbortSignal.timeout(45_000) });
  // Status only — provider error bodies could echo content.
  if (!res.ok) throw new Error(`STT provider HTTP ${res.status}`);
  return res.json();
}

/** Groq Whisper (OpenAI-compatible transcription API). Demo only — test data. */
export class GroqWhisperProvider implements SttProvider {
  readonly name = 'groq';
  constructor(
    private readonly apiKey: string,
    readonly model = 'whisper-large-v3',
    private readonly baseUrl = 'https://api.groq.com/openai/v1',
  ) {}
  async transcribe(req: SttRequest): Promise<Transcript> {
    const started = Date.now();
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(req.audio)], { type: req.mime }), `answer.${extFor(req.mime)}`);
    form.append('model', this.model);
    form.append('response_format', 'json');
    if (req.languageHint === 'hi' || req.languageHint === 'hi-en') form.append('language', 'hi');
    const json = (await postForm(`${this.baseUrl}/audio/transcriptions`, { Authorization: `Bearer ${this.apiKey}` }, form)) as { text?: string };
    return { text: (json.text ?? '').trim(), confidence: null, language: null, audioSeconds: req.durationMs / 1000, provider: this.name, model: this.model, latencyMs: Date.now() - started };
  }
}

/** Sarvam AI Saarika (Indian STT, strong on Hindi/Hinglish). Production. */
export class SarvamProvider implements SttProvider {
  readonly name = 'sarvam';
  constructor(
    private readonly apiKey: string,
    readonly model = 'saarika:v2.5',
    private readonly baseUrl = 'https://api.sarvam.ai',
  ) {}
  async transcribe(req: SttRequest): Promise<Transcript> {
    const started = Date.now();
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(req.audio)], { type: req.mime }), `answer.${extFor(req.mime)}`);
    form.append('model', this.model);
    form.append('language_code', req.languageHint === 'en' ? 'en-IN' : req.languageHint === 'hi' ? 'hi-IN' : 'unknown');
    const json = (await postForm(`${this.baseUrl}/speech-to-text`, { 'api-subscription-key': this.apiKey }, form)) as { transcript?: string; language_code?: string };
    return { text: (json.transcript ?? '').trim(), confidence: null, language: json.language_code ?? null, audioSeconds: req.durationMs / 1000, provider: this.name, model: this.model, latencyMs: Date.now() - started };
  }
}

export function createSttProvider(cfg: { provider: SttProviderName; apiKey?: string; model?: string }): SttProvider {
  switch (cfg.provider) {
    case 'mock':
      return new MockSttProvider();
    case 'groq':
      if (!cfg.apiKey) throw new Error('STT_API_KEY is required for STT_PROVIDER=groq');
      return new GroqWhisperProvider(cfg.apiKey, cfg.model || undefined);
    case 'sarvam':
      if (!cfg.apiKey) throw new Error('STT_API_KEY is required for STT_PROVIDER=sarvam');
      return new SarvamProvider(cfg.apiKey, cfg.model || undefined);
  }
}

/** Rupees per audio minute (approximate list prices; free tiers 0). Used for the cost-per-summary view. */
const INR_PER_MINUTE: Record<string, number> = { mock: 0, groq: 0, sarvam: 0.5 };
export function sttCostInr(t: Pick<Transcript, 'provider' | 'audioSeconds'>): number {
  return Math.round(((INR_PER_MINUTE[t.provider] ?? 0) * t.audioSeconds) / 60 * 10_000) / 10_000;
}

/** Audio types we accept, by magic bytes (never by file name or client header). */
export function sniffAudio(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'audio/webm'; // EBML (WebM/Matroska)
  if (buf.subarray(0, 4).toString('ascii') === 'OggS') return 'audio/ogg';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WAVE') return 'audio/wav';
  if (buf.subarray(4, 8).toString('ascii') === 'ftyp') return 'audio/mp4'; // iOS Safari records MP4/AAC
  return null;
}
