import browser from 'webextension-polyfill';
import { createContentRuntime } from './content/runtime.ts';
import { createStubTranslationService } from './content/stub-translator.ts';

browser.runtime.getManifest();

console.log(`[cs2-hltv-zh] content script injected at ${location.href}`);

const runtime = createContentRuntime({
  document,
  translator: createStubTranslationService(),
  initialMode: 'A',
  initialEnabled: true,
  onDiagnostic(diagnostic) {
    console.warn('[cs2-hltv-zh] content diagnostic', diagnostic);
  }
});

// Temporary B2 debug entry point. B4 will replace this with the options/runtime wiring.
(window as Window & {
  __hltvZh?: {
    setEnabled(enabled: boolean): Promise<void>;
    setMode(mode: 'A' | 'B'): Promise<void>;
    stats(): ReturnType<typeof runtime.stats>;
  };
}).__hltvZh = {
  setEnabled: (enabled) => runtime.setEnabled(enabled),
  setMode: (mode) => runtime.setMode(mode),
  stats: () => runtime.stats()
};

void runtime.start();
