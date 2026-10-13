import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';

import { enterRise } from '@/animations';
import { Icon, MemberAvatar, PressableScale, PulseCard, Screen, SunflowerMark, Text } from '@/components';
import { HomeMemory } from '@/components/home/HomeMemory';
import { HomeShortcut } from '@/components/home/HomeShortcut';
import { HomeActivities } from '@/components/home/home-activities';
import { radius, spacing, useTheme } from '@/design';
import { countdownLabel, dayAgeLabel, daysUntil, momentAgeLabel, presenceLabel } from '@/lib/dates';
import { formatLongDate, greetingForHour } from '@/lib/format';
import { mediaUri } from '@/lib/media';
import { memoryOfDay } from '@/lib/memory';
import { moodScale, startOfDay } from '@/lib/mood';
import { questionForDay } from '@/lib/questions';
import { useNow } from '@/lib/useNow';
import { useMediaStore } from '@/stores/useMediaStore';
import { useMoodStore } from '@/stores/useMoodStore';
import { usePersonStore } from '@/stores/usePersonStore';
import { useQuestionStore } from '@/stores/useQuestionStore';
import { useSyncStore } from '@/stores/useSyncStore';

const DAY = 86_400_000;
const moodLabel = (key: string) => moodScale.find((mood) => mood.key === key)?.label ?? key;

