const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  console.log(`[API] ${options.method || 'GET'} ${url}`);
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status} ${options.method || 'GET'} ${url}`);
  return res.json();
}

export const api = {
  getSummary: (range) => request(`/expenses/summary?range=${range}`),
  getExpenses: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/expenses${query ? `?${query}` : ''}`);
  },
  getExpensesByMonth: (year, month) => {
    const from = new Date(year, month, 1).toISOString();
    const to = new Date(year, month + 1, 0, 23, 59, 59, 999).toISOString();
    return request(`/expenses?from=${from}&to=${to}`);
  },
  addExpense: (data) => request('/expenses', { method: 'POST', body: JSON.stringify(data) }),
  updateExpense: (id, data) => request(`/expenses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteExpense: (id) => request(`/expenses/${id}`, { method: 'DELETE' }),
};
