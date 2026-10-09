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
import { DEFAULT_SETTINGS } from '../src/shared/settings.ts';
import {
  loadPopupState,
  resolvePopupReadiness,
  setPopupEnabled,
  setPopupMode
} from '../src/popup/controller.ts';

test('popup asks for an API key before translation when the provider is authorized', () => {
  assert.deepEqual(
    resolvePopupReadiness('', {
      state: 'granted',
      origin: 'https://api.deepseek.com'
    }),
    { kind: 'api-key-missing' }
  );
});

test('popup reports the configured provider origin when its permission is missing', () => {
  assert.deepEqual(
    resolvePopupReadiness('user-key', {
      state: 'missing',
      origin: 'https://gateway.example'
    }),
    { kind: 'permission-missing', origin: 'https://gateway.example' }
  );
});

test('popup exposes readiness and page controls without exposing the API key', async () => {
  const settings = { ...DEFAULT_SETTINGS, apiKey: 'private-key' };
  let requestedOrigins: string[] = [];
  const state = await loadPopupState(
    {
      async get(keys) {
        assert.equal(keys, null);
        return settings;
      },
      async set() {}
    },
    {
      async contains({ origins }) {
        requestedOrigins = origins;
        return true;
      }
    }
  );

  assert.deepEqual(state, {
    enabled: true,
    mode: 'A',
    interfaceLanguageSelected: true,
    uiLanguage: 'zh-CN',
    readiness: { kind: 'ready', origin: 'https://api.deepseek.com' }
  });
  assert.deepEqual(requestedOrigins, ['https://api.deepseek.com/*']);
});

test('popup enable control writes only the enabled preference', async () => {
  const writes: Record<string, unknown>[] = [];
  await setPopupEnabled({
    async set(values) {
      writes.push(values);
    }
  }, false);

  assert.deepEqual(writes, [{ enabled: false }]);
});

test('popup mode control writes only the selected display mode', async () => {
  const writes: Record<string, unknown>[] = [];
  await setPopupMode({
    async set(values) {
      writes.push(values);
    }
  }, 'B');

  assert.deepEqual(writes, [{ mode: 'B' }]);
});