export default function HojeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 360 || fontScale > 1.25;
  const nowMs = useNow();
  const now = new Date(nowMs);
  const todayDay = startOfDay(now);
  const person = usePersonStore((s) => s.person);
  const dates = usePersonStore((s) => s.dates);
  const media = useMediaStore((s) => s.items);
  const loadMedia = useMediaStore((s) => s.load);
  const moodToday = useMoodStore((s) => s.today);
  const loadMood = useMoodStore((s) => s.load);
  const syncStatus = useSyncStore((s) => s.status);
  const paired = useSyncStore((s) => s.paired);
  const partnerJoined = useSyncStore((s) => s.partnerJoined);
  const partnerMood = useSyncStore((s) => s.partnerMood);
  const partnerDates = useSyncStore((s) => s.partnerDates);
  const myProfile = useSyncStore((s) => s.myProfile);
  const partnerProfile = useSyncStore((s) => s.partnerProfile);
  const myPulse = useSyncStore((s) => s.myPulse);
  const partnerPulse = useSyncStore((s) => s.partnerPulse);
  const myPulseSeenAt = useSyncStore((s) => s.myPulseSeenAt);
  const responseToMyPulse = useSyncStore((s) => s.responseToMyPulse);
  const myResponseToPartnerPulse = useSyncStore((s) => s.myResponseToPartnerPulse);
  const pushPulse = useSyncStore((s) => s.pushPulse);
  const respondToPulse = useSyncStore((s) => s.respondToPulse);
  const acknowledgePartnerPulse = useSyncStore((s) => s.acknowledgePartnerPulse);
  const lastNudgeAt = useSyncStore((s) => s.lastNudgeAt);
  const lastNudgeKind = useSyncStore((s) => s.lastNudgeKind);
  const partnerAnswer = useSyncStore((s) => s.partnerAnswer);
  const questionDay = useQuestionStore((s) => s.dia);
  const question = useQuestionStore((s) => s.pergunta);
  const myAnswer = useQuestionStore((s) => s.minhaResposta);
  const loadQuestion = useQuestionStore((s) => s.load);

  useEffect(() => {
    if (!person) return;
    void loadMedia(person.id);
    void loadMood(person.id);
  }, [loadMedia, loadMood, person, todayDay]);

  useEffect(() => {
    if (person) void loadQuestion(person.id);
  }, [loadQuestion, person, todayDay, syncStatus, partnerJoined]);

  useEffect(() => {
    if (partnerPulse) void acknowledgePartnerPulse();
  }, [acknowledgePartnerPulse, partnerPulse]);

  const memory = memoryOfDay(media, now);
  const partnerName = partnerProfile?.displayName?.trim() || person?.apelido || person?.nome || 'seu amor';
  const myName = myProfile?.displayName?.trim().split(/\s+/)[0];
  const partnerAvatar = partnerProfile?.avatarUrl || (person?.avatarFile ? mediaUri(person.avatarFile) : null);
  const todayMood = moodToday?.dia === todayDay ? moodToday : null;
  const partnerMoodFresh = partnerMood && todayDay - partnerMood.dia < 7 * DAY;
  const answered = questionDay === todayDay && myAnswer != null;
  const partnerAnswered = partnerJoined && partnerAnswer?.dia === todayDay;
  const prompt = questionDay === todayDay && question ? question : questionForDay(todayDay);
  const nudgeFresh = lastNudgeAt != null && nowMs - lastNudgeAt < DAY;

  // Recompute calendar-derived values after midnight, even with the tab mounted.
  const allDates = [...dates, ...partnerDates];
  const upcoming = allDates
    .filter((date) => date.recorrente || daysUntil(date.data, date.recorrente) >= 0)
    .sort((a, b) => daysUntil(a.data, a.recorrente) - daysUntil(b.data, b.recorrente))[0];
  const firstDate = allDates.filter((date) => date.tipo === 'primeiro_encontro')
    .map((date) => date.data).sort((a, b) => a - b)[0];
  const calendar = {
    upcoming,
    togetherDays: firstDate == null ? null : Math.max(0, Math.round((todayDay - startOfDay(new Date(firstDate))) / DAY)),
  };

  return (
    <Screen scroll contentContainerStyle={styles.page}>
      <Animated.View entering={enterRise(0)} style={styles.topbar}>
        <View style={styles.brand}>
          <SunflowerMark size={spacing.xl} color={theme.colors.sunflowerPetal} />
          <Text variant="serif">memory ev</Text>
        </View>
        <PressableScale onPress={() => router.push('/ajustes')} accessibilityLabel="Abrir ajustes"
          style={[styles.iconButton, { borderColor: theme.colors.border }]}>
          <Icon name="sliders" size={spacing.lg} color="textSecondary" />
        </PressableScale>
      </Animated.View>

      <Animated.View entering={enterRise(1)} style={styles.intro}>
        <Text variant="overline" color="textMuted">{formatLongDate(now)}</Text>
        <Text variant="hero" style={styles.greeting}>
          {greetingForHour(now.getHours())}{myName ? `, ${myName}` : ''}.
        </Text>
        <View style={styles.coupleRow}>
          <PressableScale onPress={() => router.push('/perfil')} accessibilityLabel={`Ver perfil de ${partnerName}`}
            style={styles.avatars}>
            <MemberAvatar name={myProfile?.displayName || 'Você'} uri={myProfile?.avatarUrl} size={spacing.xxl} />
            <View style={[styles.partnerAvatar, { borderColor: theme.colors.background }]}>
              <MemberAvatar name={partnerName} uri={partnerAvatar} size={spacing.xxl} />
            </View>
          </PressableScale>
          <Text variant="caption" color="textSecondary" style={styles.flex}>
            {calendar.togetherDays != null
              ? `${calendar.togetherDays.toLocaleString('pt-BR')} dias de uma história só de vocês.`
              : `Um cantinho seu e de ${partnerName}.`}
          </Text>
        </View>
      </Animated.View>

      <Animated.View entering={enterRise(2)}>
        <HomeMemory memory={memory} onPress={() => memory
          ? router.push({ pathname: '/memoria/[id]', params: { id: memory.id } })
          : router.push('/cofre')} />
      </Animated.View>

      <Animated.View entering={enterRise(3)} style={[styles.shortcuts, compact && styles.stack]}>
        <HomeShortcut icon="camera" label="Guardar" hint="uma memória" onPress={() => router.push('/cofre')} />
        <HomeShortcut icon="edit-3" label="Escrever" hint="uma carta" onPress={() => router.push('/cartas/escrever')} />
        <HomeShortcut icon="headphones" label="Ouvir" hint="nossa trilha" onPress={() => router.push('/musica')} />
      </Animated.View>

      <HomeActivities />

      {nudgeFresh ? (
        <View style={[styles.note, { backgroundColor: theme.colors.accentSoft }]}>
          <Icon name={lastNudgeKind === 'agua' ? 'droplet' : 'heart'} size={spacing.lg} color="accent" />
          <View style={styles.flex}>
            <Text variant="caption">
              {lastNudgeKind === 'agua' ? `${partnerName} lembrou você de beber água ${momentAgeLabel(lastNudgeAt)}.`
                : lastNudgeKind === 'checkin' ? `${partnerName} quer saber como você está.`
                  : `${partnerName} pensou em você ${momentAgeLabel(lastNudgeAt)}.`}
            </Text>
            {lastNudgeKind === 'checkin' ? (
              <PressableScale onPress={() => router.push('/humor')} style={styles.inlineAction}>
                <Text variant="subhead" color="accent">Contar como estou</Text>
                <Icon name="arrow-up-right" size={spacing.lg} color="accent" />
              </PressableScale>
            ) : null}
          </View>
        </View>
      ) : null}

      <Animated.View entering={enterRise(4)} style={styles.section}>
        <View style={styles.sectionHeading}>
          <Text variant="title1">Perto, mesmo de longe.</Text>
          <View style={[styles.hairline, { backgroundColor: theme.colors.border }]} />
        </View>
        {syncStatus === 'ready' && partnerJoined ? (
          <PulseCard partnerName={partnerName} partnerAvatarUrl={partnerAvatar}
            partnerPresenceLabel={presenceLabel(partnerProfile?.lastSeenAt ?? null, nowMs)}
            myPulse={myPulse} partnerPulse={partnerPulse} myPulseSeenAt={myPulseSeenAt}
            responseToMyPulse={responseToMyPulse} myResponseToPartnerPulse={myResponseToPartnerPulse}
            onSelect={(kind) => { void pushPulse(kind); }}
            onRespond={(kind) => { void respondToPulse(kind); }} />
        ) : (
          <PressableScale onPress={() => router.push('/conexao')}
            style={[styles.note, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: StyleSheet.hairlineWidth }]}>
            <Icon name="heart" color="accent" />
            <View style={styles.flex}>
              <Text variant="title2">{paired ? `Seu espaço com ${partnerName}` : 'Um espaço para dois'}</Text>
              <Text variant="caption" color="textSecondary">
                {paired ? 'Ver a conexão de vocês' : 'Conectem os celulares para trocar pequenos cuidados.'}
              </Text>
            </View>
            <Icon name="arrow-up-right" size={spacing.lg} color="accent" />
          </PressableScale>
        )}

        <PressableScale onPress={() => router.push('/humor')} accessibilityLabel="Abrir diário de humor"
          style={[styles.moodCard, { borderColor: theme.colors.border }]}>
          <View style={[styles.moodColumns, compact && styles.stack]}>
            <View style={styles.flex}>
              <Text variant="overline" color="textMuted">Seu clima hoje</Text>
              <Text variant="title2" style={styles.smallGap}>{todayMood ? moodLabel(todayMood.humor) : 'Como você está?'}</Text>
            </View>
            {partnerJoined ? (
              <View style={styles.flex}>
                <Text variant="overline" color="textMuted" numberOfLines={1}>{partnerName}</Text>
                <Text variant="title2" style={styles.smallGap}>
                  {partnerMoodFresh ? moodLabel(partnerMood.humor) : 'No seu tempo'}</Text>
                {partnerMoodFresh && partnerMood.dia !== todayDay ? (
                  <Text variant="caption" color="textMuted">{dayAgeLabel(partnerMood.dia)}</Text>
                ) : null}
              </View>
            ) : null}
          </View>
          <View style={styles.inlineAction}>
            <Text variant="caption" color="accent">{todayMood ? 'Visitar meu diário' : 'Registrar meu clima'}</Text>
            <Icon name="arrow-right" size={spacing.lg} color="accent" />
          </View>
        </PressableScale>
      </Animated.View>

      <Animated.View entering={enterRise(5)}>
        <PressableScale onPress={() => router.push('/pergunta')} accessibilityLabel={`Pergunta do dia: ${prompt}`}
          style={[styles.question, { backgroundColor: theme.colors.accentSoft, borderColor: theme.colors.accentEdge }]}>
          <View style={styles.questionTop}>
            <Text variant="overline" color="accent">Uma pergunta, dois olhares</Text>
            <Icon name="message-circle" size={spacing.xl} color="accent" />
          </View>
          <Text variant="title1">{prompt}</Text>
          <Text variant="caption" color="textSecondary">
            {answered && partnerAnswered ? 'As duas respostas já se encontraram.'
              : answered ? 'Sua resposta está guardada. Agora, no tempo do seu amor.'
                : partnerAnswered ? `${partnerName} já respondeu. Só falta o seu olhar.`
                  : 'Cada um responde. Vocês descobrem juntos.'}
          </Text>
          <View style={styles.questionBottom}>
            <Text variant="subhead" color="accent">{answered ? 'Ver nossas respostas' : 'Quero responder'}</Text>
            <View style={[styles.questionArrow, { backgroundColor: theme.colors.accent }]}>
              <Icon name="arrow-up-right" size={spacing.lg} color="onAccent" />
            </View>
          </View>
        </PressableScale>
      </Animated.View>

      <Animated.View entering={enterRise(6)} style={styles.section}>
        <Text variant="title1">Ainda temos tanto.</Text>
        <PressableScale onPress={() => router.push('/perfil')}
          style={[styles.dateRow, { borderColor: theme.colors.border }]}>
          <View style={[styles.dateIcon, { backgroundColor: theme.colors.surface }]}>
            <Icon name="calendar" color="accent" size={spacing.xl} />
          </View>
          <View style={styles.flex}>
            <Text variant="overline" color="textMuted">{calendar.upcoming ? 'O próximo capítulo' : 'Datas de vocês'}</Text>
            <Text variant="title2" style={styles.smallGap}>{calendar.upcoming?.titulo || 'O que vamos celebrar?'}</Text>
            <Text variant="caption" color="accent">
              {calendar.upcoming ? countdownLabel(calendar.upcoming.data, calendar.upcoming.recorrente) : 'Guardar uma data especial'}
            </Text>
          </View>
          <Icon name="chevron-right" size={spacing.lg} color="textMuted" />
        </PressableScale>
        <PressableScale onPress={() => router.push('/linha-do-tempo')} style={styles.historyLink}>
          <Icon name="clock" size={spacing.lg} color="textMuted" />
          <Text variant="caption" color="textSecondary" style={styles.flex}>Revisitar nossa história</Text>
          <Icon name="arrow-right" size={spacing.lg} color="textMuted" />
        </PressableScale>
      </Animated.View>
      <View style={styles.signature}>
        <SunflowerMark size={spacing.lg} color={theme.colors.sunflowerPetal} />
        <Text variant="quote" color="textMuted">O amor mora nos detalhes.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  page: { paddingHorizontal: spacing.xl, gap: spacing.xl },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconButton: { width: spacing.xxxl, height: spacing.xxxl, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
  intro: { gap: spacing.sm },
  greeting: { marginTop: spacing.xs },
  coupleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs },
  avatars: { flexDirection: 'row', alignItems: 'center', minHeight: spacing.xxxl },
  partnerAvatar: { marginLeft: -spacing.sm, borderWidth: spacing.xs / 2, borderRadius: radius.pill },
  shortcuts: { flexDirection: 'row', gap: spacing.sm },
  stack: { flexDirection: 'column' },
  note: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.md },
  section: { gap: spacing.lg, marginTop: spacing.sm },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, flexWrap: 'wrap' },
  hairline: { flex: 1, height: StyleSheet.hairlineWidth, minWidth: spacing.xl },
  moodCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.lg },
  moodColumns: { flexDirection: 'row', gap: spacing.xl },
  smallGap: { marginTop: spacing.xs },
  inlineAction: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: spacing.xxl },
  question: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: spacing.xl, gap: spacing.lg },
  questionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  questionBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  questionArrow: { width: spacing.xxl, height: spacing.xxl, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingBottom: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth },
  dateIcon: { width: spacing.huge, height: spacing.huge, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  historyLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: spacing.xxxl },
  signature: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
});
