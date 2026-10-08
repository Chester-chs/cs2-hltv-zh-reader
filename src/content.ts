import browser from 'webextension-polyfill';
import glossary from '../glossary.json';
import { createBackgroundTranslationService } from './content/background-translator.ts';
import { installDebugEventBridge } from './content/debug-bridge.ts';
import { createContentRuntime } from './content/runtime.ts';
import { loadContentSettings } from './content/settings.ts';
import { applyContentSettingsChanges } from './content/settings-sync.ts';
import type { TranslateRequest } from './background/protocol.ts';
import type { ContentSettingsStorage } from './content/settings.ts';
import { installSelectionMagnifier } from './content/selection-translation.ts';
import { createDictionaryStore, type DictionaryStorage } from './content/dictionary-store.ts';

browser.runtime.getManifest();

console.log(`[cs2-hltv-zh] content script injected at ${location.href}`);

async function startContentScript(): Promise<void> {
  const settings = await loadContentSettings(
    browser.storage.local as unknown as ContentSettingsStorage
  );
  const translator = createBackgroundTranslationService({
    sendMessage(message: TranslateRequest) {
      return browser.runtime.sendMessage(message) as Promise<unknown>;
    }
  });
  const dictionaryStore = createDictionaryStore(
    browser.storage.local as unknown as DictionaryStorage
  );
  let currentTheme = settings.theme;
  let currentFontScale = settings.fontScale;
  const runtime = createContentRuntime({
    document,
    translator,
    fixedUiGlossary: glossary,
    initialMode: settings.mode,
    initialEnabled: settings.enabled,
    onDiagnostic(diagnostic) {
      console.warn('[cs2-hltv-zh] content diagnostic', diagnostic);
    }
  });

  const magnifier = installSelectionMagnifier({
    document,
    translator,
    dictionaryStore,
    appearance: {
      theme: settings.theme,
      fontScale: settings.fontScale
    },
    appearanceStore: browser.storage.local as unknown as DictionaryStorage
  });

  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') {
      return;
    }
    if (magnifier !== undefined && (Object.hasOwn(changes, 'theme') || Object.hasOwn(changes, 'fontScale'))) {
      const theme = changes.theme?.newValue;
      const fontScale = changes.fontScale?.newValue;
      if (theme === 'light' || theme === 'dark' || theme === 'system') {
        currentTheme = theme;
      }
      if (typeof fontScale === 'number' && Number.isFinite(fontScale)) {
        currentFontScale = fontScale;
      }
      magnifier.setAppearance({
        theme: currentTheme,
        fontScale: currentFontScale
      });
    }
    void applyContentSettingsChanges(runtime, changes).catch(() => {
      console.warn('[cs2-hltv-zh] content settings could not be applied');
    });
  });

  // Temporary B3a document-event bridge retained for runtime diagnostics.
  installDebugEventBridge(document, runtime);
  await runtime.start();
}

void startContentScript();
