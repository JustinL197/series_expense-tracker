import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { CategoriesProvider } from './src/context/CategoriesContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { setAuthToken } from './src/api/expenses';
import SummaryScreen from './src/screens/SummaryScreen';
import AddExpenseScreen from './src/screens/AddExpenseScreen';
import ExpenseListScreen from './src/screens/ExpenseListScreen';
import LoginScreen from './src/screens/LoginScreen';

const Tab = createMaterialTopTabNavigator();

function AppNavigator() {
  const { token } = useAuth();

  // Keep the API module in sync with the current token
  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  // token === undefined means SecureStore hasn't resolved yet — render nothing
  if (token === undefined) return null;

  if (!token) return <LoginScreen />;

  return (
    <CategoriesProvider>
      <NavigationContainer>
        <Tab.Navigator
          initialRouteName="Add"
          tabBarPosition="bottom"
          screenOptions={{
            tabBarStyle: { display: 'none' },
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

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <AppNavigator />
    </AuthProvider>
  );
}
