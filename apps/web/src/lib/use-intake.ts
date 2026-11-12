'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IntakeView, Language } from '@medicos/shared/client';
import { api, ApiError, post } from './api';
import { compressForUpload } from './compress-image';

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
    mutationFn: (text: string) => post<IntakeView>(`/intake/sessions/${id}/messages`, { text }),
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
  return { send, cont, retry, pause, language, upload };
}
