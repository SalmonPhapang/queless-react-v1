import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/theme';
import { authService } from '../../services/authService';

const ONBOARDING_COMPLETE_KEY = 'onboarding_complete';
const { width } = Dimensions.get('window');

interface OnboardingPage {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}

const PAGES: OnboardingPage[] = [
  {
    icon: 'bicycle-outline',
    title: 'Fast Delivery',
    description:
      'Get your favourite beverages delivered to your doorstep in minutes. We bring the party to you.',
  },
  {
    icon: 'shield-checkmark-outline',
    title: 'Age Verified & Safe',
    description:
      'All orders comply with South African liquor laws. We verify age to ensure responsible delivery.',
  },
  {
    icon: 'bag-handle-outline',
    title: 'Wide Selection',
    description:
      'Browse hundreds of local and international beers, wines, spirits, and mixers all in one place.',
  },
];

interface OnboardingScreenProps {
  navigation: any;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ navigation }) => {
  const { colors, typography } = useTheme();
  const listRef = useRef<FlatList<OnboardingPage>>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const isLastPage = currentPage === PAGES.length - 1;

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY)
      .then((value) => {
        if (value === 'true') navigation.replace('MainTabs');
      })
      .catch(() => {});
  }, []);

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    } catch (e) {
      console.warn('Failed to persist onboarding flag', e);
    }

    // Explain location before the OS prompt appears, instead of prompting cold
    // on the first Home render.
    navigation.replace('LocationPermission');
  };

  const handleNext = () => {
    if (isLastPage) {
      completeOnboarding();
      return;
    }
    listRef.current?.scrollToIndex({ index: currentPage + 1, animated: true });
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setCurrentPage(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <View style={styles.skipRow}>
        <TouchableOpacity onPress={completeOnboarding} activeOpacity={0.7}>
          <Text style={[typography.labelLarge, { color: colors.subtext, fontWeight: '700' }]}>
            Skip
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
        data={PAGES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(page) => page.title}
        onMomentumScrollEnd={onScroll}
        renderItem={({ item }) => (
          <View style={[styles.page, { width }]}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primaryContainer }]}>
              <Ionicons name={item.icon} size={72} color={colors.secondary} />
            </View>
            <Text style={[typography.headlineLarge, styles.title, { color: colors.onSurface }]}>
              {item.title}
            </Text>
            <Text style={[typography.bodyLarge, styles.description, { color: colors.subtext }]}>
              {item.description}
            </Text>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {PAGES.map((page, index) => (
            <View
              key={page.title}
              style={[
                styles.dot,
                {
                  width: currentPage === index ? 24 : 8,
                  backgroundColor: currentPage === index ? colors.secondary : colors.divider,
                },
              ]}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.nextButton, { backgroundColor: colors.onSurface }]}
          onPress={handleNext}
          activeOpacity={0.85}
        >
          <Text style={[typography.titleMedium, { color: colors.surface, fontWeight: '900' }]}>
            {isLastPage ? 'Get Started' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skipRow: {
    paddingTop: 56,
    paddingHorizontal: 20,
    alignItems: 'flex-end',
  },
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  iconCircle: {
    width: 168,
    height: 168,
    borderRadius: 84,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: 48,
    textAlign: 'center',
    fontWeight: '900',
  },
  description: {
    marginTop: 20,
    textAlign: 'center',
    lineHeight: 26,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  nextButton: {
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
