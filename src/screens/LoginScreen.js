import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity,
  Modal, ScrollView,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../constants';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  async function handleAppleSignIn() {
    setError(null);
    setLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      await signIn(credential.identityToken, credential.email);
    } catch (e) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        setError(e.message || 'Sign in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Series Expense</Text>

      {loading ? (
        <ActivityIndicator color={COLORS.text} />
      ) : (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
          cornerRadius={8}
          style={styles.button}
          onPress={handleAppleSignIn}
        />
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.infoBtn} onPress={() => setShowInfo(true)}>
        <Text style={styles.infoBtnText}>ⓘ  How your data is stored</Text>
      </TouchableOpacity>

      <Modal visible={showInfo} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.sheetTitle}>How your data is stored</Text>

              <Text style={styles.sectionHead}>Hide My Email</Text>
              <Text style={styles.body}>
                When you tap "Sign in with Apple," Apple gives you the option to share your real email or use a private relay address (e.g. xyz@privaterelay.appleid.com). Either way, your expenses are tied to your Apple ID — not your email.
              </Text>
              <Text style={styles.body}>
                Choosing "Hide My Email" means we never see your real address. Apple forwards any account-related messages through the relay, and you can disable it at any time from your Apple ID settings.
              </Text>

              <Text style={styles.sectionHead}>What we store</Text>
              <Text style={styles.body}>
                Your expenses (amount, category, title, date) are saved on a private server. Each expense is linked to an anonymized Apple ID — a unique string Apple generates for this app, not your Apple username or anything personally identifiable.
              </Text>
              <Text style={styles.body}>
                As the developer, I can see expense records in the database, but I have no way to connect them to a real person. There are no names, no readable emails, and no device info stored.
              </Text>

              <Text style={styles.sectionHead}>What we don't do</Text>
              <Text style={styles.body}>
                Your data is not sold, shared, or used for ads. It exists solely so your expenses sync across reinstalls and devices.
              </Text>
            </ScrollView>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowInfo(false)}>
              <Text style={styles.closeBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  title: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  button: {
    width: 240,
    height: 44,
  },
  error: {
    color: '#ff4444',
    fontSize: 14,
  },
  infoBtn: {
    marginTop: -8,
  },
  infoBtnText: {
    color: COLORS.subtext,
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    paddingBottom: 48,
    maxHeight: '80%',
  },
  sheetTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 24,
  },
  sectionHead: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 20,
  },
  body: {
    color: COLORS.subtext,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 10,
  },
  closeBtn: {
    marginTop: 24,
    backgroundColor: COLORS.text,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeBtnText: {
    color: COLORS.background,
    fontSize: 15,
    fontWeight: '600',
  },
});
