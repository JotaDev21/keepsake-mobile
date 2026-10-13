import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import * as ScreenCapture from 'expo-screen-capture';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AchievementReveal, LightboxProvider, LockOverlay } from '@/components';
import { ThemeProvider, fontMap, useAccent, useTheme } from '@/design';
import { authenticate } from '@/lib/auth';
import { registerRemoteNotifications, syncReminders } from '@/lib/notifications';
import { prefs } from '@/lib/prefs';
import { useAchievementStore } from '@/stores/useAchievementStore';
import { useCareStore } from '@/stores/useCareStore';
import { useActivityStore } from '@/stores/useActivityStore';
import { refreshBilheteWidget, saveWidgetPreference, widgetPreference } from '@/widgets/bilhete-widget';
import { useGardenStore } from '@/stores/useGardenStore';
import { usePersonStore } from '@/stores/usePersonStore';
import { useSyncStore } from '@/stores/useSyncStore';
import { useSpotifyStore } from '@/stores/useSpotifyStore';

const visualAudit = process.env.EXPO_PUBLIC_VISUAL_AUDIT === '1';

/** Route a notification tap to its ritual (capsule, humor, letters…). */
function pushNotificationUrl(router: ReturnType<typeof useRouter>, response: Notifications.NotificationResponse | null) {
  const url = response?.notification.request.content.data?.url;
  if (typeof url === 'string' && url.length > 0) {
    try {
      router.push(url as never);
    } catch {
      // A stale link must never crash the launch.
    }
  }
}

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts(fontMap);
  const hydrated = usePersonStore((s) => s.hydrated);
  const hydrate = usePersonStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const ready = fontsLoaded && hydrated;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemedRoot />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Seeds the theme from the person's accent (read outside the theme). */
function ThemedRoot() {
  const accent = usePersonStore((s) => s.person?.accent);
  return (
    <ThemeProvider initialAccent={accent}>
      <ThemedNavigator />
    </ThemeProvider>
  );
}

