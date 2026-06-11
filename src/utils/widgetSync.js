import WidgetSync from '../../modules/widget-sync';
import { api } from '../api/expenses';

// Pushes fresh day/month totals into the App Group so the home screen
// widget updates immediately. No-op in Expo Go (native module absent).
// Fire-and-forget: failures here should never affect the calling flow.
export async function syncWidget() {
  if (!WidgetSync) return;
  try {
    const [day, month] = await Promise.all([
      api.getSummary('day'),
      api.getSummary('month'),
    ]);
    WidgetSync.setWidgetData(
      JSON.stringify({
        today: day?.total ?? 0,
        month: month?.total ?? 0,
        date: new Date().toISOString(),
      })
    );
  } catch (e) {
    console.log('[widget] sync skipped:', e.message);
  }
}

export function clearWidget() {
  WidgetSync?.clearWidgetData();
}
