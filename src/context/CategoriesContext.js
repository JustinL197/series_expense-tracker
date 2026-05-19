import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_CATEGORIES } from '../constants';

const STORAGE_KEY = 'categories';

const CategoriesContext = createContext();

export function CategoriesProvider({ children }) {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        setCategories(JSON.parse(raw));
      } else {
        setCategories(DEFAULT_CATEGORIES);
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CATEGORIES));
      }
    });
  }, []);

  const addCategory = async (category) => {
    const updated = [...categories, category];
    setCategories(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const deleteCategory = async (label) => {
    const updated = categories.filter((c) => c.label !== label);
    setCategories(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  return (
    <CategoriesContext.Provider value={{ allCategories: categories, addCategory, deleteCategory }}>
      {children}
    </CategoriesContext.Provider>
  );
}

export const useCategories = () => useContext(CategoriesContext);
