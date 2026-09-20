export type DisplayMode = 'A' | 'B';

export interface ExtensionSettings {
  enabled: boolean;
  mode: DisplayMode;
  baseURL: string;
  model: string;
  apiKey: string;
}

export interface ContentSettings {
  enabled: boolean;
  mode: DisplayMode;
}

export const DEFAULT_SETTINGS: ExtensionSettings = Object.freeze({
  enabled: true,
  mode: 'A',
  baseURL: '',
  model: '',
  apiKey: ''
});

export const DEFAULT_CONTENT_SETTINGS: ContentSettings = Object.freeze({
  enabled: DEFAULT_SETTINGS.enabled,
  mode: DEFAULT_SETTINGS.mode
});

export const CONTENT_SETTING_KEYS = ['enabled', 'mode'] as const;
