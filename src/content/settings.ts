import {
  CONTENT_SETTING_KEYS,
  DEFAULT_CONTENT_SETTINGS,
  type ContentSettings,
  type DisplayMode,
  type ThemeMode
} from '../shared/settings.ts';

export interface ContentSettingsStorage {
  get(keys: readonly string[]): Promise<Record<string, unknown>>;
}

function readMode(value: unknown): DisplayMode {
  return value === 'B' ? 'B' : 'A';
}

function readTheme(value: unknown): ThemeMode {
  return value === 'light' || value === 'dark' ? value : 'system';
}

function readFontScale(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0.8, Math.min(1.25, value))
    : 1;
}

export async function loadContentSettings(
  storage: ContentSettingsStorage
): Promise<ContentSettings> {
  try {
    const values = await storage.get(CONTENT_SETTING_KEYS);
    return {
      enabled:
        typeof values.enabled === 'boolean'
          ? values.enabled
          : DEFAULT_CONTENT_SETTINGS.enabled,
      mode: readMode(values.mode),
      theme: readTheme(values.theme),
      fontScale: readFontScale(values.fontScale)
    };
  } catch {
    return { ...DEFAULT_CONTENT_SETTINGS };
  }
}
