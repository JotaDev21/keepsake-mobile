import 'expo-router/entry';
import { Platform } from 'react-native';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { bilheteWidgetTask } from './src/widgets/bilhete-widget';

if (Platform.OS === 'android') registerWidgetTaskHandler(bilheteWidgetTask);
