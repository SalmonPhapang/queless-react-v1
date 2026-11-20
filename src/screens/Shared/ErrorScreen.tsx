import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/theme';

interface ErrorScreenProps {
  navigation: any;
  route: any;
}

/**
 * Global, non-modal error/message screen. Use for blocking failures on the
 * golden path instead of Alert.alert. Params:
 *   title?: string
 *   message: string
 *   icon?: Ionicons glyph name
 *   primaryLabel?: string   (defaults to "Go back")
 */
export const ErrorScreen: React.FC<ErrorScreenProps> = ({ navigation, route }) => {
  const { colors, typography } = useTheme();
  const title = route?.params?.title ?? 'Something went wrong';
  const message =
    route?.params?.message ?? 'We could not complete that action. Please try again.';
  const icon = (route?.params?.icon ?? 'alert-circle-outline') as keyof typeof Ionicons.glyphMap;
  const primaryLabel = route?.params?.primaryLabel ?? 'Go back';

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primaryContainer }]}>
          <Ionicons name={icon} size={40} color={colors.secondary} />
        </View>
        <Text style={[typography.headlineMedium, { color: colors.onSurface, textAlign: 'center', marginTop: 16 }]}>
          {title}
        </Text>
        <Text style={[typography.bodyMedium, { color: colors.subtext, textAlign: 'center', marginTop: 8, lineHeight: 22 }]}>
          {message}
        </Text>

        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.secondary }]}
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainTabs'))}
          activeOpacity={0.85}
        >
          <Text style={[typography.titleSmall, { color: '#FFFFFF', fontWeight: '700' }]}>
            {primaryLabel}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
});
