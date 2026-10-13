import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';

import { BackButton, Button, Card, Chip, ScreenHeader, Text, TextField } from '@/components';
import { radius, spacing, useTheme } from '@/design';
import { activityRepo } from '@/db/activities';
import { projectActivities, type Activity } from '@/lib/activities-model';
import { pickActivityPhoto } from '@/lib/activity-media';
import { haptics } from '@/lib/haptics';
import { mediaUri } from '@/lib/media';
import { useActivityDraft } from '@/lib/use-activity-draft';
import { useActivityStore } from '@/stores/useActivityStore';
import { usePersonStore } from '@/stores/usePersonStore';
import { DrawingPad } from './drawing-pad';
import { WidgetSettings } from './widget-settings';

const COPY = {
  wish: { title: 'Ainda vamos viver', subtitle: 'Pequenas vontades. Grandes histórias pela frente.', placeholder: 'O que você quer viver com seu amor?', action: 'Compartilhar desejo', empty: 'Uma vontade pequena já é um começo.' },
  note: { title: 'Um pedacinho de mim', subtitle: 'Um bilhete para fazer companhia ao dia.', placeholder: 'Queria te dizer…', action: 'Enviar bilhete', empty: 'Deixe um carinho para chegar do outro lado.' },
  game: { title: 'Você desenha, eu descubro', subtitle: 'Sem pressa. Um desenho, um palpite, um sorriso.', placeholder: 'O que você vai desenhar?', action: 'Enviar desafio', empty: 'Vocês não precisam estar aqui ao mesmo tempo.' },
};

