import type { DisplayMode } from '../core/display/index.ts';
import type { ContentRuntimeStats } from './runtime.ts';

export interface DebugBridgeRuntime {
  setMode(mode: DisplayMode): Promise<void>;
  setEnabled(enabled: boolean): Promise<void>;
  stats(): ContentRuntimeStats;
}

export type DebugEventDocument = Pick<
  Document,
  'addEventListener' | 'dispatchEvent'
>;

export type DebugEventFactory = (
  type: string,
  detail?: unknown
) => CustomEvent;

function createCustomEvent(type: string, detail?: unknown): CustomEvent {
  return new CustomEvent(type, { detail });
}

export function installDebugEventBridge(
  document: DebugEventDocument,
  runtime: DebugBridgeRuntime,
  eventFactory: DebugEventFactory = createCustomEvent
): void {
  document.addEventListener('hltv-zh-set-mode', (event) => {
    const mode = (event as CustomEvent<unknown>).detail;
    if (mode === 'A' || mode === 'B') {
      void runtime.setMode(mode);
    }
  });

  document.addEventListener('hltv-zh-set-enabled', (event) => {
    const enabled = (event as CustomEvent<unknown>).detail;
    if (typeof enabled === 'boolean') {
      void runtime.setEnabled(enabled);
    }
  });

  document.addEventListener('hltv-zh-stats-request', () => {
    const stats = runtime.stats();
    document.dispatchEvent(
      eventFactory('hltv-zh-stats', {
        processedNodes: stats.processedNodes,
        skippedNodes: stats.skippedNodes,
        mode: stats.mode,
        enabled: stats.enabled
      })
    );
  });
}
