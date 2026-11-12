import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MockLlmProvider } from '@medicos/ai';
import { BUILTIN_TEMPLATES } from '@medicos/ai';
import { CONSENT_VERSION, SAFETY_LINE, type IntakeView } from '@medicos/shared';
import { PrismaService } from '../src/config/core.module';
import { AiService } from '../src/intake/ai.service';
import { createTestApp, loginWithPhone, type TestApp } from './helpers';

let t: TestApp;
let prisma: PrismaService;
let mock: MockLlmProvider;

beforeAll(async () => {
  t = await createTestApp();
  prisma = t.app.get(PrismaService);
  // Templates are data; make sure the test DB has them.
  for (const tpl of BUILTIN_TEMPLATES) {
    await prisma.template.upsert({
      where: { key_version: { key: tpl.key, version: tpl.version } },
      update: {},
      create: { key: tpl.key, specialty: tpl.specialty, version: tpl.version, json: tpl as object, status: 'published' },
    });
  }
  mock = new MockLlmProvider();
  (t.app.get(AiService) as unknown as { provider: MockLlmProvider }).provider = mock;
});
afterAll(async () => {
  await t.app.close();
});

const NAME = 'Rahul Testkumar';

async function patientWithProfile() {
  const login = await loginWithPhone(t);
  await login.agent.post('/consents').send({ type: 'data_processing', version: CONSENT_VERSION, agreed: true });
  const profile = await login.agent
    .post('/patients/profiles')
    .send({ name: NAME, age: 28, gender: 'male', city: 'Indore', language: 'hi-Latn' });
  return { ...login, profile: profile.body as { id: string; medicosId: string } };
}

async function say(agent: Awaited<ReturnType<typeof patientWithProfile>>['agent'], id: string, text: string) {
  const res = await agent.post(`/intake/sessions/${id}/messages`).send({ text });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body as IntakeView;
}

describe('intake interview (mock provider)', () => {
  it('runs identity → consent → all planned questions → closing → submit', async () => {
    const { agent, profile } = await patientWithProfile();
    const start = await agent.post('/intake/sessions').send({ profileId: profile.id, templateKey: 'general-medicine' });
    expect(start.status).toBe(201);
    let view = start.body as IntakeView;
    expect(view.awaiting).toBe('identity');
    expect(view.messages[0]!.text).toContain('Rahul');

    view = await say(agent, view.id, 'Haan, main hi hoon');
    expect(view.awaiting).toBe('consent');
    view = await say(agent, view.id, 'Haan, shuru karein');
    expect(view.awaiting).toBe('answer');

    let guard = 0;
    while (view.awaiting === 'answer' && guard++ < 25) {
      view = await say(agent, view.id, 'bukhar hai 2 din se, gale mein kharash');
    }
    expect(view.awaiting).toBe('done');
    const questions = view.messages.filter((m) => m.kind === 'question');
    expect(questions.length).toBeGreaterThan(8);
    expect(questions.length).toBeLessThanOrEqual(20);
    expect(view.step).toBe(3);

    const review = await agent.get(`/intake/sessions/${view.id}/review`);
    expect(review.status).toBe(200);
    expect(review.body.items.length).toBe(questions.length);

    const submitted = await agent.post(`/intake/sessions/${view.id}/submit`);
    expect(submitted.body.status).toBe('submitted');
    expect((await agent.post(`/intake/sessions/${view.id}/messages`).send({ text: 'more' })).status).toBe(409);
  });

  it('stores messages encrypted and never sends identifiers to the provider (rule 11)', async () => {
    const { agent, profile, phone } = await patientWithProfile();
    const view = (await agent.post('/intake/sessions').send({ profileId: profile.id })).body as IntakeView;
    await say(agent, view.id, 'Haan');
    await say(agent, view.id, 'Haan');
    mock.calls.length = 0;
    await say(agent, view.id, `Main ${NAME} hoon, mera number ${phone.slice(3)} aur ID ${profile.medicosId}. Bukhar hai.`);
    const sent = JSON.stringify(mock.calls);
    expect(sent).toContain('Bukhar');
    expect(sent).not.toMatch(/rahul|testkumar/i);
    expect(sent).not.toContain(phone.slice(3));
    expect(sent).not.toContain(profile.medicosId);

    const rows = await prisma.intakeMessage.findMany({ where: { sessionId: view.id } });
    for (const r of rows) expect(r.textEnc).not.toMatch(/bukhar|rahul/i);
  });
});

