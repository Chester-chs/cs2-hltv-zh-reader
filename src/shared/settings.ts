export type DisplayMode = 'A' | 'B';
export type ProviderPreset = 'deepseek' | 'openai' | 'custom';
export type ThemeMode = 'system' | 'light' | 'dark';
export type CardColor = 'neutral' | 'blue' | 'green' | 'sand' | 'rose';
export type AudienceMode = 'reader' | 'learner';
export type NativeLanguage = 'zh-CN' | 'en';
export type TranslationStyle = 'natural' | 'literal';
export type UiLanguage = 'zh-CN';

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
  translationStyle: TranslationStyle;
  fallbackEnabled?: boolean;
  fallbackBaseURL?: string;
  fallbackModel?: string;
  fallbackApiKey?: string;
}

export interface ContentSettings {
  enabled: boolean;
  mode: DisplayMode;
  nativeLanguage: NativeLanguage | null;
  interfaceLanguageSelected: boolean;
  audienceMode: AudienceMode;
  uiLanguage: UiLanguage;
  theme: ThemeMode;
  cardColor: CardColor;
  fontScale: number;
  showOriginal: boolean;
  showPinyin: boolean;
  showDifficulty: boolean;
  showExamples: boolean;
}

export const DEFAULT_SETTINGS: ExtensionSettings = Object.freeze({
  enabled: true,
  mode: 'A',
  providerPreset: 'deepseek',
  baseURL: PROVIDER_PRESETS.deepseek.baseURL,
  model: PROVIDER_PRESETS.deepseek.model,
  apiKey: '',
  useJsonOutputMode: true,
  translationStyle: 'natural'
});

export const DEFAULT_CONTENT_SETTINGS: ContentSettings = Object.freeze({
  enabled: DEFAULT_SETTINGS.enabled,
  mode: DEFAULT_SETTINGS.mode,
  nativeLanguage: 'zh-CN',
  interfaceLanguageSelected: true,
  audienceMode: 'reader',
  uiLanguage: 'zh-CN',
  theme: 'system',
  cardColor: 'neutral',
  fontScale: 1,
  showOriginal: false,
  showPinyin: false,
  showDifficulty: true,
  showExamples: true
});

export const CONTENT_SETTING_KEYS = [
  'enabled',
  'mode',
  'nativeLanguage',
  'interfaceLanguageSelected',
  'audienceMode',
  'uiLanguage',
  'theme',
  'cardColor',
  'fontScale',
  'showOriginal',
  'showPinyin',
  'showDifficulty',
  'showExamples'
] as const;
