import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/theme';

type StatusVariant = 'error' | 'warning' | 'info' | 'success';

interface StatusMessageProps {
  variant?: StatusVariant;
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  onDismiss?: () => void;
}

const ICONS: Record<StatusVariant, keyof typeof Ionicons.glyphMap> = {
  error: 'alert-circle',
  warning: 'warning',
  info: 'information-circle',
  success: 'checkmark-circle',
};

const COLORS: Record<StatusVariant, string> = {
  error: '#DC2626',
  warning: '#D97706',
  info: '#2563EB',
  success: '#059669',
};

/**
 * Inline, non-modal status message. Use this instead of Alert.alert on the
 * golden-path screens so the user sees a contextual message in place.
 */
export const StatusMessage: React.FC<StatusMessageProps> = ({
  variant = 'info',
  title,
  message,
  onRetry,
  retryLabel = 'Try again',
  onDismiss,
}) => {
  const { colors, typography } = useTheme();
  const accent = COLORS[variant];

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.cardBackground, borderColor: accent + '33' },
      ]}
      accessibilityRole="alert"
    >
      <Ionicons name={ICONS[variant]} size={20} color={accent} style={styles.icon} />
      <View style={styles.textContainer}>
        {!!title && (
          <Text style={[typography.titleSmall, { color: colors.onSurface, fontWeight: '700' }]}>
            {title}
          </Text>
        )}
        <Text style={[typography.bodySmall, { color: colors.subtext, marginTop: title ? 2 : 0 }]}>
          {message}
        </Text>
        {onRetry && (
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: accent }]}
            onPress={onRetry}
            activeOpacity={0.85}
          >
            <Text style={[typography.labelMedium, { color: '#FFFFFF', fontWeight: '700' }]}>
              {retryLabel}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      {onDismiss && (
        <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={18} color={colors.subtext} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  icon: {
    marginTop: 2,
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
  },
  retryButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
});
