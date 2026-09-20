interface StrictAssert {
  equal(actual: unknown, expected: unknown, message?: string): void;
  deepEqual(actual: unknown, expected: unknown, message?: string): void;
  match(actual: string, expected: RegExp, message?: string): void;
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
  decodeTranslateRequest,
  decodeTranslateResponse,
  encodeTranslateRequest,
  encodeTranslateResponse,
  type TranslateFailureResponse,
  type TranslateRequest,
  type TranslateResponse
} from '../src/background/protocol.ts';
import {
  createBackgroundMessageHandler,
  type BackgroundTranslationRunner
} from '../src/background/translation-handler.ts';
import {
  createFakeProvider,
  type FakeProviderMode
} from '../src/background/fake-provider.ts';
import { createCoreBackgroundTranslationRunner } from '../src/background/translation-engine.ts';
import { loadPackagedGlossary } from '../src/background/glossary-loader.ts';
import {
  createCacheStoreFromBackend,
  type CacheBackend
} from '../src/background/cache-store.ts';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  type ExtensionSettingsStorage
} from '../src/background/settings.ts';
import {
  loadContentSettings,
  type ContentSettingsStorage
} from '../src/content/settings.ts';
import { createBackgroundTranslationService } from '../src/content/background-translator.ts';
import {
  hashText,
  type TranslationProvider
} from '../src/core/translate/index.ts';

function successfulResponse(
  request: TranslateRequest,
  translations: string[] = request.texts.map((text) => `【译】${text}`)
): TranslateResponse {
  return encodeTranslateResponse({
    type: 'hltv-zh-translate-response',
    requestId: request.requestId,
    purpose: request.purpose,
    ok: true,
    translations
  });
}

function createStorage(values: Record<string, unknown>): ExtensionSettingsStorage & ContentSettingsStorage {
  return {
    async get() {
      return { ...values };
    },
    async set(nextValues) {
      Object.assign(values, nextValues);
    }
  };
}

test('translation message protocol round-trips batches and failure fallback', () => {
  const request: TranslateRequest = {
    type: 'hltv-zh-translate-request',
    requestId: 'request-1',
    purpose: 'event-name',
    texts: ['A long event title']
  };
  const decodedRequest = decodeTranslateRequest(encodeTranslateRequest(request));
  assert.deepEqual(decodedRequest, request);

  const failure: TranslateFailureResponse = {
    type: 'hltv-zh-translate-response',
    requestId: request.requestId,
    purpose: request.purpose,
    ok: false,
    translations: request.texts,
    error: {
      code: 'provider-failure',
      fallback: 'original',
      message: 'fake failure'
    }
  };
  const decodedFailure = decodeTranslateResponse(encodeTranslateResponse(failure));
  assert.deepEqual(decodedFailure, failure);
  assert.equal(decodeTranslateRequest({ type: 'unknown' }), undefined);
});

test('background glossary loader consumes injected packaged text at runtime', async () => {
  let requestedUrl = '';
  const glossary = await loadPackagedGlossary(
    'extension://test/glossary.json',
    async (url) => {
      requestedUrl = url;
      return {
        ok: true,
        async text() {
          return JSON.stringify({
            version: 1,
            entries: [
              {
                term: 'Fall',
                target: '秋季',
                keep_as_is: false,
                category: 'season'
              }
            ]
          });
        }
      };
    }
  );

  assert.equal(requestedUrl, 'extension://test/glossary.json');
  assert.deepEqual(glossary.entries[0]?.target, '秋季');
});

test('content translator does not send a second message for a same-session hit', async () => {
  let messageCount = 0;
  const translator = createBackgroundTranslationService({
    timeoutMs: 20,
    sendMessage: async (message) => {
      messageCount += 1;
      return successfulResponse(message);
    }
  });

  const first = await translator.translate(['A long English sentence']);
  const second = await translator.translate(['A long English sentence']);

  assert.deepEqual(first, ['【译】A long English sentence']);
  assert.deepEqual(second, first);
  assert.equal(messageCount, 1);
});

test('content translator turns a provider failure response into original text', async () => {
  const translator = createBackgroundTranslationService({
    timeoutMs: 20,
    sendMessage: async (message) =>
      encodeTranslateResponse({
        type: 'hltv-zh-translate-response',
        requestId: message.requestId,
        purpose: message.purpose,
        ok: false,
        translations: message.texts,
        error: {
          code: 'provider-failure',
          fallback: 'original',
          message: 'fake provider failed'
        }
      })
  });

  assert.deepEqual(await translator.translate(['A long English sentence']), [
    'A long English sentence'
  ]);
});

