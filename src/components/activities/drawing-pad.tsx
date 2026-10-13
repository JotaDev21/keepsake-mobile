import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Button, Text } from '@/components';
import { radius, spacing, useTheme } from '@/design';
import type { Drawing, Point } from '@/lib/activities-model';

export const DRAWING_SIZE = spacing.huge * 4;
export function drawingPath(drawing: Drawing, width: number, height: number) {
  'worklet';
  const builder = Skia.PathBuilder.Make();
  for (const stroke of drawing) {
    if (!stroke.length) continue;
    builder.moveTo(stroke[0].x * width, stroke[0].y * height);
    if (stroke.length === 1) builder.lineTo(stroke[0].x * width + 0.1, stroke[0].y * height + 0.1);
    for (const point of stroke.slice(1)) builder.lineTo(point.x * width, point.y * height);
  }
  return builder.build();
}

export function DrawingPad({ value, onChange }: { value: Drawing; onChange?: (value: Drawing) => void }) {
  const theme = useTheme();
  const width = useSharedValue(DRAWING_SIZE);
  const [layoutWidth, setLayoutWidth] = useState<number>(DRAWING_SIZE);
  const active = useSharedValue<Point[]>([]);
  const activePath = useSharedValue(Skia.PathBuilder.Make().build());
  const points = value.reduce((sum, stroke) => sum + stroke.length, 0);
  const commit = (stroke: Point[]) => {
    if (stroke.length && value.length < 80 && points + stroke.length <= 6000) onChange?.([...value, stroke]);
  };
  const gesture = Gesture.Pan().minDistance(0).enabled(Boolean(onChange) && value.length < 80 && points < 5400)
    .onBegin((e) => {
      active.value = [{ x: Math.max(0, Math.min(1, e.x / width.value)), y: Math.max(0, Math.min(1, e.y / DRAWING_SIZE)) }];
      activePath.value = drawingPath([active.value], width.value, DRAWING_SIZE);
    }).onUpdate((e) => {
      const point = { x: Math.max(0, Math.min(1, e.x / width.value)), y: Math.max(0, Math.min(1, e.y / DRAWING_SIZE)) };
      const previous = active.value[active.value.length - 1];
      if (active.value.length >= 600 || (previous && Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y) < 0.003)) return;
      active.value = [...active.value, point];
      activePath.value = drawingPath([active.value], width.value, DRAWING_SIZE);
    }).onEnd(() => { scheduleOnRN(commit, active.value); })
    .onFinalize(() => { active.value = []; activePath.value = Skia.PathBuilder.Make().build(); });
  // Normalized coordinates keep a drawing intact on different screen sizes.
  const path = useMemo(() => drawingPath(value, layoutWidth, DRAWING_SIZE), [value, layoutWidth]);
  return (
    <View style={{ gap: spacing.sm }}>
      <GestureDetector gesture={gesture}>
        <View accessibilityLabel={onChange ? 'Área para desenhar com o dedo' : 'Desenho enviado'}
          onLayout={(e) => { width.value = e.nativeEvent.layout.width; setLayoutWidth(e.nativeEvent.layout.width); }}
          style={{ height: DRAWING_SIZE, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: theme.colors.backgroundDeep,
            borderColor: theme.colors.borderStrong, borderWidth: StyleSheet.hairlineWidth }}>
          <Canvas style={{ flex: 1 }}>
            <Path path={path} color={theme.colors.accent} style="stroke"
              strokeWidth={spacing.xs} strokeCap="round" strokeJoin="round" />
            <Path path={activePath} color={theme.colors.accent} style="stroke" strokeWidth={spacing.xs} strokeCap="round" strokeJoin="round" />
          </Canvas>
        </View>
      </GestureDetector>
      {onChange ? <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Button label="Desfazer" size="sm" variant="ghost" disabled={!value.length} onPress={() => onChange(value.slice(0, -1))} />
        <Button label="Limpar" size="sm" variant="ghost" disabled={!value.length} onPress={() => onChange([])} />
        {points >= 5400 || value.length >= 80 ? <Text variant="caption" color="textMuted">Limite de traços. Desfaça um para continuar.</Text> : null}
      </View> : null}
    </View>
  );
}
