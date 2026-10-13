import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Image } from 'expo-image';
import { Button, Text } from '@/components';
import { radius, spacing, useTheme } from '@/design';
import { activityPhotoUrl } from '@/lib/activity-media';
import type { ActivityPayload } from '@/lib/activities-model';
import { activityRepo } from '@/db/activities';
import { downloadMedia, mediaExists, mediaUri } from '@/lib/media';

export function ActivityPhoto({ payload }: { payload: ActivityPayload }) {
  const theme = useTheme();
  const [uri, setUri] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const { localFile, photoPath } = payload;
  useEffect(() => {
    let mounted = true;
    setUri(null); setError(false);
    void (async () => {
      if (localFile) return mediaUri(localFile);
      const key = `photo-cache:${photoPath}`;
      const cached = await activityRepo.getDraft<string>(key);
      if (cached && mediaExists(cached)) return mediaUri(cached);
      const url = await activityPhotoUrl({ photoPath });
      if (!url) throw new Error('Foto indisponível');
      const file = await downloadMedia(url, 'jpg');
      await activityRepo.setDraft(key, file);
      return mediaUri(file);
    })().then((value) => { if (mounted) setUri(value); }).catch(() => { if (mounted) setError(true); });
    return () => { mounted = false; };
  }, [localFile, photoPath, attempt]);
  if (!payload.localFile && !payload.photoPath) return null;
  return <View style={{ gap: spacing.sm }}>
    {uri ? <Image source={uri} contentFit="contain" accessibilityLabel="Foto compartilhada nesta atividade"
      style={{ height: spacing.huge * 4, borderRadius: radius.md, backgroundColor: theme.colors.backgroundDeep }} />
      : error ? <><Text variant="caption" color="textMuted">A foto ainda não chegou neste aparelho.</Text>
        <Button label="Carregar foto" variant="ghost" size="sm" onPress={() => setAttempt((v) => v + 1)} /></>
        : <ActivityIndicator color={theme.colors.accent} />}
  </View>;
}
