import { useMemo } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Icon, PressableScale, Text, type IconName } from '@/components';
import { spacing } from '@/design';
import { projectActivities } from '@/lib/activities-model';
import { useActivityStore } from '@/stores/useActivityStore';

export function HomeActivities() {
  const router = useRouter();
  const events = useActivityStore((s) => s.events);
  const uid = useActivityStore((s) => s.uid);
  const items = useMemo(() => projectActivities(events), [events]);
  const wishes = items.filter((i) => i.type === 'wish' && !i.done).length;
  const notes = items.filter((i) => i.type === 'note' && i.authorId !== uid && !i.openedBy.includes(uid ?? '')).length;
  const rounds = items.filter((i) => i.type === 'game' && !i.answer).length;
  const entries: { title: string; hint: string; icon: IconName; route: '/ainda-vamos-viver' | '/bilhetes' | '/desenhos' }[] = [
    { title: 'Ainda vamos viver', hint: wishes ? `${wishes} ${wishes === 1 ? 'desejo esperando' : 'desejos esperando'} por vocês` : 'O nosso próximo capítulo', icon: 'compass', route: '/ainda-vamos-viver' },
    { title: 'Deixar um bilhete', hint: notes ? `${notes} ${notes === 1 ? 'carinho chegou' : 'carinhos chegaram'} para você` : 'Texto, foto ou um carinho desenhado', icon: 'edit-3', route: '/bilhetes' },
    { title: 'Desenha para mim?', hint: rounds ? `${rounds} ${rounds === 1 ? 'rodada para descobrir' : 'rodadas para descobrir'}` : 'Um desenho. Um palpite. Um sorriso.', icon: 'feather', route: '/desenhos' },
  ];
  return <Card style={{ gap: spacing.xl }}>
    <Text variant="overline" color="accent">Mais um jeito de ficar perto</Text>
    {entries.map((entry) => <PressableScale key={entry.route} accessibilityLabel={entry.title} onPress={() => router.push(entry.route)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <Icon name={entry.icon} color="accent" size={spacing.xl} />
      <View style={{ flex: 1, gap: spacing.xs }}><Text variant="title2">{entry.title}</Text><Text variant="caption" color="textSecondary">{entry.hint}</Text></View>
      <Icon name="chevron-right" size={spacing.lg} color="textMuted" />
    </PressableScale>)}
  </Card>;
}
