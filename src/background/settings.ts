import {
  DEFAULT_SETTINGS,
  type DisplayMode,
  type ExtensionSettings
} from '../shared/settings.ts';

export interface ExtensionSettingsStorage {
  get(keys: readonly string[] | null): Promise<Record<string, unknown>>;
  set(values: Record<string, unknown>): Promise<void>;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readMode(value: unknown): DisplayMode {
  return value === 'B' ? 'B' : 'A';
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function normalizeSettings(values: Record<string, unknown>): ExtensionSettings {
  return {
    enabled: readBoolean(values.enabled, DEFAULT_SETTINGS.enabled),
    mode: readMode(values.mode),
    baseURL: readString(values.baseURL, DEFAULT_SETTINGS.baseURL),
    model: readString(values.model, DEFAULT_SETTINGS.model),
    apiKey: readString(values.apiKey, DEFAULT_SETTINGS.apiKey)
  };
}

export async function loadSettings(
  storage: ExtensionSettingsStorage
): Promise<ExtensionSettings> {
  return normalizeSettings(await storage.get(null));
}

export async function saveSettings(
  storage: ExtensionSettingsStorage,
  settings: ExtensionSettings
): Promise<void> {
  await storage.set({ ...settings });
}

export { DEFAULT_SETTINGS } from '../shared/settings.ts';
