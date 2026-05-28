const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

let _token = null;

export function setAuthToken(token) {
  _token = token;
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  console.log(`[API] ${options.method || 'GET'} ${url}`);
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(_token ? { Authorization: `Bearer ${_token}` } : {}),
    },
    ...options,
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status} ${options.method || 'GET'} ${url}`);
  return res.json();
}

// Calculate range bounds in the user's LOCAL timezone.
// Returns { from, to? } as ISO strings.
export function localRangeBounds(range) {
  const now = new Date();
  const from = new Date(now);
  if (range === 'day') {
    from.setHours(0, 0, 0, 0);
  } else if (range === 'week') {
    // Sun–Sat calendar week
    from.setDate(now.getDate() - now.getDay());
    from.setHours(0, 0, 0, 0);
  } else if (range === 'month') {
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
  }
  return { from: from.toISOString() };
}

function localRangeFrom(range) {
  return localRangeBounds(range).from;
}

export const api = {
  getSummary: (range, { from, to } = {}) => {
    const resolvedFrom = from ?? localRangeFrom(range);
    const params = new URLSearchParams({ from: resolvedFrom });
    if (to) params.set('to', to);
    return request(`/expenses/summary?${params}`);
  },
  getExpenses: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/expenses${query ? `?${query}` : ''}`);
  },
  getExpensesByMonth: (year, month) => {
    const from = new Date(year, month, 1).toISOString();
    const to = new Date(year, month + 1, 0, 23, 59, 59, 999).toISOString();
    return request(`/expenses?from=${from}&to=${to}`);
  },
  getLatestExpenseDate: () => request('/expenses/latest-date'),
  getCategories: () => request('/categories'),
  saveCategories: (categories) => request('/categories', { method: 'PUT', body: JSON.stringify({ categories }) }),
  addExpense: (data) => request('/expenses', { method: 'POST', body: JSON.stringify(data) }),
  updateExpense: (id, data) => request(`/expenses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteExpense: (id) => request(`/expenses/${id}`, { method: 'DELETE' }),
};
