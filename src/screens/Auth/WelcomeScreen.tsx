import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '../../theme/theme';

interface WelcomeScreenProps {
  navigation: any;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ navigation }) => {
  const { colors, typography } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          <Image
            source={require('../../../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="Queless app logo"
          />

          <Text style={[typography.displayLarge, styles.brand, { color: colors.onSurface }]}>
            Queless
          </Text>

          <Text style={[typography.headlineMedium, { color: colors.secondary, textAlign: 'center' }]}>
            Premium Delivery
          </Text>

          <Text style={[typography.bodyLarge, styles.tagline, { color: colors.subtext }]}>
            Fast, legal, and reliable food & beverage delivery across South Africa
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.onSurface }]}
            onPress={() => navigation.navigate('Register')}
            activeOpacity={0.85}
          >
            <Text style={[typography.titleMedium, { color: colors.surface, fontWeight: '800' }]}>
              Create Account
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.divider }]}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.85}
          >
            <Text style={[typography.titleMedium, { color: colors.onSurface, fontWeight: '800' }]}>
              Sign In
            </Text>
          </TouchableOpacity>

          <View style={[styles.agePill, { backgroundColor: colors.errorContainer }]}>
            <Text style={[typography.labelMedium, { color: colors.error, fontWeight: '800' }]}>
              18+ Only â€¢ Drink Responsibly
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
    justifyContent: 'space-between',
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 152,
    height: 152,
  },
  brand: {
    marginTop: 40,
    fontWeight: '800',
    letterSpacing: -1,
  },
  tagline: {
    marginTop: 24,
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: 320,
  },
  actions: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  primaryButton: {
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    height: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  agePill: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
  },
});