test('content translator falls back when background does not respond before timeout', async () => {
  const translator = createBackgroundTranslationService({
    timeoutMs: 5,
    sendMessage: () => new Promise<unknown>(() => {})
  });

  assert.deepEqual(await translator.translate(['A long English sentence']), [
    'A long English sentence'
  ]);
});

test('background handler returns original text for provider failure', async () => {
  const runner: BackgroundTranslationRunner = {
    async translate(texts) {
      return {
        ok: false,
        translations: [...texts],
        error: {
          code: 'provider-failure',
          message: 'fake provider failed'
        }
      };
    }
  };
  const handler = createBackgroundMessageHandler({
    storage: createStorage({ enabled: true, mode: 'A' }),
    runner,
    timeoutMs: 5
  });
  const request: TranslateRequest = {
    type: 'hltv-zh-translate-request',
    requestId: 'request-provider-failure',
    purpose: 'plain',
    texts: ['A long English sentence']
  };

  const response = decodeTranslateResponse(await handler(request));
  assert.equal(response?.ok, false);
  assert.deepEqual(response?.translations, request.texts);
});

test('background handler turns a sleeping runner into an explicit timeout fallback', async () => {
  const runner: BackgroundTranslationRunner = {
    translate: () => new Promise<never>(() => {})
  };
  const handler = createBackgroundMessageHandler({
    storage: createStorage({ enabled: true, mode: 'A' }),
    runner,
    timeoutMs: 5
  });
  const request: TranslateRequest = {
    type: 'hltv-zh-translate-request',
    requestId: 'request-timeout',
    purpose: 'plain',
    texts: ['A long English sentence']
  };

  const response = decodeTranslateResponse(await handler(request));
  assert.equal(response?.ok, false);
  if (response?.ok === false) {
    assert.equal(response.error.code, 'provider-timeout');
    assert.deepEqual(response.translations, request.texts);
  }
});

test('background handler converts a malformed runner result into an invalid-response fallback', async () => {
  const handler = createBackgroundMessageHandler({
    storage: createStorage({ enabled: true, mode: 'A' }),
    runner: {
      translate: async () => ({ bad: true } as never)
    }
  });
  const request: TranslateRequest = {
    type: 'hltv-zh-translate-request',
    requestId: 'request-malformed-runner',
    purpose: 'plain',
    texts: ['A long English sentence']
  };

  const response = decodeTranslateResponse(await handler(request));
  assert.equal(response?.ok, false);
  if (response?.ok === false) {
    assert.equal(response.error.code, 'invalid-response');
    assert.deepEqual(response.translations, request.texts);
  }
});

test('settings loader uses shared defaults and content reads only non-secret settings', async () => {
  const values = {
    enabled: false,
    mode: 'B',
    baseURL: 'https://example.invalid',
    model: 'fake-model',
    apiKey: ''
  };
  const storage = createStorage(values);
  const full = await loadSettings(storage);
  let requestedKeys: readonly string[] | undefined;
  const content = await loadContentSettings({
    async get(keys) {
      requestedKeys = keys;
      return { enabled: values.enabled, mode: values.mode };
    }
  });

  assert.deepEqual(full, values);
  assert.deepEqual(content, { enabled: false, mode: 'B' });
  assert.deepEqual(requestedKeys, ['enabled', 'mode']);
  assert.equal(DEFAULT_SETTINGS.mode, 'A');
});

test('settings loader falls back to safe defaults for invalid values', async () => {
  const storage = createStorage({ enabled: 'yes', mode: 'C', apiKey: 42 });
  const settings = await loadSettings(storage);
  assert.deepEqual(settings, DEFAULT_SETTINGS);
});

test('background handler reports settings read failure as an original-text fallback', async () => {
  const handler = createBackgroundMessageHandler({
    storage: {
      get: async () => {
        throw new Error('storage unavailable');
      },
      set: async () => {}
    },
    runner: {
      translate: async () => ({ ok: true, translations: ['unexpected'] })
    }
  });
  const request: TranslateRequest = {
    type: 'hltv-zh-translate-request',
    requestId: 'request-settings-failure',
    purpose: 'plain',
    texts: ['A long English sentence']
  };

  const response = decodeTranslateResponse(await handler(request));
  assert.equal(response?.ok, false);
  if (response?.ok === false) {
    assert.equal(response.error.code, 'settings-failure');
    assert.deepEqual(response.translations, request.texts);
  }
});

