import {
  CONTENT_SETTING_KEYS,
  DEFAULT_CONTENT_SETTINGS,
  type ContentSettings,
  type NativeLanguage,
  type DisplayMode,
  type ThemeMode,
  type CardColor
} from '../shared/settings.ts';

export interface ContentSettingsStorage {
  get(keys: readonly string[]): Promise<Record<string, unknown>>;
}

function readMode(value: unknown): DisplayMode {
  return value === 'B' ? 'B' : 'A';
}

function readNativeLanguage(_value: unknown): NativeLanguage {
  // English-native onboarding was removed. Existing stored values migrate to
  // the Chinese-reader audience without showing a second language question.
  return 'zh-CN';
}

function readTheme(value: unknown): ThemeMode {
  return value === 'light' || value === 'dark' ? value : 'system';
}

function readCardColor(value: unknown): CardColor {
  return value === 'blue' || value === 'green' || value === 'sand' || value === 'rose'
    ? value
    : 'neutral';
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
    const nativeLanguage = readNativeLanguage(values.nativeLanguage);
    return {
      enabled:
        typeof values.enabled === 'boolean'
          ? values.enabled
          : DEFAULT_CONTENT_SETTINGS.enabled,
      mode: readMode(values.mode),
      nativeLanguage,
      // The extension is intentionally a Chinese-reader product. Migrate any
      // legacy English onboarding values without exposing that choice again.
      interfaceLanguageSelected: true,
      audienceMode: 'reader',
      uiLanguage: 'zh-CN',
      theme: readTheme(values.theme),
      cardColor: readCardColor(values.cardColor),
      fontScale: readFontScale(values.fontScale),
      showOriginal: false,
      showPinyin: false,
      showDifficulty: typeof values.showDifficulty === 'boolean' ? values.showDifficulty : DEFAULT_CONTENT_SETTINGS.showDifficulty,
      showExamples: typeof values.showExamples === 'boolean' ? values.showExamples : DEFAULT_CONTENT_SETTINGS.showExamples
    };
  } catch {
    return { ...DEFAULT_CONTENT_SETTINGS };
  }
}
