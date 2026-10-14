import { create } from 'zustand';
import { randomUUID } from 'expo-crypto';
import { File } from 'expo-file-system';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { activityRepo } from '@/db/activities';
import { validateDrawing, type ActivityEvent, type ActivityKind, type ActivityPayload } from '@/lib/activities-model';
import { mediaUri } from '@/lib/media';
import { supabase } from '@/lib/supabase';

export const ACTIVITY_BUCKET = 'couple-activity-media';
interface RemoteEvent {
  id: string; couple_id: string; author_id: string; entity_id: string;
  kind: ActivityKind; payload: ActivityPayload; created_at: string; sequence: number;
}
export const fromRemoteActivity = (row: RemoteEvent): ActivityEvent => ({
  id: row.id, coupleId: row.couple_id, authorId: row.author_id, entityId: row.entity_id,
  kind: row.kind, payload: row.payload, createdAt: new Date(row.created_at).getTime(), sequence: row.sequence, status: 'sent',
});

interface ActivityState {
  coupleId: string | null;
  uid: string | null;
  events: ActivityEvent[];
  hydrated: boolean;
  syncing: boolean;
  error: string | null;
  connect: (coupleId: string | null, uid: string | null) => Promise<void>;
  sync: () => Promise<void>;
  send: (kind: ActivityKind, payload: ActivityPayload, entityId?: string, id?: string) => Promise<string>;
  retry: (id?: string) => Promise<void>;
  discardFailedReply: (id: string) => Promise<void>;
}
let channel: RealtimeChannel | null = null;
let generation = 0;
let running: Promise<void> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelay = 2000;
let refreshRequested = false;

