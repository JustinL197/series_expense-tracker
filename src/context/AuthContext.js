import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearWidget } from '../utils/widgetSync';

const TOKEN_KEY = 'auth_token';
const INSTALLED_KEY = 'app_installed';
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(undefined); // undefined = loading, null = signed out

  useEffect(() => {
    async function loadToken() {
      const installed = await AsyncStorage.getItem(INSTALLED_KEY);
      if (!installed) {
        // Fresh install — AsyncStorage was wiped, so clear any stale Keychain token
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        await AsyncStorage.setItem(INSTALLED_KEY, '1');
        setToken(null);
      } else {
        const t = await SecureStore.getItemAsync(TOKEN_KEY);
        setToken(t ?? null);
      }
    }
    loadToken();
  }, []);

  async function signIn(identityToken, email) {
    const res = await fetch(`${BASE_URL}/auth/apple`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identityToken, email }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || body.error || 'Authentication failed');
    }
    const { token: jwt } = await res.json();
    await SecureStore.setItemAsync(TOKEN_KEY, jwt);
    setToken(jwt);
  }

  async function signOut() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken(null);
    clearWidget();
  }

  return (
    <AuthContext.Provider value={{ token, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