test('cache adapter treats read failure as a miss and records write failure', async () => {
  const diagnostics: string[] = [];
  const backend: CacheBackend = {
    async get() {
      throw new Error('read failed');
    },
    async set() {
      throw new Error('write failed');
    }
  };
  const cache = createCacheStoreFromBackend(backend, (diagnostic) => {
    diagnostics.push(diagnostic.code);
  });

  assert.equal(await cache.get('hash'), undefined);
  await cache.set('hash', 'translated');
  assert.deepEqual(diagnostics, ['cache-read-failed', 'cache-write-failed']);
});

test('background cache hit still receives one message but does not call the provider', async () => {
  const original = 'A long English sentence for a cached translation';
  const cached = '已缓存的译文';
  let providerCalls = 0;
  const cache = {
    async get(key: string) {
      return key === hashText(original) ? cached : undefined;
    },
    async set() {
      // The cache-hit path must not write.
    }
  };
  const providerFactory = (): TranslationProvider => ({
    async translate() {
      providerCalls += 1;
      return { ok: true, translations: ['unexpected'] };
    }
  });
  const runner = createCoreBackgroundTranslationRunner({
    glossary: { version: 1, entries: [] },
    cacheStore: cache,
    providerFactory
  });

  const result = await runner.translate(
    [original],
    'plain',
    DEFAULT_SETTINGS
  );
  assert.deepEqual(result, { ok: true, translations: [cached] });
  assert.equal(providerCalls, 0);
});

test('fake provider covers success, provider failure, invalid response, and never-resolve modes', async () => {
  const request = {
    texts: ['A long English sentence'],
    protectedFragments: [[]],
    purposes: ['plain' as const]
  };
  const modes: FakeProviderMode[] = [
    'success',
    'provider-failure',
    'invalid-response',
    'never-resolve'
  ];
  const providers: TranslationProvider[] = modes.map((mode) =>
    createFakeProvider({ mode })
  );

  const successful = await providers[0].translate(request);
  assert.deepEqual(successful, {
    ok: true,
    translations: ['【译】A long English sentence']
  });
  const providerFailure = await providers[1].translate(request);
  assert.deepEqual(providerFailure.ok, false);
  if (!providerFailure.ok) {
    assert.equal(providerFailure.error.code, 'transport-error');
  }
  const invalidResponse = await providers[2].translate(request);
  assert.deepEqual(invalidResponse.ok, false);
  if (!invalidResponse.ok) {
    assert.equal(invalidResponse.error.code, 'invalid-response');
  }
  const unresolved = providers[3].translate(request);
  const timed = await Promise.race([
    unresolved.then(() => 'resolved'),
    new Promise<string>((resolve) => setTimeout(() => resolve('timed-out'), 5))
  ]);
  assert.equal(timed, 'timed-out');
});

test('core background runner exposes fake provider failures as original-text results', async () => {
  const original = 'A long English sentence for the runner';
  const failureRunner = createCoreBackgroundTranslationRunner({
    glossary: { version: 1, entries: [] },
    cacheStore: {
      async get() {
        return undefined;
      },
      async set() {}
    },
    providerFactory: () => createFakeProvider({ mode: 'provider-failure' })
  });
  const invalidRunner = createCoreBackgroundTranslationRunner({
    glossary: { version: 1, entries: [] },
    cacheStore: {
      async get() {
        return undefined;
      },
      async set() {}
    },
    providerFactory: () => createFakeProvider({ mode: 'invalid-response' })
  });

  const failure = await failureRunner.translate(
    [original],
    'plain',
    DEFAULT_SETTINGS
  );
  const invalid = await invalidRunner.translate(
    [original],
    'plain',
    DEFAULT_SETTINGS
  );
  assert.deepEqual(failure, {
    ok: false,
    translations: [original],
    error: {
      code: 'provider-failure',
      message: 'The B3a fake provider failed.'
    }
  });
  assert.deepEqual(invalid, {
    ok: false,
    translations: [original],
    error: {
      code: 'invalid-response',
      message: 'The B3a fake provider returned an invalid response.'
    }
  });
});
