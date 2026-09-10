import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { parseRule, describeRule } from './recurrence';

// CSV export of the expense list. Deliberately a flat, re-importable sheet:
// no totals row, no internal columns (id, userId, scheduler flags), and the
// recurrence rule rendered as prose rather than its JSON encoding.
const BOM = '\uFEFF';
const COLUMNS = ['Date', 'Amount', 'Name', 'Category', 'Recurring'];

// Excel/Numbers treat a leading =, +, - or @ as a formula. Prefixing with a
// single quote keeps user-entered names inert when the sheet is opened.
function escapeCell(value) {
  const s = String(value ?? '');
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

// Local YYYY-MM-DD — sorts correctly in every spreadsheet, and avoids the
// day-shift that toISOString() causes for evening timestamps.
function isoDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function buildCsv(expenses) {
  const rows = expenses.map((e) => {
    const date = new Date(e.date);
    const rule = e.isRecurring ? parseRule(e.recurringFreq) : null;
    return [
      isoDate(date),
      // Raw number, no currency symbol — a "$12.50" string breaks SUM().
      e.amount.toFixed(2),
      e.title,
      e.category,
      rule ? describeRule(rule, date) : '',
    ].map(escapeCell).join(',');
  });
  return [COLUMNS.join(','), ...rows].join('\n');
}

export function exportFilename(now = new Date()) {
  return `series-expenses-${isoDate(now)}.csv`;
}

// Writes the CSV to the cache directory and opens the native share sheet
// (AirDrop, Mail, Save to Files). Returns false when sharing is unavailable.
export async function shareExpensesCsv(expenses) {
  if (!(await Sharing.isAvailableAsync())) return false;

  const file = new File(Paths.cache, exportFilename());
  file.create({ overwrite: true });
  // Leading BOM so Excel reads the file as UTF-8 (rule descriptions contain
  // an em dash); Numbers and Sheets ignore it.
  file.write(BOM + buildCsv(expenses));

  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
    dialogTitle: 'Export expenses',
  });
  return true;
}
