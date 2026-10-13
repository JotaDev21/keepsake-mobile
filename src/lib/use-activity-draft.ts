import { useEffect, useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { activityRepo } from '@/db/activities';
import type { Drawing } from './activities-model';

export interface ActivityDraft { id: string; text: string; answer: string; drawing: Drawing; photoFile: string | null }
const emptyDraft = (): ActivityDraft => ({ id: randomUUID(), text: '', answer: '', drawing: [], photoFile: null });

export function useActivityDraft(key: string) {
  const [draft, setDraft] = useState<ActivityDraft>(emptyDraft);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const writes = useRef(Promise.resolve());
  const keyRef = useRef(key);
  const valueRef = useRef(draft);
  useEffect(() => {
    keyRef.current = key;
    setReady(false);
    let mounted = true;
    void writes.current.then(() => activityRepo.getDraft<ActivityDraft>(key)).then((value) => {
      if (!mounted) return;
      const next = value ?? emptyDraft();
      valueRef.current = next;
      setDraft(next); setReady(true); setError(null);
    }).catch(() => { if (mounted) setError('Não consegui abrir o rascunho. Volte e tente novamente.'); });
    return () => { mounted = false; };
  }, [key]);
  const update = (patch: Partial<ActivityDraft>) => {
    const next = { ...valueRef.current, ...patch };
    valueRef.current = next; setDraft(next);
    const scopedKey = keyRef.current;
    writes.current = writes.current.catch(() => {}).then(() => activityRepo.setDraft(scopedKey, next));
    void writes.current.then(() => setError(null)).catch(() => setError('Não consegui salvar o rascunho. Tente de novo antes de sair.'));
  };
  const flush = async () => { await writes.current; };
  const clear = async () => {
    await flush();
    const next = emptyDraft();
    await activityRepo.setDraft(keyRef.current, next);
    valueRef.current = next; setDraft(next);
  };
  return { draft, ready, error, update, flush, clear };
}
