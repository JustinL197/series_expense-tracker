import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/expenses';

const CategoriesContext = createContext();

export function CategoriesProvider({ children }) {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    api.getCategories()
      .then((cats) => setCategories(cats))
      .catch(() => setCategories([]));
  }, []);

  const addCategory = async (category) => {
    const updated = [...categories, category];
    setCategories(updated);
    await api.saveCategories(updated);
  };

  const deleteCategory = async (label) => {
    const updated = categories.filter((c) => c.label !== label);
    setCategories(updated);
    await api.saveCategories(updated);
  };

  return (
    <CategoriesContext.Provider value={{ allCategories: categories, addCategory, deleteCategory }}>
      {children}
    </CategoriesContext.Provider>
  );
}

export const useCategories = () => useContext(CategoriesContext);
