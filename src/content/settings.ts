import {
  CONTENT_SETTING_KEYS,
  DEFAULT_CONTENT_SETTINGS,
  type ContentSettings,
  type DisplayMode
} from '../shared/settings.ts';

export interface ContentSettingsStorage {
  get(keys: readonly string[]): Promise<Record<string, unknown>>;
}

function readMode(value: unknown): DisplayMode {
  return value === 'B' ? 'B' : 'A';
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
      mode: readMode(values.mode)
    };
  } catch {
    return { ...DEFAULT_CONTENT_SETTINGS };
  }
}
