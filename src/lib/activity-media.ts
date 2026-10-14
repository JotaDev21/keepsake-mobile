import * as ImagePicker from 'expo-image-picker';
import { File, Paths } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import { ImageFormat, Skia, StrokeCap, StrokeJoin, PaintStyle } from '@shopify/react-native-skia';

import { getDb } from '@/db';
import { mediaRepo } from '@/db/repositories';
import { activityRepo } from '@/db/activities';
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
  // Provenance is local metadata, not a remote UUID. Keeping it separate lets
  // a person explicitly share this private copy later through the usual flow.
  const previousId = await activityRepo.getDraft<number>(reference);
  if (previousId && await mediaRepo.getById(previousId)) return previousId;
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
    const result: { id: number | null; created: boolean } = { id: null, created: false };
    await (await getDb()).withExclusiveTransactionAsync(async (tx) => {
      const marker = await tx.getFirstAsync<{ body: string }>('SELECT body FROM activity_draft WHERE key = ?', reference);
      const savedId: unknown = marker ? JSON.parse(marker.body) : null;
      if (typeof savedId === 'number') {
        const saved = await tx.getFirstAsync<{ id: number }>('SELECT id FROM media_item WHERE id = ? AND person_id = ?', savedId, personId);
        if (saved) { result.id = saved.id; return; }
      }
      const caption = activity.type === 'game' ? `Você desenha, eu descubro${activity.answer ? `: ${activity.answer}` : ''}`
        : payload.text ?? activity.payload.text ?? 'Uma lembrança nossa';
      const inserted = await tx.runAsync(`INSERT INTO media_item(person_id,tipo,file,thumb_file,legenda,data_memoria,local,criado_em,shared,remote_id)
        VALUES(?,'foto',?,NULL,?,?,NULL,?,0,NULL)`, personId, file, caption, activity.doneAt ?? activity.createdAt, Date.now());
      await tx.runAsync('INSERT INTO activity_draft(key,body) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET body=excluded.body', reference, JSON.stringify(inserted.lastInsertRowId));
      result.id = inserted.lastInsertRowId; result.created = true;
    });
    if (!result.created) { deleteMedia(file); file = null; }
    if (result.id == null) throw new Error('Não consegui guardar a lembrança agora.');
    await useMediaStore.getState().load(personId);
    return result.id;
  } catch (error) { if (file) deleteMedia(file); throw error; }
}