export function ActivityList({ type }: { type: Activity['type'] }) {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const events = useActivityStore((s) => s.events);
  const hydrated = useActivityStore((s) => s.hydrated);
  const error = useActivityStore((s) => s.error);
  const syncing = useActivityStore((s) => s.syncing);
  const coupleId = useActivityStore((s) => s.coupleId);
  const uid = useActivityStore((s) => s.uid);
  const personId = usePersonStore((s) => s.person?.id);
  const items = useMemo(() => projectActivities(events).filter((item) => item.type === type), [events, type]);
  // A local composer survives authentication hydration and later pairing.
  // Sharing still requires a new explicit press in the currently linked space.
  const draftKey = `compose:${personId}:${type}`;
  const { draft, update, ready, error: draftError, flush, clear } = useActivityDraft(draftKey);
  const [busy, setBusy] = useState(false);
  const [draw, setDraw] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'done'>('all');
  const copy = COPY[type];
  const content = type === 'wish' && filter !== 'all' ? items.filter((i) => i.done === (filter === 'done')) : items;
  const valid = type === 'game' ? draft.answer.trim().length > 0 && draft.drawing.length > 0
    : Boolean(draft.text.trim() || (type === 'note' && (draft.photoFile || draft.drawing.length)));
  const send = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await flush();
      if (type === 'game') await activityRepo.setDraft(`answer:${coupleId}:${uid}:${draft.id}`, draft.answer.trim());
      await useActivityStore.getState().send(type === 'wish' ? 'wish.create' : type === 'note' ? 'note.send' : 'game.start',
        type === 'game' ? { drawing: draft.drawing } : {
          ...(draft.text.trim() ? { text: draft.text.trim() } : {}),
          ...(type === 'note' && draft.photoFile ? { localFile: draft.photoFile } : {}),
          ...(type === 'note' && draft.drawing.length ? { drawing: draft.drawing } : {}),
        }, undefined, draft.id);
      await clear(); setDraw(false); haptics.success();
    } catch (e) { Alert.alert('Seu rascunho continua aqui', e instanceof Error ? e.message : 'Não consegui salvar agora. Tente novamente.'); }
    finally { setBusy(false); }
  };
  const photo = async () => {
    setBusy(true);
    try { const file = await pickActivityPhoto(); if (file) update({ photoFile: file }); }
    catch (e) { Alert.alert('Foto', e instanceof Error ? e.message : 'Não consegui abrir suas fotos.'); }
    finally { setBusy(false); }
  };
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <FlatList data={content} keyExtractor={(item) => item.id} keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + spacing.huge, paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xxl, gap: spacing.md }}
        refreshing={syncing} onRefresh={() => { void useActivityStore.getState().sync(); }}
        ListHeaderComponent={<View style={{ gap: spacing.xl, paddingBottom: spacing.md }}>
          <ScreenHeader overline={type === 'game' ? 'Brincar juntos' : 'Só de vocês'} title={copy.title} subtitle={copy.subtitle} />
          {error ? <Card style={{ gap: spacing.sm }}>
            <Text variant="caption" color="textSecondary">{error}</Text>
            <Button label="Tentar novamente" variant="ghost" size="sm" onPress={() => { void useActivityStore.getState().retry(); }} />
          </Card> : null}
          {!coupleId ? <Card style={{ gap: spacing.md }}>
            <Text variant="body">Seu rascunho é só seu. Conecte os dois perfis quando quiser compartilhar.</Text>
            <Button label="Conectar nossos perfis" variant="secondary" onPress={() => router.push('/conexao')} />
          </Card> : null}
          <Card featured style={{ gap: spacing.md }}>
            {type === 'game' ? <TextField label="Resposta secreta" placeholder={copy.placeholder} value={draft.answer}
              editable={ready && !busy} maxLength={100} onChangeText={(answer) => update({ answer })} />
              : <TextField label={type === 'wish' ? 'Nosso próximo capítulo' : 'Seu bilhete'} placeholder={copy.placeholder}
                value={draft.text} editable={ready && !busy} maxLength={type === 'wish' ? 200 : 2000} multiline onChangeText={(text) => update({ text })} />}
            {type === 'note' ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              <Button label="Foto" icon="camera" variant="secondary" size="sm" disabled={!ready || busy} onPress={() => { void photo(); }} />
              <Button label="Desenhar" icon="edit-3" variant="secondary" size="sm" disabled={!ready || busy} onPress={() => setDraw((v) => !v)} />
            </View> : null}
            {type === 'note' && draft.photoFile ? <View style={{ gap: spacing.sm }}>
              <Image source={mediaUri(draft.photoFile)} style={{ height: spacing.huge * 3, borderRadius: radius.md }} contentFit="cover" accessibilityLabel="Foto escolhida para o bilhete" />
              <Button label="Tirar foto do bilhete" variant="ghost" size="sm" onPress={() => update({ photoFile: null })} />
            </View> : null}
            {type === 'game' || (type === 'note' && (draw || draft.drawing.length > 0)) ? <DrawingPad value={draft.drawing} onChange={ready && !busy ? (drawing) => update({ drawing }) : undefined} /> : null}
            <Text variant="caption" color="textMuted">{type === 'game' ? 'A resposta fica neste aparelho até você revelar. O desenho só sai daqui ao enviar.' : 'Rascunho salvo neste aparelho. Só o botão abaixo compartilha o conteúdo.'}</Text>
            {draftError ? <Text variant="caption" color="accent">{draftError}</Text> : null}
            {!ready && !draftError ? <ActivityIndicator color={theme.colors.accent} /> : null}
            <Button label={copy.action} fullWidth loading={busy} disabled={!ready || !valid || !coupleId} onPress={() => { void send(); }} />
          </Card>
          {type === 'note' ? <WidgetSettings /> : null}
          {type === 'wish' ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <Chip label="Tudo" selected={filter === 'all'} onPress={() => setFilter('all')} />
            <Chip label="Por viver" selected={filter === 'open'} onPress={() => setFilter('open')} />
            <Chip label="Vividos" selected={filter === 'done'} onPress={() => setFilter('done')} />
          </View> : <Text variant="overline" color="textMuted">{type === 'game' ? 'Nossas rodadas' : 'Nossos bilhetes'}</Text>}
        </View>}
        ListEmptyComponent={!hydrated ? <ActivityIndicator color={theme.colors.accent} /> : <Text variant="serif" color="textSecondary">{items.length ? 'Nenhum desejo neste filtro.' : copy.empty}</Text>}
        renderItem={({ item }) => <Card onPress={() => router.push({ pathname: '/atividade/[id]', params: { id: item.id } })} style={{ gap: spacing.sm }}>
          <Text variant="overline" color="accent">{item.authorId === uid ? 'Você' : 'Seu amor'}{item.type === 'wish' && item.done ? ' · vivido' : ''}</Text>
          <Text variant="title2" numberOfLines={3}>{item.type === 'game' ? item.answer ? `Era ${item.answer}` : item.replies.length ? 'Tem palpite esperando por você' : 'O que esse desenho conta?'
            : item.payload.text || (item.payload.drawing ? 'Um carinho desenhado' : 'Um instante para você')}</Text>
          <Text variant="caption" color="textMuted">{item.failed ? 'Envio precisa de atenção' : item.pending ? 'Salvo aqui · envio pendente' : item.type === 'note' ? item.openedBy.length ? 'Aberto no app' : 'Enviado · abrir bilhete' : 'Abrir nossa história'}</Text>
        </Card>} />
      <BackButton />
    </KeyboardAvoidingView>
  );
}
