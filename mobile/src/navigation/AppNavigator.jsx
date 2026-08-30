/**
 * AppNavigator — Main navigation with modern tab bar and smooth transitions.
 */
import React, { useEffect, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';

import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../constants/theme';
import LoadingScreen from '../components/LoadingScreen';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';

// Main Screens
import HomeScreen from '../screens/HomeScreen';
import ShopScreen from '../screens/ShopScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import CartScreen from '../screens/CartScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import OrdersScreen from '../screens/OrdersScreen';
import ProfileScreen from '../screens/ProfileScreen';
import OrderSuccessScreen from '../screens/OrderSuccessScreen';
import DeliveredSupportScreen from '../screens/DeliveredSupportScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const ShopStack = createNativeStackNavigator();
const HomeStack = createNativeStackNavigator();

// ─── Tab icon mapping ────────────────────────────────────────────
const TAB_ICONS = {
  HomeTab: { active: 'home', inactive: 'home-outline' },
  ShopTab: { active: 'grid', inactive: 'grid-outline' },
  CartTab: { active: 'bag', inactive: 'bag-outline' },
  OrdersTab: { active: 'receipt', inactive: 'receipt-outline' },
  ProfileTab: { active: 'person', inactive: 'person-outline' },
};

// ─── Product Detail screen config ────────────────────────────────
const productDetailOptions = {
  headerShown: true, headerTitle: '', headerBackTitle: 'Back',
  headerStyle: { backgroundColor: COLORS.background },
  headerTintColor: COLORS.primary,
  animation: 'slide_from_right',
};

// ─── Home Stack ──────────────────────────────────────────────────
function HomeStackScreen() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      <HomeStack.Screen name="Home" component={HomeScreen} />
      <HomeStack.Screen name="ProductDetail" component={ProductDetailScreen} options={productDetailOptions} />
    </HomeStack.Navigator>
  );
}

// ─── Shop Stack ──────────────────────────────────────────────────
function ShopStackScreen() {
  return (
    <ShopStack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      <ShopStack.Screen name="Shop" component={ShopScreen} />
      <ShopStack.Screen name="ProductDetail" component={ProductDetailScreen} options={productDetailOptions} />
    </ShopStack.Navigator>
  );
}

// ─── Auth-gated wrapper ──────────────────────────────────────────
function withAuthGate(WrappedComponent) {
  return function AuthGated(props) {
    const { isAuthenticated, loading } = useAuth();

    React.useEffect(() => {
      if (!loading && !isAuthenticated) {
        props.navigation.navigate('Login');
      }
    }, [isAuthenticated, loading]);

    if (loading) return <LoadingScreen />;
    if (!isAuthenticated) return <LoadingScreen />;
    return <WrappedComponent {...props} />;
  };
}

const OrdersScreenGated = withAuthGate(OrdersScreen);
const ProfileScreenGated = withAuthGate(ProfileScreen);

// ─── Tab Badge ───────────────────────────────────────────────────
function TabBadge({ count }) {
  if (count <= 0) return null;
  return (
    <View style={tabBadgeStyles.container}>
      <Text style={tabBadgeStyles.text}>{count > 9 ? '9+' : count}</Text>
    </View>
  );
}

const tabBadgeStyles = StyleSheet.create({
  container: {
    position: 'absolute', top: -4, right: -10,
    backgroundColor: COLORS.error,
    borderRadius: 10, minWidth: 18, height: 18,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 4, borderWidth: 2, borderColor: COLORS.surface,
  },
  text: { color: COLORS.white, fontSize: 9, fontWeight: '700' },
});

