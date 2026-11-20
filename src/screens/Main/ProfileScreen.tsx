import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/theme';
import { authService } from '../../services/authService';
import { User } from '../../models/user';
import { Header } from '../../components/Header';
import { Skeleton } from '../../components/Skeleton';

export const ProfileScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { colors, typography, isDark, toggleTheme } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadUser = async () => {
      const current = await authService.getCurrentSessionUser();
      if (!cancelled) {
        setUser(current);
        setLoading(false);
      }
    };
    loadUser();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await authService.signOut();
          navigation.replace('Auth');
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Header title="Account & Profile" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <View>
            <View style={[styles.userCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <Skeleton width={54} height={54} borderRadius={27} />
              <View style={{ marginLeft: 16, flex: 1 }}>
                <Skeleton width="60%" height={18} borderRadius={6} style={{ marginBottom: 8 }} />
                <Skeleton width="80%" height={14} borderRadius={6} style={{ marginBottom: 6 }} />
                <Skeleton width="45%" height={14} borderRadius={6} />
              </View>
            </View>
            <Skeleton width={110} height={12} borderRadius={6} style={{ marginBottom: 8 }} />
            {[1, 2, 3, 4, 5].map((i) => (
              <View
                key={`p-${i}`}
                style={[styles.menuItem, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
              >
                <Skeleton width="55%" height={18} borderRadius={6} />
              </View>
            ))}
            <Skeleton width={130} height={12} borderRadius={6} style={{ marginTop: 12, marginBottom: 8 }} />
            {[1, 2].map((i) => (
              <View
                key={`s-${i}`}
                style={[styles.menuItem, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
              >
                <Skeleton width="60%" height={18} borderRadius={6} />
              </View>
            ))}
          </View>
        ) : (
          <>
            {/* User Card */}
            <View style={[styles.userCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
                <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '800' }}>
                  {user?.fullName?.charAt(0).toUpperCase() || 'U'}
                </Text>
              </View>
              <View style={{ marginLeft: 16, flex: 1 }}>
                <Text style={[typography.titleMedium, { color: colors.onSurface }]}>
                  {user?.fullName || 'Queless Customer'}
                </Text>
                <Text style={[typography.bodySmall, { color: colors.subtext, marginTop: 2 }]}>
                  {user?.email || ''}
                </Text>
                <Text style={[typography.bodySmall, { color: colors.subtext, marginTop: 2 }]}>
                  {user?.phone || ''}
                </Text>
              </View>
            </View>

        {/* Menu Options */}
        <View style={styles.section}>
          <Text style={[typography.labelSmall, { color: colors.subtext, marginBottom: 8 }]}>PREFERENCES</Text>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
            onPress={() => navigation.navigate('EditProfile')}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <Ionicons name="create-outline" size={20} color={colors.secondary} style={styles.menuIcon} />
              <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>Edit Profile</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
            onPress={() => navigation.navigate('Favorites')}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <Ionicons name="heart-outline" size={20} color={colors.secondary} style={styles.menuIcon} />
              <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>Favourites</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
            onPress={() => navigation.navigate('AddressManagement')}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <Ionicons name="location-outline" size={20} color={colors.secondary} style={styles.menuIcon} />
              <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>Saved Addresses</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
            onPress={() => navigation.navigate('NotificationInbox')}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <Ionicons name="notifications-outline" size={20} color={colors.secondary} style={styles.menuIcon} />
              <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>Notification Inbox</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
          </TouchableOpacity>

          <View style={[styles.menuItem, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
            <View style={styles.menuLeft}>
              <Ionicons name="moon-outline" size={20} color={colors.secondary} style={styles.menuIcon} />
              <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>Dark Appearance Mode</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: '#D1D5DB', true: colors.secondary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
            onPress={() => navigation.navigate('AgeVerification')}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <Ionicons name="wine-outline" size={20} color="#7C3AED" style={styles.menuIcon} />
              <View>
                <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>Age Verification Status</Text>
                <Text style={[typography.labelSmall, { color: user?.ageVerified ? colors.secondary : colors.subtext }]}>
                  {user?.ageVerified ? 'Verified (18+ liquor enabled)' : 'Not verified'}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[typography.labelSmall, { color: colors.subtext, marginBottom: 8 }]}>SUPPORT & LEGAL</Text>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
            onPress={() => navigation.navigate('Faq')}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <Ionicons name="help-circle-outline" size={20} color={colors.secondary} style={styles.menuIcon} />
              <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>Help & Customer Support</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
            onPress={() => Alert.alert('Terms of Service', 'Quelless App v1.0.1 - South Africa region.')}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <Ionicons name="document-text-outline" size={20} color={colors.secondary} style={styles.menuIcon} />
              <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>Terms & Privacy Policy</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.signOutButton, { backgroundColor: colors.errorContainer }]}
          onPress={handleSignOut}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.error} style={{ marginRight: 8 }} />
          <Text style={[typography.titleSmall, { color: colors.error, fontWeight: '700' }]}>Sign Out</Text>
        </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loadingBox: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIcon: {
    marginRight: 12,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 12,
    marginTop: 10,
    marginBottom: 30,
  },
});