export const useActivityStore = create<ActivityState>((set, get) => ({
  coupleId: null, uid: null, events: [], hydrated: false, syncing: false, error: null,
  connect: async (coupleId, uid) => {
    if (get().coupleId === coupleId && get().uid === uid && get().hydrated) {
      await get().sync();
      return;
    }
    const current = ++generation;
    if (retryTimer) clearTimeout(retryTimer);
    const previousChannel = channel;
    channel = null;
    set({ coupleId, uid, events: [], hydrated: false, syncing: false, error: null });
    if (previousChannel && supabase) await supabase.removeChannel(previousChannel);
    if (current !== generation) return;
    if (!coupleId || !uid) { set({ hydrated: true }); return; }
    try {
      const events = await activityRepo.list(coupleId, uid);
      if (current !== generation) return;
      set({ events, hydrated: true });
      if (supabase) channel = supabase.channel(`activities:${coupleId}:${current}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'couple_activity_events', filter: `couple_id=eq.${coupleId}` }, () => {
          void get().sync();
        }).subscribe((status) => { if (status === 'SUBSCRIBED') void get().sync(); });
      await get().sync();
    } catch {
      if (current === generation) set({ hydrated: true, error: 'Não consegui abrir as atividades salvas. Tente novamente.' });
    }
  },
  send: async (kind, payload, entityId, requestedId) => {
    if (payload.drawing && !validateDrawing(payload.drawing)) throw new Error('Este desenho passou do limite de traços. Desfaça um traço antes de enviar.');
    const { coupleId, uid, hydrated } = get();
    if (!coupleId || !uid || !hydrated) throw new Error('Conecte os dois perfis antes de enviar. Seu rascunho continua aqui.');
    const current = generation;
    const id = requestedId ?? randomUUID();
    const event: ActivityEvent = { id, coupleId, authorId: uid, entityId: entityId ?? id,
      kind, payload, createdAt: Date.now(), sequence: 0, status: 'pending' };
    await activityRepo.save(uid, event);
    if (current === generation) {
      set({ events: [...get().events.filter((e) => e.id !== id), event] });
      void get().sync();
    }
    return id;
  },
  retry: async (id) => {
    const { uid } = get();
    if (!uid) return;
    for (const event of get().events.filter((e) => e.status === 'failed' && (!id || e.id === id))) {
      const next = { ...event, status: 'pending' as const, error: undefined };
      await activityRepo.save(uid, next);
      set({ events: get().events.map((e) => e.id === next.id ? next : e) });
    }
    await get().sync();
  },
  discardFailedReply: async (id) => {
    const { uid } = get();
    const event = get().events.find((e) => e.id === id);
    if (!uid || !event || event.status !== 'failed' || event.authorId !== uid || event.id === event.entityId) return;
    await activityRepo.remove(uid, id);
    set({ events: get().events.filter((e) => e.id !== id) });
  },
  sync: async () => {
    if (running) { refreshRequested = true; await running; return; }
    const { coupleId, uid, hydrated } = get();
    if (!coupleId || !uid || !supabase || !hydrated) return;
    const client = supabase;
    const current = generation;
    const isCurrent = () => current === generation;
    set({ syncing: true });
    running = (async () => {
      try {
        const session = await client.auth.getSession();
        if (session.data.session?.user.id !== uid) throw new Error('Entre no seu perfil para retomar os envios.');
        for (const queued of get().events.filter((e) => e.status === 'pending')) {
          if (!isCurrent()) return;
          const failedParent = get().events.some((e) => e.entityId === queued.entityId && e.id === e.entityId && e.status === 'failed');
          if (failedParent && queued.id !== queued.entityId) continue;
          let event = queued;
          if (event.payload.localFile && !event.payload.photoPath) {
            const file = new File(mediaUri(event.payload.localFile));
            if (!file.exists || file.size > 10 * 1024 * 1024) {
              event = { ...event, status: 'failed', error: 'Escolha uma foto de até 10 MB.' };
              await activityRepo.save(uid, event);
              if (isCurrent()) set({ events: get().events.map((e) => e.id === event.id ? event : e) });
              continue;
            }
            const path = `${uid}/${event.id}/photo.jpg`;
            const upload = await client.storage.from(ACTIVITY_BUCKET).upload(path, await file.arrayBuffer(), { contentType: file.type || 'image/jpeg', upsert: true });
            if (upload.error) throw upload.error;
            event = { ...event, payload: { ...event.payload, photoPath: path } };
            await activityRepo.save(uid, event);
            if (!isCurrent()) return;
            set({ events: get().events.map((e) => e.id === event.id ? event : e) });
          }
          const { localFile: _localFile, ...sharedPayload } = event.payload;
          const response = await client.rpc('publish_couple_activity', { event: {
            id: event.id, coupleId, entityId: event.entityId, kind: event.kind, payload: sharedPayload,
          } }).single();
          if (response.error) {
            // A rejected parent blocks its children. Preserve everything for a
            // deliberate retry instead of silently removing an offline draft.
            if (['22023', '42501', '23505', '23514', '23502', '54000'].includes(response.error.code)) {
              const failed: ActivityEvent = { ...event, status: 'failed', error: response.error.message };
              await activityRepo.save(uid, failed);
              if (isCurrent()) set({ events: get().events.map((e) => e.id === event.id ? failed : e) });
            }
            throw response.error;
          }
          const sent = fromRemoteActivity(response.data as RemoteEvent);
          // Notifications are best effort. A push failure never rolls back a
          // saved activity or changes its delivery/read status.
          void client.functions.invoke('activities', { body: { eventId: sent.id } }).catch(() => {});
          if (event.payload.localFile) sent.payload.localFile = event.payload.localFile;
          await activityRepo.save(uid, sent);
          if (sent.id !== event.id) await activityRepo.remove(uid, event.id);
          if (!isCurrent()) return;
          set({ events: [...get().events.filter((e) => e.id !== event.id && e.id !== sent.id), sent] });
        }
        let after = 0;
        while (isCurrent()) {
          const response = await client.from('couple_activity_events').select('*').eq('couple_id', coupleId)
            .gt('sequence', after).order('sequence').limit(200);
          if (response.error) throw response.error;
          const rows = response.data as RemoteEvent[];
          const cachedById = new Map(get().events.map((event) => [event.id, event]));
          const page: ActivityEvent[] = [];
          for (const row of rows) {
            const event = fromRemoteActivity(row);
            const local = cachedById.get(event.id);
            if (local?.payload.localFile) event.payload.localFile = local.payload.localFile;
            await activityRepo.save(uid, event);
            if (!isCurrent()) return;
            page.push(event);
          }
          // Preserve new offline sends made during this fetch and publish one
          // state update per page instead of rerendering the whole history per row.
          const merged = new Map(get().events.map((event) => [event.id, event]));
          for (const event of page) merged.set(event.id, event);
          if (page.length && isCurrent()) set({ events: [...merged.values()] });
          if (rows.length < 200) break;
          after = rows[rows.length - 1].sequence;
        }
        if (isCurrent()) { set({ error: null }); retryDelay = 2000; }
      } catch (error) {
        if (!isCurrent()) return;
        const code = (error as { code?: string }).code;
        set({ error: code === 'PGRST202' || code === '42P01'
          ? 'O servidor ainda precisa receber esta atualização. Os envios estão salvos neste aparelho.'
          : code && ['22023', '42501', '23505', '23514', '23502', '54000'].includes(code)
          ? 'Um envio precisa de atenção. Abra a atividade para conferir.'
          : 'Sem conexão agora. Seus envios estão salvos; vou tentar novamente.' });
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = setTimeout(() => { void get().sync(); }, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 60000);
      } finally {
        if (isCurrent()) set({ syncing: false });
      }
    })();
    await running;
    running = null;
    if (refreshRequested) { refreshRequested = false; void get().sync(); }
  },
}));
