import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/theme';
import { authService } from '../../services/authService';
import {
  deliveryLocationFromAddress,
  deliveryLocationService,
} from '../../services/deliveryLocationService';
import { locationService } from '../../services/locationService';
import { Address, User } from '../../models/user';
import { Header } from '../../components/Header';
import { formatAddress } from '../../utils/address';
import { Skeleton } from '../../components/Skeleton';

export const AddressManagementScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { colors, typography } = useTheme();

  const [user, setUser] = useState<User | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const [label, setLabel] = useState('Home');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('Johannesburg');
  const [province, setProvince] = useState('Gauteng');
  const [postalCode, setPostalCode] = useState('2000');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const loadUser = async () => {
        const current = await authService.getCurrentSessionUser();
        if (cancelled) return;
        setUser(current);
        setAddresses(current?.addresses ?? []);
        setLoading(false);
      };
      loadUser();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const persist = async (updated: Address[]) => {
    if (!user) return;
    setAddresses(updated);
    try {
      await authService.saveAddresses(user.id, updated);
    } catch (e: any) {
      Alert.alert('Could not save address', e?.message || 'Please try again.');
    }
  };

  const useCurrentLocation = async () => {
    const position = await locationService.getCurrentLocation({ forceRefresh: true });
    if (!position) {
      Alert.alert(
        'Location unavailable',
        'Turn on location services and allow access, then try again.'
      );
      return;
    }

    setCoords({ latitude: position.latitude, longitude: position.longitude });
    const parts = await locationService.getAddressParts(position.latitude, position.longitude);
    if (parts) {
      if (parts.streetAddress) setStreet(parts.streetAddress);
      if (parts.city) setCity(parts.city);
      if (parts.province) setProvince(parts.province);
      if (parts.postalCode) setPostalCode(parts.postalCode);
      setLabel('Current Location');
    }
  };

  const handleSaveAddress = async () => {
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to save an address.');
      return;
    }
    if (!street.trim() || !city.trim()) {
      Alert.alert('Incomplete address', 'Please fill in street address and city.');
      return;
    }

    setSaving(true);
    try {
      // A delivery address with random coordinates would make fees wrong and be
      // rejected by the server's geo guard, so it must geocode.
      let point = coords;
      if (!point) {
        point = await locationService.geocodeAddress(`${street}, ${city}, ${province}, South Africa`);
      }
      if (!point) {
        Alert.alert(
          'Address not found',
          'We could not locate that address. Add a street number, or use your current location.',
          [
            { text: 'Retry', style: 'cancel' },
            { text: 'Use current location', onPress: () => void useCurrentLocation() },
          ]
        );
        return;
      }

      const newAddress: Address = {
        id: `addr_${Date.now()}`,
        userId: user.id,
        label: label.trim() || 'Home',
        streetAddress: street.trim(),
        city: city.trim(),
        province: province.trim(),
        postalCode: postalCode.trim(),
        latitude: point.latitude,
        longitude: point.longitude,
        isDefault: addresses.length === 0,
      };

      await persist([...addresses, newAddress]);
      // If there was no delivery selection yet, this first saved address becomes it.
      if (deliveryLocationService.getActive()?.source === 'none') {
        deliveryLocationService.setActive(deliveryLocationFromAddress(newAddress));
      }
      setModalVisible(false);
      setStreet('');
      setCoords(null);
      setLabel('Home');
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (addressId: string) => {
    await persist(addresses.map((a) => ({ ...a, isDefault: a.id === addressId })));
    const chosen = addresses.find((a) => a.id === addressId);
    if (chosen) {
      deliveryLocationService.setActive(deliveryLocationFromAddress({ ...chosen, isDefault: true }));
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    const remaining = addresses.filter((a) => a.id !== addressId);
    // Never leave the list with no default.
    if (remaining.length > 0 && !remaining.some((a) => a.isDefault)) {
      remaining[0] = { ...remaining[0], isDefault: true };
    }
    await persist(remaining);

    const active = deliveryLocationService.getActive();
    if (active?.source === 'saved' && active.address?.id === addressId) {
      const fallback = remaining.find((a) => a.isDefault) ?? remaining[0] ?? null;
      deliveryLocationService.setActive(
        fallback ? deliveryLocationFromAddress(fallback) : null
      );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Header title="Saved Addresses" showBack onBackPress={() => navigation.goBack()} />

      {loading ? (
        <ScrollView contentContainerStyle={styles.listContent}>
          {[1, 2, 3].map((i) => (
            <View
              key={i}
              style={[styles.addressCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
            >
              <Skeleton width="35%" height={18} borderRadius={6} style={{ marginBottom: 10 }} />
              <Skeleton width="90%" height={14} borderRadius={6} style={{ marginBottom: 6 }} />
              <Skeleton width="60%" height={14} borderRadius={6} />
            </View>
          ))}
        </ScrollView>
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons name="location-outline" size={48} color={colors.subtext} />
              <Text style={[typography.titleMedium, { color: colors.onSurface, marginTop: 12 }]}>
                No saved addresses
              </Text>
              <Text style={[typography.bodySmall, { color: colors.subtext, marginTop: 4, textAlign: 'center' }]}>
                Add one so we know where to deliver your orders.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.addressCard,
                {
                  backgroundColor: colors.cardBackground,
                  borderColor: item.isDefault ? colors.secondary : colors.divider,
                },
              ]}
              onPress={() => handleSetDefault(item.id)}
              activeOpacity={0.8}
            >
              <View style={styles.cardHeader}>
                <View style={styles.labelBadge}>
                  <Ionicons
                    name={item.label === 'Home' ? 'home-outline' : 'location-outline'}
                    size={18}
                    color={colors.secondary}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[typography.titleSmall, { color: colors.onSurface }]}>{item.label}</Text>
                </View>

                {item.isDefault ? (
                  <View style={[styles.defaultBadge, { backgroundColor: colors.primaryContainer }]}>
                    <Text style={[typography.labelSmall, { color: colors.secondary, fontWeight: '700' }]}>
                      DEFAULT
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity onPress={() => handleDeleteAddress(item.id)}>
                    <Ionicons name="trash-outline" size={18} color={colors.subtext} />
                  </TouchableOpacity>
                )}
              </View>

              <Text style={[typography.bodyMedium, { color: colors.onSurface, marginTop: 8 }]}>
                {formatAddress(item, 'Delivery address')}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      <View style={[styles.footer, { backgroundColor: colors.appBarBackground, borderTopColor: colors.divider }]}>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={20} color={colors.onPrimary} style={{ marginRight: 6 }} />
          <Text style={[typography.titleMedium, { color: colors.onPrimary, fontWeight: '700' }]}>
            Add New Delivery Address
          </Text>
        </TouchableOpacity>
      </View>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.cardBackground }]}>
            <Text style={[typography.headlineMedium, { color: colors.onSurface, marginBottom: 16 }]}>
              Add Address
            </Text>

            <TouchableOpacity
              style={[styles.locationBtn, { borderColor: colors.secondary }]}
              onPress={() => void useCurrentLocation()}
            >
              <Ionicons name="navigate-outline" size={18} color={colors.secondary} />
              <Text style={[typography.labelMedium, { color: colors.secondary, marginLeft: 6 }]}>
                Use my current location
              </Text>
            </TouchableOpacity>

            <Text style={[typography.labelMedium, { color: colors.onSurface, marginTop: 12, marginBottom: 4 }]}>
              Label
            </Text>
            <TextInput
              style={[styles.modalInput, { color: colors.onSurface, borderColor: colors.divider }]}
              placeholder="Home, Work, Gym..."
              placeholderTextColor={colors.subtext}
              value={label}
              onChangeText={setLabel}
            />

            <Text style={[typography.labelMedium, { color: colors.onSurface, marginTop: 10, marginBottom: 4 }]}>
              Street Address
            </Text>
            <TextInput
              style={[styles.modalInput, { color: colors.onSurface, borderColor: colors.divider }]}
              placeholder="e.g. 50 Bath Avenue, Rosebank"
              placeholderTextColor={colors.subtext}
              value={street}
              onChangeText={(value) => {
                setStreet(value);
                setCoords(null);
              }}
            />

            <Text style={[typography.labelMedium, { color: colors.onSurface, marginTop: 10, marginBottom: 4 }]}>
              City
            </Text>
            <TextInput
              style={[styles.modalInput, { color: colors.onSurface, borderColor: colors.divider }]}
              placeholder="Johannesburg / Cape Town"
              placeholderTextColor={colors.subtext}
              value={city}
              onChangeText={(value) => {
                setCity(value);
                setCoords(null);
              }}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.divider }]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={[typography.titleSmall, { color: colors.onSurface }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.secondary }]}
                onPress={() => void handleSaveAddress()}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={[typography.titleSmall, { color: '#FFFFFF', fontWeight: '700' }]}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  listContent: { padding: 16, flexGrow: 1 },
  addressCard: { padding: 16, borderRadius: 14, borderWidth: 1.5, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  labelBadge: { flexDirection: 'row', alignItems: 'center' },
  defaultBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  footer: { padding: 16, borderTopWidth: 1 },
  addBtn: {
    flexDirection: 'row',
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: { padding: 20, borderRadius: 16 },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
  },
  modalInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20 },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 10,
  },
  saveBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10, minWidth: 84, alignItems: 'center' },
});
