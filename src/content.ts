import browser from 'webextension-polyfill';
import { createBackgroundTranslationService } from './content/background-translator.ts';
import { installDebugEventBridge } from './content/debug-bridge.ts';
import { createContentRuntime } from './content/runtime.ts';
import { loadContentSettings } from './content/settings.ts';
import type { TranslateRequest } from './background/protocol.ts';
import type { ContentSettingsStorage } from './content/settings.ts';

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
  const runtime = createContentRuntime({
    document,
    translator,
    initialMode: settings.mode,
    initialEnabled: settings.enabled,
    onDiagnostic(diagnostic) {
      console.warn('[cs2-hltv-zh] content diagnostic', diagnostic);
    }
  });

  // Temporary B3a debug entry point via document events. B4 will replace it with real settings UI wiring.
  installDebugEventBridge(document, runtime);
  await runtime.start();
}

void startContentScript();
