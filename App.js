import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { CategoriesProvider } from './src/context/CategoriesContext';
import SummaryScreen from './src/screens/SummaryScreen';
import AddExpenseScreen from './src/screens/AddExpenseScreen';
import ExpenseListScreen from './src/screens/ExpenseListScreen';

const Tab = createMaterialTopTabNavigator();

export default function App() {
  return (
    <CategoriesProvider>
    <NavigationContainer>
      <StatusBar style="light" />
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
