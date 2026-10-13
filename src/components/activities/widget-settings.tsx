import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { requestPinWidget } from 'react-native-android-widget';
import { Button, Card, Text } from '@/components';
import { spacing, useTheme } from '@/design';
import { useActivityStore } from '@/stores/useActivityStore';
import { refreshBilheteWidget, saveWidgetPreference, widgetPreference } from '@/widgets/bilhete-widget';

export function WidgetSettings() {
  const theme = useTheme();
  const uid = useActivityStore((s) => s.uid);
  const coupleId = useActivityStore((s) => s.coupleId);
  const [enabled, setEnabled] = useState(() => {
    const pref = widgetPreference(); return pref.enabled && pref.uid === uid && pref.coupleId === coupleId;
  });
  if (Platform.OS !== 'android') return null;
  const toggle = () => {
    const apply = (value: boolean) => {
      saveWidgetPreference({ enabled: value, uid, coupleId, accent: theme.colors.accent });
      setEnabled(value);
      void refreshBilheteWidget().catch(() => Alert.alert('Widget', 'Abra o app novamente para atualizar o widget.'));
    };
    if (enabled) apply(false);
    else Alert.alert('Mostrar bilhetes fora do app?', 'O último bilhete recebido pode aparecer na tela inicial. O bloqueio do Memory EV não esconde essa prévia.', [
      { text: 'Manter privado', style: 'cancel' }, { text: 'Permitir prévia', onPress: () => apply(true) },
    ]);
  };
  const pin = async () => {
    try { const accepted = await requestPinWidget({ widgetName: 'Bilhete' }); if (!accepted) Alert.alert('Adicionar widget', 'Toque e segure a tela inicial, abra Widgets e escolha memory ev.'); }
    catch { Alert.alert('Widget', 'Esta novidade precisa da versão atualizada do app.'); }
  };
  return <Card style={{ gap: spacing.md }}>
    <Text variant="title2">Seu amor na tela inicial</Text>
    <Text variant="caption" color="textSecondary">{enabled ? 'A prévia dos bilhetes recebidos está permitida neste aparelho.' : 'O conteúdo fica escondido até você permitir a prévia.'} Atualiza ao abrir o app e periodicamente em segundo plano; não confirma leitura.</Text>
    <View style={{ gap: spacing.sm }}>
      <Button label={enabled ? 'Esconder conteúdo do widget' : 'Permitir prévia no widget'} variant="secondary" disabled={!coupleId || !uid} onPress={toggle} />
      <Button label="Adicionar à tela inicial" variant="ghost" onPress={() => { void pin(); }} />
    </View>
  </Card>;
}
