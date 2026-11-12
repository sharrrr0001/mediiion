'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IntakeView, Language, VoiceDraft } from '@medicos/shared/client';
import { api, ApiError, post } from './api';

export const intakeKey = (id: string) => ['intake', id] as const;

export function useIntake(id: string) {
  return useQuery({ queryKey: intakeKey(id), queryFn: () => api<IntakeView>(`/intake/sessions/${id}`) });
}

/** All conversation actions return the fresh session view; we write it straight into the cache. */
export function useIntakeActions(id: string) {
  const qc = useQueryClient();
  const set = (v: IntakeView) => qc.setQueryData(intakeKey(id), v);
  const refetchOnError = () => qc.invalidateQueries({ queryKey: intakeKey(id) });

  const send = useMutation({
    mutationFn: ({ text, voiceId }: { text: string; voiceId?: string }) =>
      post<IntakeView>(`/intake/sessions/${id}/messages`, voiceId ? { text, voiceId } : { text }),
    onSuccess: set,
    onError: refetchOnError,
  });
  const cont = useMutation({ mutationFn: () => post<IntakeView>(`/intake/sessions/${id}/continue`), onSuccess: set, onError: refetchOnError });
  const retry = useMutation({ mutationFn: () => post<IntakeView>(`/intake/sessions/${id}/next`), onSuccess: set, onError: refetchOnError });
  const pause = useMutation({ mutationFn: () => post<IntakeView>(`/intake/sessions/${id}/pause`) });
  const language = useMutation({
    mutationFn: (lang: Language) => api<IntakeView>(`/intake/sessions/${id}/language`, { method: 'PATCH', body: JSON.stringify({ language: lang }) }),
    onSuccess: set,
  });
  const upload = useMutation({
    mutationFn: async ({ file, kind }: { file: File; kind: string }) => {
      // Loaded only when the patient actually uploads.
      const { compressForUpload } = await import('./compress-image');
      const blob = await compressForUpload(file);
      const form = new FormData();
      form.append('kind', kind);
      form.append('file', blob, file.name);
      const res = await fetch(`/api/intake/sessions/${id}/attachments`, { method: 'POST', body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new ApiError(res.status, body?.error?.code ?? 'ERROR', body?.error?.message ?? 'Upload failed');
      return body as IntakeView;
    },
    onSuccess: set,
  });
  const voice = useMutation({
    mutationFn: async ({ blob, durationMs }: { blob: Blob; durationMs: number }) => {
      const form = new FormData();
      form.append('durationMs', String(Math.round(durationMs)));
      form.append('audio', blob, 'answer');
      const res = await fetch(`/api/intake/sessions/${id}/voice`, { method: 'POST', body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new ApiError(res.status, body?.error?.code ?? 'ERROR', body?.error?.message ?? 'Voice failed');
      return body as VoiceDraft;
    },
  });
  return { send, cont, retry, pause, language, upload, voice };
}
