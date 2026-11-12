import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Language } from '@medicos/shared';
import type { LlmMessage } from '../types';
import type { TemplateQuestion } from '../templates/schema';

export const INTAKE_PROMPT_VERSION = 'intake-v1';

let cached: string | null = null;
function rawPrompt(): string {
  // Works from both src/ (tests) and dist/ (runtime): prompts/ sits next to both.
  cached ??= readFileSync(join(__dirname, '..', '..', 'prompts', 'intake.md'), 'utf8').replace(/<!--[\s\S]*?-->\s*/, '');
  return cached;
}

export interface PromptContext {
  clinicName?: string;
  doctorName?: string;
  specialty: string;
}

/** Stable per clinic/doctor/specialty → cacheable. Never contains patient data. */
export function buildSystemPrompt(ctx: PromptContext): string {
  return rawPrompt()
    .replace('{{clinic_name}}', ctx.clinicName ?? 'the clinic')
    .replace('{{doctor_name}}', ctx.doctorName ? `Dr. ${ctx.doctorName.replace(/^Dr\.?\s*/i, '')}` : 'the doctor')
    .replace('{{specialty}}', ctx.specialty);
}

export interface TranscriptItem {
  role: 'ai' | 'patient' | 'system';
  /** Already de-identified. */
  text: string;
}

const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'en (simple English)',
  hi: 'hi (Hindi, Devanagari script)',
  'hi-Latn': 'hi-Latn (Hinglish, Roman script)',
};

/**
 * Model messages: the de-identified transcript (system rows excluded), then the [ENGINE] plan line.
 * Consecutive same-role rows are merged; a placeholder user turn is added if the transcript starts
 * with the assistant, as the Messages API requires a user turn first.
 */
export function buildMessages(
  transcript: TranscriptItem[],
  plan: { question: TemplateQuestion; previous: TemplateQuestion | null; language: Language; medicalQuestion: boolean },
  rejection?: string[],
): LlmMessage[] {
  const msgs: LlmMessage[] = [];
  for (const item of transcript) {
    if (item.role === 'system') continue;
    const role = item.role === 'ai' ? 'assistant' : 'user';
    const last = msgs[msgs.length - 1];
    if (last && last.role === role) last.content += `\n${item.text}`;
    else msgs.push({ role, content: item.text });
  }
  if (msgs[0]?.role !== 'user') msgs.unshift({ role: 'user', content: '(The patient opened the pre-visit interview.)' });

  const q = plan.question;
  const lines = [
    `[ENGINE] Language: ${LANGUAGE_NAMES[plan.language]}.`,
    `Planned next question (question_id "${q.id}", section "${q.section}"): "${q.text.en}"`,
  ];
  if (plan.previous) {
    lines.push(
      `Previous question was "${plan.previous.id}"${plan.previous.lookFor ? ` (look for: ${plan.previous.lookFor})` : ''}. Follow up on it only if the answer was unclear.`,
    );
  }
  if (plan.medicalQuestion) lines.push('The patient asked a medical question; it has been noted for the doctor. Do not answer it.');
  if (rejection?.length) {
    lines.push(
      `Your previous draft was rejected by the safety filter (${rejection.join(', ')}). Rewrite it: no medicine or condition names, no doses, no advice or instructions, no reassurance. Plain words only.`,
    );
  }
  lines.push('Reply with the JSON object only.');

  const engine = lines.join('\n');
  const last = msgs[msgs.length - 1]!;
  if (last.role === 'user') last.content += `\n\n${engine}`;
  else msgs.push({ role: 'user', content: engine });
  return msgs;
}
