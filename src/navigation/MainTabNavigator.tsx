import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { HomeScreen } from '../screens/Main/HomeScreen';
import { LiquorHomeScreen } from '../screens/Liquor/LiquorHomeScreen';
import { OrdersScreen } from '../screens/Main/OrdersScreen';
import { ProfileScreen } from '../screens/Main/ProfileScreen';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { useTheme } from '../theme/theme';

export type MainTabParamList = {
  FoodTab: undefined;
  LiquorTab: undefined;
  OrdersTab: undefined;
  ProfileTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

/** Food first, then Liquor, Orders and Profile. */
export const MainTabNavigator = () => {
  const { colors, typography } = useTheme();
  const layout = useResponsiveLayout();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.secondary,
        tabBarInactiveTintColor: colors.subtext,
        tabBarStyle: {
          backgroundColor: colors.appBarBackground,
          borderTopColor: colors.divider,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
          ...(layout.isWeb && {
            width: '100%',
            maxWidth: layout.contentMaxWidth ?? 1180,
            alignSelf: 'center' as const,
          }),
        },
        tabBarLabelStyle: typography.labelSmall,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'wine';

          if (route.name === 'LiquorTab') {
            iconName = focused ? 'wine' : 'wine-outline';
          } else if (route.name === 'FoodTab') {
            iconName = focused ? 'restaurant' : 'restaurant-outline';
          } else if (route.name === 'OrdersTab') {
            iconName = focused ? 'receipt' : 'receipt-outline';
          } else if (route.name === 'ProfileTab') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size || 22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="FoodTab" component={HomeScreen} options={{ tabBarLabel: 'Food' }} />
      <Tab.Screen name="LiquorTab" component={LiquorHomeScreen} options={{ tabBarLabel: 'Liquor' }} />
      <Tab.Screen name="OrdersTab" component={OrdersScreen} options={{ tabBarLabel: 'Orders' }} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
};
