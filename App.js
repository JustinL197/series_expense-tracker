import 'react-native-gesture-handler';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts, Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter';
import * as Notifications from 'expo-notifications';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  // Dev crashes are already visible in Metro; keeping them out of Sentry
  // saves free-tier quota for what real users actually hit.
  enabled: !__DEV__,
  sendDefaultPii: false,
  // Breadcrumbs record our [API] console logs, whose URLs carry query params
  // like ?category=<user's own category name>. Keep the path, drop the query.
  beforeBreadcrumb(crumb) {
    if (typeof crumb.message === 'string') {
      crumb.message = crumb.message.replace(/\?[^\s]*/g, '');
    }
    if (crumb.data?.url) {
      crumb.data.url = String(crumb.data.url).split('?')[0];
    }
    return crumb;
  },
});

// Show reminder banners even if the app happens to be foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});
import { NavigationContainer } from '@react-navigation/native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { CategoriesProvider } from './src/context/CategoriesContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { setAuthToken, setOnUnauthorized } from './src/api/expenses';
import SummaryScreen from './src/screens/SummaryScreen';
import AddExpenseScreen from './src/screens/AddExpenseScreen';
import ExpenseListScreen from './src/screens/ExpenseListScreen';
import LoginScreen from './src/screens/LoginScreen';
import AnimatedPageDots from './src/components/AnimatedPageDots';

const Tab = createMaterialTopTabNavigator();

function AppNavigator() {
  const { token, signOut } = useAuth();

  // Set synchronously so CategoriesProvider has the token available
  // the moment it mounts — a useEffect would be too late.
  setAuthToken(token ?? null);
  setOnUnauthorized(signOut);

  // token === undefined means SecureStore hasn't resolved yet — render nothing
  if (token === undefined) return null;

  if (!token) return <LoginScreen />;

  return (
    <CategoriesProvider>
      <NavigationContainer>
        <Tab.Navigator
          initialRouteName="Add"
          tabBarPosition="bottom"
          tabBar={(props) => <AnimatedPageDots {...props} />}
          screenOptions={{
            swipeEnabled: true,
            animationEnabled: true,
            lazy: false,
          }}
        >
          <Tab.Screen name="Summary" component={SummaryScreen} />
          <Tab.Screen name="Add" component={AddExpenseScreen} />
          <Tab.Screen name="List" component={ExpenseListScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </CategoriesProvider>
  );
}

function App() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium });
  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <AppNavigator />
      </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Wraps the root so native crashes and unhandled JS errors are captured.
export default Sentry.wrap(App);
