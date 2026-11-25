import { wrapApp } from './src/sentry';
import 'react-native-gesture-handler';
import '@expo/metro-runtime';
import { registerRootComponent } from 'expo';
import * as SplashScreen from 'expo-splash-screen';
import App from './App';

// Keep the native branded splash visible while the app restores its session
// and cart. SplashScreen.tsx hides it once the first real screen is ready.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

registerRootComponent(wrapApp(App));
