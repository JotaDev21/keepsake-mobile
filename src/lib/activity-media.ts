import * as ImagePicker from 'expo-image-picker';
import { File, Paths } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import { ImageFormat, Skia, StrokeCap, StrokeJoin, PaintStyle } from '@shopify/react-native-skia';

import { getDb } from '@/db';
import { mediaRepo } from '@/db/repositories';
import { drawingPath } from '@/components/activities/drawing-pad';
import { spacing, type Theme } from '@/design';
import { ACTIVITY_BUCKET } from '@/stores/useActivityStore';
import { useMediaStore } from '@/stores/useMediaStore';
import type { Activity, ActivityPayload } from './activities-model';
import { deleteMedia, downloadMedia, mediaUri, saveMedia } from './media';
import { supabase } from './supabase';

export async function pickActivityPhoto(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Permita o acesso às fotos para escolher uma imagem.');
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.75, allowsEditing: false });
  if (result.canceled) return null;
  const mime = result.assets[0].mimeType ?? new File(result.assets[0].uri).type;
  if (mime && !['image/jpeg', 'image/png', 'image/webp'].includes(mime)) throw new Error('Escolha uma foto JPEG, PNG ou WebP para compartilhar.');
  if (new File(result.assets[0].uri).size > 10 * 1024 * 1024) throw new Error('Escolha uma foto de até 10 MB.');
  return saveMedia(result.assets[0].uri, 'jpg');
}

export async function activityPhotoUrl(payload: ActivityPayload): Promise<string | null> {
  if (payload.localFile) return mediaUri(payload.localFile);
  if (!payload.photoPath || !supabase) return null;
  const result = await supabase.storage.from(ACTIVITY_BUCKET).createSignedUrl(payload.photoPath, 3600);
  if (result.error) throw result.error;
  return result.data.signedUrl;
}

export async function saveActivityMemory(personId: number, coupleId: string, activity: Activity, theme: Theme): Promise<number> {
  const reference = `activity:${coupleId}:${activity.id}:${personId}`;
  const existing = await (await getDb()).getFirstAsync<{ id: number }>('SELECT id FROM media_item WHERE remote_id = ?', reference);
  if (existing) return existing.id;
  const payload = activity.memory ?? activity.payload;
  let file: string | null = null;
  try {
    if (payload.localFile) file = await saveMedia(mediaUri(payload.localFile), 'jpg');
    else if (payload.photoPath) {
      const url = await activityPhotoUrl(payload);
      if (!url) throw new Error('A foto ainda não chegou. Tente novamente depois da sincronização.');
      file = await downloadMedia(url, 'jpg');
    } else if (payload.drawing) {
      const size = spacing.huge * 12;
      const surface = Skia.Surface.MakeOffscreen(size, size);
      if (!surface) throw new Error('Não consegui guardar o desenho agora.');
      const canvas = surface.getCanvas();
      canvas.clear(Skia.Color(theme.colors.backgroundDeep));
      const paint = Skia.Paint();
      paint.setColor(Skia.Color(theme.colors.accent));
      paint.setStyle(PaintStyle.Stroke);
      paint.setStrokeWidth(spacing.sm);
      paint.setStrokeCap(StrokeCap.Round);
      paint.setStrokeJoin(StrokeJoin.Round);
      paint.setAntiAlias(true);
      canvas.drawPath(drawingPath(payload.drawing, size, size), paint);
      surface.flush();
      const bytes = surface.makeImageSnapshot().encodeToBytes(ImageFormat.PNG, 100);
      const temporary = new File(Paths.cache, `${randomUUID()}.png`);
      temporary.write(bytes);
      try { file = await saveMedia(temporary.uri, 'png'); } finally { temporary.delete(); }
      surface.dispose();
    } else throw new Error('Adicione uma foto para guardar esta lembrança no cofre.');
    const id = await mediaRepo.create({ personId, tipo: 'foto', file, thumbFile: null, legenda: activity.type === 'game'
      ? `Você desenha, eu descubro${activity.answer ? `: ${activity.answer}` : ''}` : payload.text ?? activity.payload.text ?? 'Uma lembrança nossa',
      dataMemoria: activity.doneAt ?? activity.createdAt, local: null, shared: false, remoteId: reference });
    await useMediaStore.getState().load(personId);
    return id;
  } catch (error) { if (file) deleteMedia(file); throw error; }
}
