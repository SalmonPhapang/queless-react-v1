import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SplashScreen } from '../screens/SplashScreen';
import { AuthNavigator } from './AuthNavigator';
import { MainTabNavigator, MainTabParamList } from './MainTabNavigator';
import { OnboardingScreen } from '../screens/Onboarding/OnboardingScreen';
import { LocationPermissionScreen } from '../screens/Onboarding/LocationPermissionScreen';
import { BudgetMealsScreen } from '../screens/Main/BudgetMealsScreen';
import { BudgetBasketScreen } from '../screens/Main/BudgetBasketScreen';
import { BrowseScreen } from '../screens/Main/BrowseScreen';
import { FavoritesScreen } from '../screens/Profile/FavoritesScreen';
import { StoreDetailScreen } from '../screens/Store/StoreDetailScreen';
import { StoreProductsScreen } from '../screens/Store/StoreProductsScreen';
import { CategoryScreen } from '../screens/Browse/CategoryScreen';
import { ProductDetailScreen } from '../screens/Product/ProductDetailScreen';
import { ProductOptionsScreen } from '../screens/Product/ProductOptionsScreen';
import { CartScreen } from '../screens/Cart/CartScreen';
import { CheckoutScreen } from '../screens/Cart/CheckoutScreen';
import { PaystackPaymentScreen } from '../screens/Cart/PaystackPaymentScreen';
import { OrderTrackingScreen } from '../screens/Orders/OrderTrackingScreen';
import { PayOrderScreen } from '../screens/Orders/PayOrderScreen';
import { AddressManagementScreen } from '../screens/Profile/AddressManagementScreen';
import { NotificationInboxScreen } from '../screens/Profile/NotificationInboxScreen';
import { EditProfileScreen } from '../screens/Profile/EditProfileScreen';
import { FaqScreen } from '../screens/Profile/FaqScreen';
import { SupportTicketsScreen } from '../screens/Profile/SupportTicketsScreen';
import { AgeVerificationScreen } from '../screens/Auth/AgeVerificationScreen';
import { VerifyPhoneOtpScreen } from '../screens/Auth/VerifyPhoneOtpScreen';
import { QAiChatScreen } from '../screens/Main/QAiChatScreen';
import { ErrorScreen } from '../screens/Shared/ErrorScreen';
import { Product } from '../models/product';
import { Store } from '../models/store';
import type { CheckoutPaymentMethod } from '../utils/paymentMethod';
import type { BudgetBasket } from '../services/budgetMealService';

export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  Onboarding: undefined;
  LocationPermission: undefined;
  Favorites: undefined;
  BudgetMeals: { budget?: number } | undefined;
  BudgetBasket: { basket: BudgetBasket; budget?: number; servings?: number };
  Browse: { search?: string } | undefined;
  MainTabs: { screen?: keyof MainTabParamList; params?: any } | undefined;
  StoreDetail: { storeId: string };
  StoreProducts: { storeId: string };
  Category: { category: string; productType?: 'alcohol' | 'food' };
  ProductDetail: { product: Product; storeId?: string; store?: Store };
  ProductOptions: { product: Product; storeId?: string; storeName?: string };
  Cart: undefined;
  Checkout: undefined;
  PaystackPayment: {
    authorizationUrl: string;
    reference: string;
    orderId: string;
    paymentId: string;
    paymentMethod?: CheckoutPaymentMethod;
    amount?: number;
  };
  OrderTracking: { orderId: string; fromCheckout?: boolean };
  PayOrder: { orderId: string };
  AddressManagement: undefined;
  NotificationInbox: undefined;
  EditProfile: undefined;
  Faq: undefined;
  SupportTickets: undefined;
  AgeVerification: undefined;
  QAiChat: undefined;
  ErrorScreen: {
    title?: string;
    message: string;
    icon?: string;
    primaryLabel?: string;
  };
  VerifyPhoneOtp: {
    phone: string;
    pendingUserId?: string;
    pendingFullName?: string;
    pendingPhone?: string;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Auth" component={AuthNavigator} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="LocationPermission" component={LocationPermissionScreen} />
      <Stack.Screen name="Favorites" component={FavoritesScreen} />
      <Stack.Screen name="BudgetMeals" component={BudgetMealsScreen} />
      <Stack.Screen name="BudgetBasket" component={BudgetBasketScreen} />
      <Stack.Screen name="Browse" component={BrowseScreen} />
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen name="StoreDetail" component={StoreDetailScreen} />
      <Stack.Screen name="StoreProducts" component={StoreProductsScreen} />
      <Stack.Screen name="Category" component={CategoryScreen} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <Stack.Screen
        name="ProductOptions"
        component={ProductOptionsScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
      <Stack.Screen name="PaystackPayment" component={PaystackPaymentScreen} />
      <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} />
      <Stack.Screen name="PayOrder" component={PayOrderScreen} />
      <Stack.Screen name="AddressManagement" component={AddressManagementScreen} />
      <Stack.Screen name="NotificationInbox" component={NotificationInboxScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Faq" component={FaqScreen} />
      <Stack.Screen name="SupportTickets" component={SupportTicketsScreen} />
      <Stack.Screen name="AgeVerification" component={AgeVerificationScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="QAiChat" component={QAiChatScreen} />
      <Stack.Screen name="VerifyPhoneOtp" component={VerifyPhoneOtpScreen} />
      <Stack.Screen name="ErrorScreen" component={ErrorScreen} />
    </Stack.Navigator>
  );
};
