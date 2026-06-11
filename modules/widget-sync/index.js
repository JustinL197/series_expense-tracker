import { requireOptionalNativeModule } from 'expo-modules-core';

// Null in Expo Go (no native module compiled in) — callers must handle that.
export default requireOptionalNativeModule('WidgetSync');
