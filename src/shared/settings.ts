export type DisplayMode = 'A' | 'B';
export type ProviderPreset = 'deepseek' | 'openai' | 'custom';

export const PROVIDER_PRESETS = Object.freeze({
  deepseek: Object.freeze({
    baseURL: 'https://api.deepseek.com',
    model: 'deepseek-chat'
  }),
  openai: Object.freeze({
    baseURL: 'https://api.openai.com',
    model: 'gpt-4o-mini'
  })
});

export interface ExtensionSettings {
  enabled: boolean;
  mode: DisplayMode;
  providerPreset: ProviderPreset;
  baseURL: string;
  model: string;
  apiKey: string;
  useJsonOutputMode: boolean;
}

export interface ContentSettings {
  enabled: boolean;
  mode: DisplayMode;
}

export const DEFAULT_SETTINGS: ExtensionSettings = Object.freeze({
  enabled: true,
  mode: 'A',
  providerPreset: 'deepseek',
  baseURL: PROVIDER_PRESETS.deepseek.baseURL,
  model: PROVIDER_PRESETS.deepseek.model,
  apiKey: '',
  useJsonOutputMode: true
});

export const DEFAULT_CONTENT_SETTINGS: ContentSettings = Object.freeze({
  enabled: DEFAULT_SETTINGS.enabled,
  mode: DEFAULT_SETTINGS.mode
});

export const CONTENT_SETTING_KEYS = ['enabled', 'mode'] as const;