describe('safety line (rule 4)', () => {
  it('shows the fixed line, logs a SafetyEvent, pauses until the patient continues', async () => {
    const { agent, profile } = await patientWithProfile();
    let view = (await agent.post('/intake/sessions').send({ profileId: profile.id })).body as IntakeView;
    view = await say(agent, view.id, 'Haan');
    view = await say(agent, view.id, 'Haan');
    const callsBefore = mock.calls.length;
    view = await say(agent, view.id, 'chalne par seene mein dard hota hai');

    expect(view.awaiting).toBe('safety_ack');
    expect(view.safetyLineShown).toBe(true);
    const safety = view.messages.at(-1)!;
    expect(safety.role).toBe('system');
    expect(safety.text).toBe(SAFETY_LINE.combined); // exact config text, not AI-written
    expect(mock.calls.length).toBe(callsBefore); // no model call before the patient chooses

    const events = await prisma.safetyEvent.findMany({ where: { sessionId: view.id } });
    expect(events).toHaveLength(1);
    expect(events[0]!.matchedTerms).toEqual(['chest_pain']);

    expect((await agent.post(`/intake/sessions/${view.id}/messages`).send({ text: 'x' })).status).toBe(409);
    const cont = await agent.post(`/intake/sessions/${view.id}/continue`);
    expect(cont.status).toBe(200);
    expect(cont.body.awaiting).toBe('answer');
  });
});

describe('output filter in the live flow (rule 6)', () => {
  it('blocks a bad model reply, logs rule ids only, and shows a clean question', async () => {
    const { agent, profile } = await patientWithProfile();
    let view = (await agent.post('/intake/sessions').send({ profileId: profile.id })).body as IntakeView;
    view = await say(agent, view.id, 'Haan');
    const bad = JSON.stringify({ message: 'Aapko typhoid hai, Dolo 650 mg lijiye.', section: 'x', done: false, quick_replies: [], question_id: 'chief_complaint' });
    (t.app.get(AiService) as unknown as { provider: MockLlmProvider }).provider = new MockLlmProvider([bad, bad, bad]);
    view = await say(agent, view.id, 'Haan');
    (t.app.get(AiService) as unknown as { provider: MockLlmProvider }).provider = mock;

    const q = view.messages.at(-1)!;
    expect(q.text).not.toMatch(/typhoid|dolo|mg|lijiye/i);
    const blocks = await prisma.filterBlockEvent.findMany({ where: { sessionId: view.id } });
    expect(blocks.map((b) => b.rule)).toEqual(expect.arrayContaining(['aapko_hai', 'drug_name', 'dosage', 'treatment_verb']));
    expect(JSON.stringify(blocks)).not.toMatch(/typhoid|dolo/i);
  });

  it('answers a medical question with the fixed redirect, never with advice', async () => {
    const { agent, profile } = await patientWithProfile();
    let view = (await agent.post('/intake/sessions').send({ profileId: profile.id })).body as IntakeView;
    view = await say(agent, view.id, 'Haan');
    view = await say(agent, view.id, 'Haan');
    view = await say(agent, view.id, 'mujhe kya hua hai? kaunsi dawa lu?');
    const redirect = view.messages.find((m) => m.kind === 'redirect');
    expect(redirect?.text).toContain('doctor sahab');
  });
});

describe('access control (rule 10)', () => {
  it("another patient cannot read or write someone else's interview", async () => {
    const a = await patientWithProfile();
    const view = (await a.agent.post('/intake/sessions').send({ profileId: a.profile.id })).body as IntakeView;
    const b = await patientWithProfile();
    expect((await b.agent.get(`/intake/sessions/${view.id}`)).status).toBe(404);
    expect((await b.agent.post(`/intake/sessions/${view.id}/messages`).send({ text: 'hi' })).status).toBe(404);
    expect((await b.agent.post('/intake/sessions').send({ profileId: a.profile.id })).status).toBe(404);
  });
});

describe('review edits and uploads', () => {
  it('lets the patient correct an answer; a corrected answer is safety-checked', async () => {
    const { agent, profile } = await patientWithProfile();
    let view = (await agent.post('/intake/sessions').send({ profileId: profile.id })).body as IntakeView;
    view = await say(agent, view.id, 'Haan');
    view = await say(agent, view.id, 'Haan');
    view = await say(agent, view.id, 'bukhar');
    const answer = view.messages.filter((m) => m.role === 'patient').at(-1)!;
    const res = await agent.patch(`/intake/sessions/${view.id}/answers/${answer.id}`).send({ text: 'bukhar aur behosh ho gaya tha' });
    expect(res.status).toBe(200);
    expect(res.body.safetyLine).toBe(SAFETY_LINE.combined);
    expect(res.body.items[0].answers[0].text).toContain('behosh');
  });

  it('rejects files whose content is not an image or PDF, accepts a real PNG', async () => {
    const { agent, profile } = await patientWithProfile();
    const view = (await agent.post('/intake/sessions').send({ profileId: profile.id })).body as IntakeView;
    const fake = await agent
      .post(`/intake/sessions/${view.id}/attachments`)
      .field('kind', 'report')
      .attach('file', Buffer.from('MZ this is an exe pretending'), { filename: 'report.png', contentType: 'image/png' });
    expect(fake.status).toBe(415);

    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );
    const ok = await agent.post(`/intake/sessions/${view.id}/attachments`).field('kind', 'report').attach('file', png, 'x.png');
    expect(ok.status, JSON.stringify(ok.body)).toBe(201);
    expect(ok.body.attachments).toHaveLength(1);
    expect(ok.body.attachments[0].mime).toBe('image/png');
    expect(ok.body.attachments[0].url).toMatch(/X-Amz-Expires=300/);
  });
});
