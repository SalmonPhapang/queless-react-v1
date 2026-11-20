import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Platform, StyleProp, View, ViewStyle } from 'react-native';

export interface PlatformWebViewHandle {
  injectJavaScript(script: string): void;
}

export interface PlatformWebViewSource {
  uri?: string;
  html?: string;
}

interface PlatformWebViewProps {
  source: PlatformWebViewSource;
  style?: StyleProp<ViewStyle>;
  originWhitelist?: string[];
  javaScriptEnabled?: boolean;
  domStorageEnabled?: boolean;
  scrollEnabled?: boolean;
  bounces?: boolean;
  overScrollMode?: 'always' | 'never' | 'if-content';
  showsHorizontalScrollIndicator?: boolean;
  showsVerticalScrollIndicator?: boolean;
  setSupportMultipleWindows?: boolean;
  androidLayerType?: 'none' | 'software' | 'hardware';
  startInLoadingState?: boolean;
  renderLoading?: () => React.ReactNode;
  onLoadEnd?: () => void;
  onNavigationStateChange?: (state: { url: string }) => void;
  onShouldStartLoadWithRequest?: (request: { url: string }) => boolean;
}

// react-native-webview has no web implementation. Keep the native module out
// of the web bundle and use a same-origin iframe for the web debugger.
const NativeWebView: any =
  Platform.OS === 'web' ? null : require('react-native-webview').WebView;

export const PlatformWebView = forwardRef<PlatformWebViewHandle, PlatformWebViewProps>(
  function PlatformWebView(props, ref) {
    const nativeRef = useRef<any>(null);
    const iframeRef = useRef<any>(null);
    const [loaded, setLoaded] = useState(Platform.OS !== 'web');

    useImperativeHandle(ref, () => ({
      injectJavaScript(script: string) {
        if (Platform.OS !== 'web') {
          nativeRef.current?.injectJavaScript(script);
          return;
        }

        const iframeWindow = iframeRef.current?.contentWindow;
        if (!iframeWindow) return;

        try {
          iframeWindow.eval(script);
        } catch (error) {
          console.warn('Web iframe could not inject script:', error);
        }
      },
    }));

    if (Platform.OS !== 'web') {
      return <NativeWebView ref={nativeRef} {...props} />;
    }

    return (
      <View style={[{ flex: 1 }, props.style]}>
        {React.createElement('iframe', {
          ref: iframeRef,
          title: 'Embedded content',
          src: props.source.uri,
          srcDoc: props.source.html,
          style: {
            width: '100%',
            height: '100%',
            border: 0,
            display: 'block',
            backgroundColor: 'transparent',
          },
          onLoad: () => {
            setLoaded(true);
            props.onLoadEnd?.();
          },
        })}
        {!loaded && props.renderLoading?.()}
      </View>
    );
  }
);
