import React from 'react';
import type { ComponentType } from 'react';
import * as Sentry from '@sentry/react';

const DSN = 'https://ae984f4868f50404d0ddaf2bb58094f0@o4512488594276352.ingest.de.sentry.io/4512488692711504';
const isDev = process.env.NODE_ENV !== 'production';

Sentry.init({
  dsn: DSN,
  environment: isDev ? 'development' : 'production',
  tracesSampleRate: isDev ? 1.0 : 0.2,
  integrations: [Sentry.browserTracingIntegration()],
});

export function wrapApp(
  Component: ComponentType<Record<string, unknown>>,
): ComponentType<Record<string, unknown>> {
  const WrappedApp = (props: Record<string, unknown>) =>
    React.createElement(
      Sentry.ErrorBoundary,
      { fallback: React.createElement(React.Fragment) },
      React.createElement(Component, props),
    );

  return WrappedApp;
}
