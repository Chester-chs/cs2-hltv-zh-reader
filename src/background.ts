import browser from 'webextension-polyfill';
import { createIndexedDbCacheStore } from './background/cache-store.ts';
import { createFakeProvider } from './background/fake-provider.ts';
import { loadPackagedGlossary } from './background/glossary-loader.ts';
import {
  createBackgroundMessageHandler,
  installBackgroundMessageHandler
} from './background/translation-handler.ts';
import { createCoreBackgroundTranslationRunner } from './background/translation-engine.ts';
import type { ExtensionSettingsStorage } from './background/settings.ts';

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
  // B3a deliberately uses a local fake. B3b replaces only this factory.
  providerFactory: () => createFakeProvider()
});

const messageHandler = createBackgroundMessageHandler({
  storage: browser.storage.local as unknown as ExtensionSettingsStorage,
  runner
});

installBackgroundMessageHandler(
  browser.runtime.onMessage,
  messageHandler
);
