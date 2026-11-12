import { afterEach, describe, expect, it, vi } from 'vitest';
import { GroqWhisperProvider, MockSttProvider, SarvamProvider, createSttProvider, sniffAudio, sttCostInr } from './index';

const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3]);

afterEach(() => vi.restoreAllMocks());

describe('STT providers', () => {
  it('mock returns the scripted Hinglish answer for each turn', async () => {
    const p = new MockSttProvider();
    expect((await p.transcribe({ audio: webm, mime: 'audio/webm', durationMs: 3000, sequence: 2 })).text).toMatch(/bukhar/);
    expect((await p.transcribe({ audio: webm, mime: 'audio/webm', durationMs: 3000, sequence: 99 })).text).toBe('Nahi');
  });

  it('groq sends multipart to the OpenAI-compatible endpoint with a bearer key', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ text: ' bukhar hai ' }), { status: 200 }));
    const out = await new GroqWhisperProvider('gk_test').transcribe({ audio: webm, mime: 'audio/webm', durationMs: 4000, languageHint: 'hi-en' });
    expect(out.text).toBe('bukhar hai');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://api.groq.com/openai/v1/audio/transcriptions');
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer gk_test');
    const form = init!.body as FormData;
    expect(form.get('model')).toBe('whisper-large-v3');
    expect(form.get('language')).toBe('hi');
  });

  it('sarvam sends the subscription key header and reads `transcript`', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ transcript: 'do din se', language_code: 'hi-IN' }), { status: 200 }));
    const out = await new SarvamProvider('sk_test').transcribe({ audio: webm, mime: 'audio/webm', durationMs: 2000 });
    expect(out).toMatchObject({ text: 'do din se', language: 'hi-IN', provider: 'sarvam' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://api.sarvam.ai/speech-to-text');
    expect((init!.headers as Record<string, string>)['api-subscription-key']).toBe('sk_test');
  });

  it('surfaces provider errors as status only (no body echo)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('secret prompt echo', { status: 500 }));
    await expect(new SarvamProvider('k').transcribe({ audio: webm, mime: 'audio/webm', durationMs: 1000 })).rejects.toThrow(/^STT provider HTTP 500$/);
  });

  it('requires keys for real providers', () => {
    expect(() => createSttProvider({ provider: 'groq' })).toThrow(/STT_API_KEY/);
    expect(createSttProvider({ provider: 'mock' }).name).toBe('mock');
  });

  it('sniffs audio by magic bytes and prices by the minute', () => {
    expect(sniffAudio(webm)).toBe('audio/webm');
    expect(sniffAudio(Buffer.from('OggS\0\0\0\0\0\0\0\0'))).toBe('audio/ogg');
    expect(sniffAudio(Buffer.from('MZ not audio at all'))).toBeNull();
    expect(sttCostInr({ provider: 'sarvam', audioSeconds: 120 })).toBe(1);
    expect(sttCostInr({ provider: 'mock', audioSeconds: 120 })).toBe(0);
  });
});