function ThemedNavigator() {
  const theme = useTheme();
  const router = useRouter();
  const { setAccent } = useAccent();
  const accent = usePersonStore((s) => s.person?.accent);
  const personId = usePersonStore((s) => s.person?.id);
  const hasPerson = usePersonStore((s) => s.person != null);
  const coupleId = useSyncStore((s) => s.coupleId);
  const uid = useSyncStore((s) => s.uid);
  const partnerId = useSyncStore((s) => s.partnerId);

  const [locked, setLocked] = useState(() => prefs.isAppLockEnabled());
  const [covered, setCovered] = useState(false);

  // Keep the whole app re-tinted as the person's accent changes.
  useEffect(() => {
    if (accent) setAccent(accent);
  }, [accent, setAccent]);

  // Schedule gentle local reminders (check-in, dates, capsules) once we have a
  // person, and record today's visit so the garden grows from just showing up.
  useEffect(() => {
    if (personId) {
      syncReminders(personId).catch(() => {});
      useGardenStore.getState().water(personId).catch(() => {});
    }
  }, [personId]);

  // Connect cloud sync (anonymous auth + partner mood) + load Spotify state at startup.
  useEffect(() => {
    useSyncStore
      .getState()
      .init()
      .then(() => registerRemoteNotifications())
      .catch(() => {});
    useSpotifyStore.getState().load().catch(() => {});
  }, []);

  // Couple milestones stay live on either phone and retry quietly offline.
  useEffect(() => {
    useAchievementStore.getState().connect(coupleId, uid).catch(() => {});
  }, [coupleId, uid]);

  // Self-care remains local before pairing and mirrors only after explicit consent.
  useEffect(() => {
    useCareStore.getState().hydrate();
    useCareStore.getState().connect(coupleId, uid, partnerId).catch(() => {});
  }, [coupleId, partnerId, uid]);

  // A tapped notification lands on its ritual — both warm (app open) and cold starts.
  useEffect(() => {
    void useActivityStore.getState().connect(coupleId, uid);
    const pref = widgetPreference();
    // uid starts null while the protected session hydrates on cold launch.
    // Hide previews for an actual identity change, not during that bootstrap.
    if (uid && pref.enabled && (pref.uid !== uid || pref.coupleId !== coupleId)) {
      saveWidgetPreference({ ...pref, enabled: false, uid, coupleId });
      void refreshBilheteWidget().catch(() => {});
    } else if (uid && pref.enabled && pref.accent !== theme.colors.accent) {
      saveWidgetPreference({ ...pref, accent: theme.colors.accent });
      void refreshBilheteWidget().catch(() => {});
    }
  }, [coupleId, uid, theme.colors.accent]);

  useEffect(() => useActivityStore.subscribe((state, previous) => {
    if (state.events !== previous.events && !state.syncing) void refreshBilheteWidget().catch(() => {});
    if (previous.syncing && !state.syncing) void refreshBilheteWidget().catch(() => {});
  }), []);

  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then((r) => pushNotificationUrl(router, r));
    const sub = Notifications.addNotificationResponseReceivedListener((r) => pushNotificationUrl(router, r));
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unlock = useCallback(async () => {
    const ok = await authenticate();
    if (ok) setLocked(false);
  }, []);

  // Prompt for biometrics immediately if the app opened locked.
  useEffect(() => {
    if (prefs.isAppLockEnabled()) unlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Screen capture is a separate privacy choice from biometrics. It stays
  // blocked by default on each device (Android FLAG_SECURE) until that person
  // explicitly allows it in Settings.
  useEffect(() => {
    if (visualAudit || prefs.isScreenCaptureAllowed()) {
      ScreenCapture.allowScreenCaptureAsync().catch(() => {});
    } else {
      ScreenCapture.preventScreenCaptureAsync().catch(() => {});
    }
  }, []);

  // Lifecycle: cover the content the moment the app leaves the screen (so the
  // switcher snapshot shows nothing), re-lock on background, and catch up with
  // her side + water the garden when coming back.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'inactive') {
        setCovered(true);
      } else if (state === 'background') {
        setCovered(true);
        if (prefs.isAppLockEnabled()) setLocked(true);
      } else if (state === 'active') {
        setCovered(false);
        useSyncStore.getState().onForeground();
        const sync = useSyncStore.getState();
        useAchievementStore.getState().connect(sync.coupleId, sync.uid).catch(() => {});
        useCareStore.getState().connect(sync.coupleId, sync.uid, sync.partnerId).catch(() => {});
        void useActivityStore.getState().connect(sync.coupleId, sync.uid);
        void refreshBilheteWidget().catch(() => {});
        registerRemoteNotifications().catch(() => {});
        const pid = usePersonStore.getState().person?.id;
        // Watering on every return makes "just showing up" count even when the
        // app slept over midnight in the background.
        if (pid) useGardenStore.getState().water(pid).catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <>
      <LightboxProvider>
        <StatusBar style={theme.dark ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            contentStyle: { backgroundColor: theme.colors.background },
          }}
        >
          <Stack.Protected guard={hasPerson}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="memoria/[id]" />
            <Stack.Screen name="memorias-compartilhadas" />
            <Stack.Screen name="memoria-compartilhada/[id]" />
            <Stack.Screen name="carta/[id]" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="editar-perfil" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="gravar-audio" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="cartas/index" />
            <Stack.Screen name="cartas/escrever" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="motivos" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="gratidao" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="pergunta" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="conquistas" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="ajustes" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="conexao" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="meu-perfil" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="musica" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="ainda-vamos-viver" />
            <Stack.Screen name="bilhetes" />
            <Stack.Screen name="desenhos" />
            <Stack.Screen name="atividade/[id]" />
          </Stack.Protected>
          <Stack.Protected guard={!hasPerson}>
            <Stack.Screen name="onboarding" />
          </Stack.Protected>
        </Stack>
      </LightboxProvider>
      <AchievementReveal />
      {locked ? <LockOverlay onUnlock={unlock} /> : covered ? <LockOverlay cover /> : null}
    </>
  );
}
