import type { IntakeTemplate } from '@medicos/ai';
import type { IntakeAwaiting, IntakeMessageView, ReviewItem } from '@medicos/shared';

/** A decrypted intake message row. */
export interface DecryptedMessage {
  id: string;
  role: 'ai' | 'patient' | 'system';
  kind: string;
  text: string;
  questionId: string | null;
  step: number | null;
  quickReplies: string[];
  createdAt: Date;
}

/** Last AI message — tells us which stage the conversation is in. */
export function lastAiMessage(messages: DecryptedMessage[]): DecryptedMessage | undefined {
  return [...messages].reverse().find((m) => m.role === 'ai');
}

export function lastQuestion(messages: DecryptedMessage[]): DecryptedMessage | undefined {
  return [...messages].reverse().find((m) => m.role === 'ai' && m.kind === 'question');
}

export function deriveAwaiting(messages: DecryptedMessage[], status: string): IntakeAwaiting {
  if (status === 'submitted') return 'submitted';
  const last = messages[messages.length - 1];
  if (!last) return 'identity';
  if (last.role === 'system') return last.kind === 'safety' ? 'safety_ack' : 'ai_turn';
  if (last.role === 'patient') return 'ai_turn';
  switch (last.kind) {
    case 'identity':
      return 'identity';
    case 'consent':
      return 'consent';
    case 'closing':
      return 'done';
    default:
      return 'answer';
  }
}

export function currentStep(messages: DecryptedMessage[], awaiting: IntakeAwaiting): 1 | 2 | 3 {
  if (awaiting === 'done' || awaiting === 'submitted') return 3;
  const s = lastQuestion(messages)?.step;
  return s === 2 || s === 3 ? s : 1;
}

export function uploadHint(messages: DecryptedMessage[], template: IntakeTemplate) {
  const qid = lastQuestion(messages)?.questionId;
  return template.questions.find((q) => q.id === qid)?.upload ?? null;
}

export function toMessageView(m: DecryptedMessage): IntakeMessageView {
  return { id: m.id, role: m.role, kind: m.kind, text: m.text, quickReplies: m.quickReplies, createdAt: m.createdAt.toISOString() };
}

/**
 * "What you told us": each template question with the patient's answers to it (follow-ups included),
 * in plain words. Identity/consent stages are not part of the history.
 */
export function buildReview(messages: DecryptedMessage[], template: IntakeTemplate): ReviewItem[] {
  const items: ReviewItem[] = [];
  let current: ReviewItem | null = null;
  for (const m of messages) {
    if (m.role === 'ai' && m.kind === 'question' && m.questionId) {
      const existing = items.find((i) => i.questionId === m.questionId);
      if (existing) {
        current = existing; // follow-up on the same question
        continue;
      }
      const q = template.questions.find((x) => x.id === m.questionId);
      current = {
        questionId: m.questionId,
        section: q?.section ?? 'other',
        step: (q?.step ?? 1) as 1 | 2 | 3,
        question: m.text,
        answers: [],
      };
      items.push(current);
    } else if (m.role === 'ai' && m.kind !== 'redirect') {
      current = null;
    } else if (m.role === 'patient' && current) {
      current.answers.push({ messageId: m.id, text: m.text });
    }
  }
  return items.filter((i) => i.answers.length > 0);
}

/** "I'm answering for them" vs "it's me". */
export function detectAnsweredBy(text: string): 'self' | 'family' {
  return /(for them|someone else|for my|on behalf|taraf se|ki taraf|kisi aur|ke liye bhar|ओर से|किसी और|के लिए भर|beti hoon|beta hoon|patni|pati|maa ke|papa ke|mummy ke)/i.test(text)
    ? 'family'
    : 'self';
}
