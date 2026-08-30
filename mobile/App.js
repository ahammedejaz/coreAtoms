/**
 * App.js — Root entry point for Core Atoms mobile app.
 *
 * Provider hierarchy (mirrors web main.jsx):
 * SafeAreaProvider → ErrorBoundary → ToastProvider → AuthProvider → CartProvider → Navigator
 */
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from './src/context/ToastContext';
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import NetworkBanner from './src/components/NetworkBanner';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <ErrorBoundary>
        <ToastProvider>
          <AuthProvider>
            <CartProvider>
              <NetworkBanner />
              <AppNavigator />
            </CartProvider>
          </AuthProvider>
        </ToastProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