// ─── Main Tabs ───────────────────────────────────────────────────
function MainTabs() {
  const { totalItems } = useCart();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: {
          backgroundColor: COLORS.surface,
          elevation: 0, shadowOpacity: 0,
        },
        headerTitleStyle: {
          color: COLORS.textPrimary, fontWeight: '700', fontSize: 18,
        },
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopWidth: 0,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 24 : 10,
          height: Platform.OS === 'ios' ? 88 : 68,
          ...SHADOWS.lg,
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: {
          fontSize: 11, fontWeight: '600', marginTop: 2,
        },
        tabBarIcon: ({ focused, color }) => {
          const iconConfig = TAB_ICONS[route.name];
          const iconName = focused ? iconConfig.active : iconConfig.inactive;

          if (route.name === 'CartTab') {
            return (
              <View>
                <Ionicons name={iconName} size={22} color={color} />
                <TabBadge count={totalItems} />
              </View>
            );
          }

          return <Ionicons name={iconName} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackScreen}
        options={{ headerShown: false, tabBarLabel: 'Home', tabBarAccessibilityLabel: 'Home tab' }}
      />
      <Tab.Screen
        name="ShopTab"
        component={ShopStackScreen}
        options={{ headerShown: false, tabBarLabel: 'Shop', tabBarAccessibilityLabel: 'Shop tab' }}
      />
      <Tab.Screen
        name="CartTab"
        component={CartScreen}
        options={{ headerTitle: 'Cart', tabBarLabel: 'Cart', tabBarAccessibilityLabel: 'Shopping cart tab' }}
      />
      <Tab.Screen
        name="OrdersTab"
        component={OrdersScreenGated}
        options={{ headerTitle: 'My Orders', tabBarLabel: 'Orders', tabBarAccessibilityLabel: 'My orders tab' }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreenGated}
        options={{ headerTitle: 'Profile', tabBarLabel: 'Profile', tabBarAccessibilityLabel: 'Profile tab' }}
      />
    </Tab.Navigator>
  );
}

// ─── Root Navigator ──────────────────────────────────────────────
export default function AppNavigator() {
  const { loading } = useAuth();
  const navigationRef = useRef(null);

  // ─── Handle push notification taps ─────────────────────────────
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        if (data?.screen === 'OrdersTab' && navigationRef.current) {
          navigationRef.current.navigate('MainTabs', { screen: 'OrdersTab' });
        }
      }
    );
    return () => subscription.remove();
  }, []);

  if (loading) return <LoadingScreen />;

  // ─── Deep link configuration ─────────────────────────────────────
  const linking = {
    prefixes: [Linking.createURL('/'), 'coreatoms://'],
    config: {
      screens: {
        MainTabs: {
          screens: {
            HomeTab: { screens: { Home: 'home', ProductDetail: 'product/:productId' } },
            ShopTab: { screens: { Shop: 'shop' } },
            CartTab: 'cart',
            OrdersTab: 'orders',
            ProfileTab: 'profile',
          },
        },
        Login: 'login',
        Checkout: 'checkout',
        OrderSuccess: 'order-success',
        DeliveredSupport: 'delivered-support',
      },
    },
  };

  return (
    <NavigationContainer ref={navigationRef} linking={linking} fallback={<LoadingScreen />}>
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade_from_bottom' }}>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="ForgotPassword"
            component={ForgotPasswordScreen}
            options={{
              headerShown: true, headerTitle: '',
              headerBackTitle: 'Back',
              headerStyle: { backgroundColor: COLORS.background },
              headerTintColor: COLORS.primary,
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="Checkout"
            component={CheckoutScreen}
            options={{
              headerShown: true, headerTitle: 'Checkout',
              headerBackTitle: 'Cart',
              headerStyle: { backgroundColor: COLORS.background },
              headerTintColor: COLORS.primary,
              headerTitleStyle: { fontWeight: '700', color: COLORS.textPrimary },
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="OrderSuccess"
            component={OrderSuccessScreen}
            options={{ gestureEnabled: false, animation: 'fade' }}
          />
          <Stack.Screen
            name="DeliveredSupport"
            component={DeliveredSupportScreen}
            options={{
              headerShown: true,
              headerTitle: 'Delivered Order Support',
              headerStyle: { backgroundColor: COLORS.background },
              headerTintColor: COLORS.primary,
              headerTitleStyle: { fontWeight: '700', color: COLORS.textPrimary },
              animation: 'slide_from_right',
            }}
          />
        </Stack.Navigator>
    </NavigationContainer>
  );
}
