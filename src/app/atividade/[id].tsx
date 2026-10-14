import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton, Button, Card, DatePickerField, ScreenHeader, Text, TextField } from '@/components';
import { ActivityPhoto } from '@/components/activities/activity-photo';
import { DrawingPad } from '@/components/activities/drawing-pad';
import { spacing, useTheme } from '@/design';
import { activityRepo } from '@/db/activities';
import { projectActivities, type ActivityKind, type ActivityPayload } from '@/lib/activities-model';
import { pickActivityPhoto, saveActivityMemory } from '@/lib/activity-media';
import { formatDate } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useActivityDraft } from '@/lib/use-activity-draft';
import { useActivityStore } from '@/stores/useActivityStore';
import { usePersonStore } from '@/stores/usePersonStore';

export default function ActivityDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const events = useActivityStore((s) => s.events);
  const hydrated = useActivityStore((s) => s.hydrated);
  const uid = useActivityStore((s) => s.uid);
  const coupleId = useActivityStore((s) => s.coupleId);
  const error = useActivityStore((s) => s.error);
  const personId = usePersonStore((s) => s.person?.id);
  const item = useMemo(() => projectActivities(events).find((i) => i.id === id), [events, id]);
  const own = item?.authorId === uid;
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [secretReady, setSecretReady] = useState(false);
  const [schedule, setSchedule] = useState(false);
  const [date, setDate] = useState(new Date());
  const { draft, update, ready, error: draftError, flush, clear } = useActivityDraft(`reply:${coupleId}:${uid}:${id}`);
  useEffect(() => {
    let mounted = true;
    setSecret(null); setSecretReady(false);
    if (own && item?.type === 'game') void activityRepo.getDraft<string>(`answer:${coupleId}:${uid}:${id}`)
      .then((answer) => { if (mounted) { setSecret(answer); setSecretReady(true); } })
      .catch(() => { if (mounted) setSecretReady(true); });
    return () => { mounted = false; };
  }, [own, item?.type, id, coupleId, uid]);
  const action = async (kind: ActivityKind, payload: ActivityPayload = {}) => {
    if (busy) return;
    setBusy(true);
    try { await useActivityStore.getState().send(kind, payload, id); haptics.success(); }
    catch (e) { Alert.alert('Não consegui salvar agora', e instanceof Error ? e.message : 'Tente novamente.'); }
    finally { setBusy(false); }
  };
  const reply = async () => {
    if (!item || busy) return;
    setBusy(true);
    try { await flush(); await useActivityStore.getState().send(item.type === 'game' ? 'game.guess' : 'note.reply', { text: draft.text.trim() }, id, draft.id); await clear(); haptics.success(); }
    catch (e) { Alert.alert('Seu texto continua aqui', e instanceof Error ? e.message : 'Tente novamente.'); }
    finally { setBusy(false); }
  };
  const addPhoto = async () => {
    if (busy) return;
    setBusy(true);
    try { const file = await pickActivityPhoto(); if (file) await useActivityStore.getState().send('wish.memory', { localFile: file, text: item?.payload.text }, id); }
    catch (e) { Alert.alert('Lembrança', e instanceof Error ? e.message : 'Não consegui salvar agora.'); }
    finally { setBusy(false); }
  };
  const keep = async () => {
    if (!personId || !coupleId || !item || busy) return;
    setBusy(true);
    try { const memoryId = await saveActivityMemory(personId, coupleId, item, theme); haptics.success(); router.push({ pathname: '/memoria/[id]', params: { id: memoryId } }); }
    catch (e) { Alert.alert('Guardar no cofre', e instanceof Error ? e.message : 'Não consegui guardar agora.'); }
    finally { setBusy(false); }
  };
  const reveal = () => {
    const answer = secret ?? draft.answer.trim();
    if (!answer) return;
    Alert.alert('Revelar a resposta?', 'A resposta ficará visível para vocês dois e esta rodada será encerrada.', [
      { text: 'Ainda não', style: 'cancel' }, { text: 'Revelar', onPress: () => { void action('game.reveal', { text: answer }); } },
    ]);
  };
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: theme.colors.background }}>
    <ScrollView keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingTop: insets.top + spacing.huge, paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xxl, gap: spacing.xl }}>
      {!hydrated ? <ActivityIndicator color={theme.colors.accent} /> : !item ? <>
        <ScreenHeader title="Essa história ainda não chegou" subtitle={coupleId ? 'Puxe a sincronização para tentar de novo.' : 'Conecte seu perfil para ver as atividades de vocês.'} />
        <Button label={coupleId ? 'Tentar novamente' : 'Conectar perfil'} onPress={() => coupleId ? void useActivityStore.getState().sync() : router.push('/conexao')} />
      </> : <>
        <ScreenHeader overline={own ? 'De você, para nós' : 'Do seu amor, para você'} title={item.type === 'wish' ? item.payload.text ?? 'Nosso desejo' : item.type === 'note' ? 'Um bilhete para ficar perto' : 'O que você vê aqui?'}
          subtitle={formatDate(new Date(item.createdAt))} />
        <Text variant="caption" color="textMuted">{item.failed ? 'Um envio precisa de atenção.' : item.pending ? 'Salvo neste aparelho · esperando conexão' : 'Sincronizado entre vocês'}</Text>
        {error ? <Text variant="caption" color="textSecondary">{error}</Text> : null}
        {item.failed ? <><Text variant="caption" color="accent">{events.find((e) => e.entityId === id && e.status === 'failed')?.error}</Text>
          <Button label="Tentar enviar de novo" variant="secondary" onPress={() => { void useActivityStore.getState().retry(); }} />
          {events.filter((e) => e.entityId === id && e.status === 'failed' && e.id !== e.entityId && e.authorId === uid).map((entry) =>
            <Button key={entry.id} label="Descartar tentativa que falhou" variant="ghost" onPress={() => Alert.alert('Descartar esta tentativa?', 'O conteúdo desta tentativa não enviada será removido deste aparelho.', [
              { text: 'Manter', style: 'cancel' }, { text: 'Descartar', style: 'destructive', onPress: () => { void useActivityStore.getState().discardFailedReply(entry.id).catch(() => Alert.alert('Tente novamente', 'Não consegui remover esta tentativa agora.')); } },
            ])} />)}
        </> : null}
        {item.type !== 'wish' && item.payload.text ? <Text variant="serif" selectable>{item.payload.text}</Text> : null}
        {item.payload.drawing ? <DrawingPad value={item.payload.drawing} /> : null}
        <ActivityPhoto payload={item.memory ?? item.payload} />
        {item.type === 'wish' ? <Card style={{ gap: spacing.md }}>
          <Text variant="overline" color="accent">{item.done ? 'Já faz parte da nossa história' : 'Ainda vamos viver'}</Text>
          <Text variant="body">{item.interested.length === 2 ? 'Vocês dois querem viver isso.' : item.interested.length === 1 ? 'Um de vocês já disse: eu topo.' : 'Que tal dizer: eu topo?'}</Text>
          {!item.done ? <>
            <Button label={uid && item.interested.includes(uid) ? 'Mudar meu interesse' : 'Eu topo'} variant="secondary" disabled={busy} onPress={() => { void action('wish.vote', { interested: !item.interested.includes(uid ?? '') }); }} />
            <Text variant="caption" color="textSecondary">{item.date ? `Combinado para ${formatDate(new Date(item.date))}` : 'Ainda sem data. Tudo bem.'}</Text>
            <Button label="Combinar uma data" variant="ghost" disabled={busy} onPress={() => { setDate(new Date(item.date ?? Date.now())); setSchedule(true); }} />
            {schedule ? <>
              <DatePickerField value={date} onChange={setDate} label="Quando vamos viver isso?" />
              <Button label="Salvar data" disabled={busy} onPress={() => { void action('wish.date', { date: date.getTime() }).then(() => setSchedule(false)); }} />
              {item.date ? <Button label="Deixar sem data" variant="ghost" disabled={busy} onPress={() => { void action('wish.date', { date: null }); setSchedule(false); }} /> : null}
            </> : null}
            <Button label="A gente viveu isso" icon="check" disabled={busy} onPress={() => { void action('wish.done'); }} />
          </> : item.memory ? <Button label="Guardar lembrança no cofre" loading={busy} onPress={() => { void keep(); }} />
            : <Button label="Compartilhar foto da lembrança" icon="camera" loading={busy} onPress={() => { void addPhoto(); }} />}
        </Card> : null}
        {item.type === 'note' && !own && !item.openedBy.includes(uid ?? '') ? <Button label="Dizer que li seu bilhete" disabled={busy} onPress={() => { void action('note.open'); }} /> : null}
        {item.type === 'note' ? <Text variant="caption" color="textSecondary">{item.openedBy.length ? own ? 'Seu amor confirmou a leitura.' : 'Você confirmou a leitura.' : 'A leitura é confirmada por quem recebe o bilhete.'}</Text> : null}
        {item.type === 'game' && item.answer ? <Card featured style={{ gap: spacing.md }}>
          <Text variant="overline" color="accent">Resposta revelada</Text><Text variant="display">{item.answer}</Text>
          <Button label="Guardar esta brincadeira" loading={busy} onPress={() => { void keep(); }} />
          <Button label="Começar outra rodada" variant="ghost" onPress={() => router.push('/desenhos')} />
        </Card> : null}
        {item.type === 'game' && own && !item.answer ? <Card style={{ gap: spacing.md }}>
          {!secretReady ? <ActivityIndicator color={theme.colors.accent} /> : secret ? <Text variant="caption" color="textMuted">Sua resposta secreta: {secret}</Text>
            : <TextField label="Resposta para revelar" value={draft.answer} editable={ready && !busy} onChangeText={(answer) => update({ answer })} maxLength={100}
              placeholder="O segredo não foi encontrado neste aparelho" />}
          <Text variant="body">{item.replies.length ? 'Seu amor deixou um palpite. Você escolhe quando revelar.' : 'Agora é a vez do seu amor. Pode voltar mais tarde.'}</Text>
          <Button label="Revelar resposta" disabled={busy || !secretReady || !(secret || draft.answer.trim())} onPress={reveal} />
        </Card> : null}
        {item.type !== 'wish' ? <View style={{ gap: spacing.md }}>
          <Text variant="overline" color="textMuted">{item.type === 'game' ? 'Palpites' : 'Nossa conversa'}</Text>
          {item.replies.map((entry) => <Card key={entry.id} style={{ gap: spacing.sm }}>
            <Text variant="caption" color="accent">{entry.authorId === uid ? 'Você' : 'Seu amor'}{entry.status !== 'sent' ? ' · envio pendente' : ''}</Text>
            <Text variant="body" selectable>{entry.payload.text}</Text>
          </Card>)}
          {item.type === 'note' || (!own && !item.answer) ? <>
            <TextField label={item.type === 'game' ? 'Seu palpite' : 'Responder bilhete'} value={draft.text} multiline maxLength={item.type === 'game' ? 100 : 2000}
              editable={ready && !busy} onChangeText={(text) => update({ text })} placeholder={item.type === 'game' ? 'Acho que é…' : 'Queria responder…'} />
            {draftError ? <Text variant="caption" color="accent">{draftError}</Text> : null}
            <Button label={item.type === 'game' ? 'Enviar palpite' : 'Enviar resposta'} loading={busy} disabled={!ready || !draft.text.trim()} onPress={() => { void reply(); }} />
          </> : null}
          {item.type === 'note' && (item.payload.drawing || item.payload.photoPath || item.payload.localFile) ? <Button label="Guardar bilhete no cofre" variant="secondary" loading={busy} onPress={() => { void keep(); }} /> : null}
        </View> : null}
      </>}
    </ScrollView><BackButton />
  </KeyboardAvoidingView>;
}
