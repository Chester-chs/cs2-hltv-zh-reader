import {
  DEFAULT_SETTINGS,
  PROVIDER_PRESETS,
  type DisplayMode,
  type ExtensionSettings,
  type ProviderPreset
} from '../shared/settings.ts';
import { parseProviderBaseURL } from '../shared/provider-url.ts';

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

function resolveProviderPreset(
  value: unknown,
  baseURL: string
): ProviderPreset {
  if (value === 'deepseek' || value === 'openai' || value === 'custom') {
    return value;
  }

  const normalizedBaseURL =
    parseProviderBaseURL(baseURL)?.normalizedBaseURL;
  if (normalizedBaseURL === PROVIDER_PRESETS.deepseek.baseURL) {
    return 'deepseek';
  }
  if (normalizedBaseURL === PROVIDER_PRESETS.openai.baseURL) {
    return 'openai';
  }
  return 'custom';
}

function normalizeSettings(values: Record<string, unknown>): ExtensionSettings {
  const storedBaseURL = readString(
    values.baseURL,
    DEFAULT_SETTINGS.baseURL
  );
  const baseURL =
    storedBaseURL.trim().length === 0
      ? DEFAULT_SETTINGS.baseURL
      : storedBaseURL;
  const storedModel = readString(values.model, DEFAULT_SETTINGS.model);
  const model =
    storedModel.trim().length === 0 ? DEFAULT_SETTINGS.model : storedModel;

  const fallbackBaseURL = readString(values.fallbackBaseURL, '').trim();
  const fallbackModel = readString(values.fallbackModel, '').trim();
  const fallbackApiKey = readString(values.fallbackApiKey, '');
  const hasFallback = values.fallbackEnabled === true || fallbackBaseURL.length > 0 || fallbackModel.length > 0 || fallbackApiKey.length > 0;

  return {
    enabled: readBoolean(values.enabled, DEFAULT_SETTINGS.enabled),
    mode: readMode(values.mode),
    providerPreset: resolveProviderPreset(values.providerPreset, baseURL),
    baseURL,
    model,
    apiKey: readString(values.apiKey, DEFAULT_SETTINGS.apiKey),
    useJsonOutputMode: readBoolean(
      values.useJsonOutputMode,
      DEFAULT_SETTINGS.useJsonOutputMode
    ),
    ...(hasFallback
      ? {
          fallbackEnabled: readBoolean(values.fallbackEnabled, false),
          fallbackBaseURL,
          fallbackModel,
          fallbackApiKey
        }
      : {})
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
