import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { AI_DRAFT_LABEL, type RecordEntryView, type SharedSummaryView, type ShareLinkView } from '@medicos/shared';
import { PrismaService } from '../src/config/core.module';
import { finishInterview, patientWithProfile, seedTemplates } from './fixtures';
import { createTestApp, type TestApp } from './helpers';

let t: TestApp;
let prisma: PrismaService;

beforeAll(async () => {
  t = await createTestApp();
  prisma = t.app.get(PrismaService);
  await seedTemplates(prisma);
});
afterAll(async () => {
  await t.app.close();
});

describe('share a summary with a doctor not on Medicos', () => {
  it('creates a secret 72 h link, the link shows the AI-draft summary, the patient can stop it', async () => {
    const p = await patientWithProfile(t);
    await finishInterview(p.agent, p.profile.id);
    const entry = ((await p.agent.get('/records')).body as RecordEntryView[]).find((r) => r.kind === 'pre_visit_summary')!;

    const created = (await p.agent.post('/share-links').send({ recordId: entry.id })).body as ShareLinkView;
    expect(created.path).toMatch(/^\/s\/[A-Za-z0-9_-]{32}$/);
    const token = created.path!.slice(3);
    expect(await prisma.shareLink.count({ where: { tokenHash: token } })).toBe(0); // only an HMAC is stored

    const http = request(t.app.getHttpServer());
    const opened = (await http.get(`/shared/${token}`)).body as SharedSummaryView;
    expect(opened.aiLabel).toBe(AI_DRAFT_LABEL);
    expect(opened.patient.firstName).toBe('Ramesh');
    expect(JSON.stringify(opened.summary)).not.toContain('Testsingh'); // surname never shared
    expect(opened.summary).not.toHaveProperty('assessment');

    const list = (await p.agent.get(`/share-links/record/${entry.id}`)).body as ShareLinkView[];
    expect(list[0]).toMatchObject({ id: created.id, path: null, openCount: 1 });

    // Another patient cannot share or stop it.
    const other = await patientWithProfile(t, 'Sunita Testkumari');
    expect((await other.agent.post('/share-links').send({ recordId: entry.id })).status).toBe(404);
    expect((await other.agent.post(`/share-links/${created.id}/revoke`)).status).toBe(404);

    expect((await p.agent.post(`/share-links/${created.id}/revoke`)).status).toBe(200);
    expect((await http.get(`/shared/${token}`)).status).toBe(404);
    expect((await http.get('/shared/not-a-real-token-at-all-xx')).status).toBe(404);
    const audit = await prisma.auditLog.findMany({ where: { entityId: created.id }, select: { action: true } });
    expect(audit.map((a) => a.action)).toEqual(expect.arrayContaining(['share_link.create', 'share_link.open', 'share_link.revoke']));
  });
});
