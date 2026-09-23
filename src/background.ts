import browser from 'webextension-polyfill';
import { createIndexedDbCacheStore } from './background/cache-store.ts';
import { loadPackagedGlossary } from './background/glossary-loader.ts';
import {
  createBackgroundMessageHandler,
  installBackgroundMessageHandler
} from './background/translation-handler.ts';
import { createCoreBackgroundTranslationRunner } from './background/translation-engine.ts';
import type { ExtensionSettingsStorage } from './background/settings.ts';
import { createProviderPermissionMonitor } from './background/provider-permissions.ts';
import { createBackgroundProviderFactory } from './background/provider.ts';

const { version } = browser.runtime.getManifest();

console.log(`[cs2-hltv-zh] background started (version ${version})`);

const cacheStore = createIndexedDbCacheStore({
  onDiagnostic(diagnostic) {
    console.warn('[cs2-hltv-zh] cache diagnostic', diagnostic.code, diagnostic.key);
  }
});

const glossary = loadPackagedGlossary(
  browser.runtime.getURL('glossary.json'),
  undefined,
  (diagnostic) => {
    console.warn('[cs2-hltv-zh] glossary diagnostic', diagnostic.code);
  }
);

const runner = createCoreBackgroundTranslationRunner({
  glossary,
  cacheStore,
  providerFactory: createBackgroundProviderFactory()
});

const providerPermissionMonitor = createProviderPermissionMonitor({
  storage: browser.storage.local as unknown as ExtensionSettingsStorage,
  storageChanges: browser.storage.onChanged,
  permissions: browser.permissions,
  onDiagnostic(diagnostic) {
    if (diagnostic === undefined) {
      console.info('[cs2-hltv-zh] provider permission diagnostic cleared');
      return;
    }
    console.warn(
      '[cs2-hltv-zh] provider permission diagnostic',
      diagnostic.code,
      diagnostic.origin
    );
  }
});
providerPermissionMonitor.install();
void providerPermissionMonitor.checkSavedSettings();

const messageHandler = createBackgroundMessageHandler({
  storage: browser.storage.local as unknown as ExtensionSettingsStorage,
  runner,
  hasProviderPermission: providerPermissionMonitor.hasProviderPermission
});

installBackgroundMessageHandler(
  browser.runtime.onMessage,
  messageHandler
);
