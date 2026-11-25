import * as Sentry from '@sentry/react-native';
import type { ComponentType } from 'react';

const DSN = 'https://ae984f4868f50404d0ddaf2bb58094f0@o4512488594276352.ingest.de.sentry.io/4512488692711504';

Sentry.init({
  dsn: DSN,
  debug: __DEV__,
  environment: __DEV__ ? 'development' : 'production',
  tracesSampleRate: __DEV__ ? 1.0 : 0.2,
  sendDefaultPii: false,
  enableLogs: false,
  enableAutoConsoleLogs: false,
  profilesSampleRate: undefined,
  replaysSessionSampleRate: undefined,
  replaysOnErrorSampleRate: undefined,
  attachScreenshot: false,
  attachViewHierarchy: false,
});

export function wrapApp(
  Component: ComponentType<Record<string, unknown>>,
): ComponentType<Record<string, unknown>> {
  return Sentry.wrap(Component);
}
