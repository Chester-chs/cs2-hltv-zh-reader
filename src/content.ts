import browser from 'webextension-polyfill';
import { installDebugEventBridge } from './content/debug-bridge.ts';
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

// Temporary B2 debug entry point via document events. B4 will replace it with real settings UI wiring.
installDebugEventBridge(document, runtime);

void runtime.start();
