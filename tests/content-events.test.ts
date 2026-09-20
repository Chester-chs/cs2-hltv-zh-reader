interface StrictAssert {
  equal(actual: unknown, expected: unknown, message?: string): void;
  deepEqual(actual: unknown, expected: unknown, message?: string): void;
}

const nodeAssertModuleName = 'node:assert/strict';
const { strict: assert } = (await import(nodeAssertModuleName)) as {
  strict: StrictAssert;
};

const nodeTestModuleName = 'node:test';
const { test } = (await import(nodeTestModuleName)) as {
  test(name: string, callback: () => void | Promise<void>): void;
};

import {
  installDebugEventBridge,
  type DebugBridgeRuntime
} from '../src/content/debug-bridge.ts';

interface FakeEvent {
  type: string;
  detail?: unknown;
}

class FakeDocument {
  readonly listeners = new Map<string, Array<(event: FakeEvent) => void>>();
  readonly dispatched: FakeEvent[] = [];

  addEventListener(
    type: string,
    listener: (event: FakeEvent) => void
  ): void {
    const current = this.listeners.get(type) ?? [];
    current.push(listener);
    this.listeners.set(type, current);
  }

  dispatchEvent(event: FakeEvent): boolean {
    this.dispatched.push(event);
    for (const listener of this.listeners.get(event.type) ?? []) {
      listener(event);
    }
    return true;
  }

  emit(type: string, detail?: unknown): void {
    this.dispatchEvent({ type, detail });
  }
}

function asDocument(document: FakeDocument): Pick<Document, 'addEventListener' | 'dispatchEvent'> {
  return document as unknown as Pick<Document, 'addEventListener' | 'dispatchEvent'>;
}

test('document debug events forward valid mode and enabled values only', async () => {
  const document = new FakeDocument();
  const calls: string[] = [];
  const runtime: DebugBridgeRuntime = {
    setMode(mode) {
      calls.push(`mode:${mode}`);
      return Promise.resolve();
    },
    setEnabled(enabled) {
      calls.push(`enabled:${enabled}`);
      return Promise.resolve();
    },
    stats() {
      return {
        processedNodes: 2,
        skippedNodes: 1,
        mode: 'A' as const,
        enabled: true
      };
    }
  };

  installDebugEventBridge(asDocument(document), runtime, (type, detail) => ({
    type,
    detail
  } as unknown as CustomEvent));

  document.emit('hltv-zh-set-mode', 'B');
  document.emit('hltv-zh-set-mode', 'invalid');
  document.emit('hltv-zh-set-enabled', false);
  document.emit('hltv-zh-set-enabled', 'false');
  await Promise.resolve();

  assert.deepEqual(calls, ['mode:B', 'enabled:false']);
  assert.equal(document.listeners.has('hltv-zh-set-mode'), true);
  assert.equal(document.listeners.has('hltv-zh-set-enabled'), true);
  assert.equal(document.listeners.has('hltv-zh-stats-request'), true);
});

test('stats request responds on document with structured-cloneable data', () => {
  const document = new FakeDocument();
  const runtime: DebugBridgeRuntime = {
    setMode: () => Promise.resolve(),
    setEnabled: () => Promise.resolve(),
    stats: () => ({
      processedNodes: 7,
      skippedNodes: 3,
      mode: 'B',
      enabled: false
    })
  };

  installDebugEventBridge(asDocument(document), runtime, (type, detail) => ({
    type,
    detail
  } as unknown as CustomEvent));

  document.emit('hltv-zh-stats-request');

  assert.deepEqual(document.dispatched.at(-1), {
    type: 'hltv-zh-stats',
    detail: {
      processedNodes: 7,
      skippedNodes: 3,
      mode: 'B',
      enabled: false
    }
  });
});
