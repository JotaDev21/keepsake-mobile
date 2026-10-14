import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import { FlexWidget, ImageWidget, SvgWidget, TextWidget, requestWidgetUpdate, type ColorProp, type WidgetTaskHandlerProps } from 'react-native-android-widget';
import { Storage } from 'expo-sqlite/kv-store';

import { createTheme, defaultTheme, radius, spacing, typography } from '@/design';
import { activityRepo } from '@/db/activities';
import type { ActivityEvent, ActivityPayload } from '@/lib/activities-model';
import { downloadMedia, mediaUri } from '@/lib/media';
import { supabase } from '@/lib/supabase';
import { fromRemoteActivity } from '@/stores/useActivityStore';

const PREF_KEY = 'bilhete-widget-prefs-v1';
interface WidgetPreference { enabled: boolean; uid: string | null; coupleId: string | null; accent: string }
export function widgetPreference(): WidgetPreference {
  try { return JSON.parse(Storage.getItemSync(PREF_KEY) ?? 'null') ?? { enabled: false, uid: null, coupleId: null, accent: defaultTheme.colors.accent }; }
  catch { return { enabled: false, uid: null, coupleId: null, accent: defaultTheme.colors.accent }; }
}
export function saveWidgetPreference(value: WidgetPreference) { Storage.setItemSync(PREF_KEY, JSON.stringify(value)); }

function drawingSvg(payload: ActivityPayload, accent: string): string {
  const size = spacing.huge * 4;
  const paths = (payload.drawing ?? []).map((stroke) => {
    const line = stroke.map((p, i) => `${i ? 'L' : 'M'}${(p.x * size).toFixed(2)},${(p.y * size).toFixed(2)}`).join(' ');
    const dot = stroke.length === 1 ? ` L${(stroke[0].x * size + 0.1).toFixed(2)},${(stroke[0].y * size + 0.1).toFixed(2)}` : '';
    return `<path d="${line}${dot}"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><g fill="none" stroke="${accent}" stroke-width="${spacing.xs}" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`;
}

async function widgetRequest<T>(request: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
  // RN 0.85 ships abort-controller, whose AbortSignal has no static timeout().
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try { return await request(controller.signal); } finally { clearTimeout(timeout); }
}

async function widgetContent(refresh: boolean) {
  const pref = widgetPreference();
  if (!pref.enabled || !pref.uid || !pref.coupleId || !supabase) return null;
  // Check the actual protected session on every refresh. Cached identities from
  // an old couple must never make a previous partner's note visible.
  const { data } = await supabase.auth.getSession();
  if (data.session?.user.id !== pref.uid) return null;
  const client = supabase;
  const membership = await widgetRequest((signal) => client.from('members').select('couple_id').eq('id', pref.uid).abortSignal(signal).maybeSingle());
  if (!membership.error && membership.data?.couple_id !== pref.coupleId) return null;
  const key = `widget-note:${pref.coupleId}:${pref.uid}`;
  let note = await activityRepo.getDraft<ActivityEvent>(key);
  if (refresh && !membership.error) {
    const response = await widgetRequest((signal) => client.from('couple_activity_events').select('*').eq('couple_id', pref.coupleId!)
      .eq('kind', 'note.send').neq('author_id', pref.uid!).order('sequence', { ascending: false }).limit(1).abortSignal(signal));
    if (!response.error) {
      note = response.data[0] ? fromRemoteActivity(response.data[0]) : null;
      await activityRepo.setDraft(key, note);
    }
  }
  if (!note) return null;
  let image: `data:image${string}` | undefined;
  if (note.payload.photoPath) {
    const photoKey = `photo-cache:${note.payload.photoPath}`;
    let cached = await activityRepo.getDraft<string>(photoKey);
    if ((!cached || !new File(mediaUri(cached)).exists) && refresh) {
      const signed = await supabase.storage.from('couple-activity-media').createSignedUrl(note.payload.photoPath, 3600);
      if (signed.data?.signedUrl) {
        cached = await downloadMedia(signed.data.signedUrl, 'jpg').catch(() => null);
        if (cached) await activityRepo.setDraft(photoKey, cached);
      }
    }
    if (cached) {
      const file = new File(mediaUri(cached));
      if (file.exists) image = `data:image/jpeg;base64,${await file.base64()}`;
    }
  }
  const current = widgetPreference();
  if (!current.enabled || current.uid !== pref.uid || current.coupleId !== pref.coupleId) return null;
  return { note, image };
}

async function renderNote(width: number, height: number, refresh: boolean) {
  const pref = widgetPreference();
  const theme = createTheme(pref.accent, 'noite');
  const content = await widgetContent(refresh).catch(() => null);
  const note = content?.note;
  return <FlexWidget style={{ width: 'match_parent', height: 'match_parent', backgroundColor: theme.colors.background as ColorProp,
    borderRadius: radius.lg, padding: spacing.lg, flexGap: spacing.sm }} clickAction="OPEN_URI" clickActionData={{ uri: note ? `ev://atividade/${note.entityId}` : 'ev://bilhetes' }}
    accessibilityLabel={note ? 'Bilhete do seu amor. Toque para abrir no memory ev.' : 'memory ev. Toque para abrir seus bilhetes.'}>
    <TextWidget text="memory ev · um bilhete para você" maxLines={1} style={{ color: theme.colors.accent as ColorProp, fontSize: typography.caption.fontSize }} />
    {note?.payload.drawing && height >= spacing.huge * 3 ? <SvgWidget svg={drawingSvg(note.payload, theme.colors.accent)}
      style={{ width: Math.min(width - spacing.xxl, spacing.huge * 2), height: spacing.huge * 2 }} /> : null}
    {content?.image && height >= spacing.huge * 3 ? <ImageWidget image={content.image} imageWidth={Math.max(spacing.huge, width - spacing.xxl)} imageHeight={spacing.huge * 2} radius={radius.md} resizeMode="cover" /> : null}
    <TextWidget text={note ? note.payload.text || (note.payload.drawing ? 'Um carinho desenhado. Abra para ver.' : 'Uma foto para fazer companhia. Abra para ver.')
      : pref.enabled ? 'Seu próximo carinho chega aqui.' : 'Abra os bilhetes no app para permitir a prévia aqui.'}
      maxLines={height >= spacing.huge * 3 ? 3 : 2} style={{ color: theme.colors.text as ColorProp, fontSize: typography.body.fontSize }} />
  </FlexWidget>;
}

export async function refreshBilheteWidget() {
  if (Platform.OS !== 'android') return;
  await requestWidgetUpdate({ widgetName: 'Bilhete', renderWidget: (info) => renderNote(info.width, info.height, true) });
}
export async function bilheteWidgetTask(props: WidgetTaskHandlerProps) {
  if (props.widgetAction === 'WIDGET_DELETED') return;
  await props.renderWidget(await renderNote(props.widgetInfo.width, props.widgetInfo.height, true));
}
