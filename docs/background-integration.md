# Gate 5 B3a: Background Integration Contract

## Scope

B3a connects the content script to the background service worker without using a real provider. The background side uses an injectable fake provider whose successful output is `【译】<original>`. The fake provider has four testable modes: success, provider failure, invalid response, and a promise that never resolves. B3b will replace the provider factory; it will not change the content-side injection interface.

No external provider request is made in B3a. The only runtime resource load is the packaged `dist/glossary.json` asset, which the background loads by extension URL and passes as text to `parseGlossaryJson`. The core layer does not read files, fetch resources, or import JSON modules.

## Message protocol

The shared protocol is in `src/background/protocol.ts`.

```ts
type TranslationPurpose = 'plain' | 'event-name';

interface TranslateRequest {
  type: 'hltv-zh-translate-request';
  requestId: string;
  purpose: TranslationPurpose;
  texts: string[];
}

type TranslateFailureCode =
  | 'disabled'
  | 'settings-failure'
  | 'provider-failure'
  | 'provider-timeout'
  | 'invalid-response';

type TranslateResponse =
  | {
      type: 'hltv-zh-translate-response';
      requestId: string;
      purpose: TranslationPurpose;
      ok: true;
      translations: string[];
    }
  | {
      type: 'hltv-zh-translate-response';
      requestId: string;
      purpose: TranslationPurpose;
      ok: false;
      translations: string[];
      error: {
        code: TranslateFailureCode;
        fallback: 'original';
        message: string;
      };
    };
```

One request contains one purpose and a `string[]` batch. A failure response always has the same number of strings as the request and uses the original strings. The content script treats a malformed response, a rejected message, no response, or a timeout as the same original-text fallback. Unknown messages are ignored by the background handler. API keys are not fields in either message type.

The request/response codecs validate message shape before use. They do not throw for untrusted message data; an invalid request is ignored because there is no reliable request ID with which to construct a response.

## Module and dependency direction

The B3a modules are separated as follows:

- `src/background/protocol.ts`: browser-independent message data and codecs.
- `src/background/settings.ts`: background settings storage and normalization.
- `src/background/cache-store.ts`: IndexedDB backend and the failure-tolerant `CacheStore` adapter.
- `src/background/fake-provider.ts`: B3a-only provider implementation.
- `src/background/translation-engine.ts`: background runner around the existing core translation service.
- `src/background/translation-handler.ts`: message validation, settings gate, timeout, and response fallback.
- `src/background/glossary-loader.ts`: runtime loading of the packaged glossary asset.
- `src/content/background-translator.ts`: content-side session de-duplication, message call, timeout, and fallback.
- `src/content/settings.ts`: content-side read of only the non-secret settings.
- `src/shared/settings.ts`: the single source of the default mode and shared settings types.

The content script depends on the protocol and its own settings reader. The background depends on the protocol, storage, the existing core translation interfaces, and the provider factory. `src/core/translate/` and `src/core/display/` remain independent of DOM APIs and extension APIs.

The glossary deliberately belongs only to the background translation path. The display layer has no glossary dependency, and the content script only needs translated strings and display intents. Sending the glossary to the content script would duplicate the authority and expose data that the display layer does not use.

## Settings and API-key boundary

`src/shared/settings.ts` defines the single default object:

```ts
interface ExtensionSettings {
  enabled: boolean;
  mode: 'A' | 'B';
  baseURL: string;
  model: string;
  apiKey: string;
}
```

The defaults are `enabled: true`, `mode: 'A'`, and empty strings for `baseURL`, `model`, and `apiKey`. `content.ts` uses the same exported mode default through `loadContentSettings`; it does not maintain a second independent default literal.

The background reads all settings from `browser.storage.local`. The content script reads only `enabled` and `mode`. The API key path is therefore:

```text
browser.storage.local -> background settings loader -> provider factory
```

The key is never read by the content settings loader, included in a message, written to a log, or placed in a test fixture. B3a's fake provider ignores provider credentials. B3b will inject the real provider factory without moving the key across the content/background boundary.

## Timeout and failure policy

The background operation timeout defaults to 5000 ms and the content message timeout defaults to 6000 ms. Both values are options, not hard-coded behavior: tests inject millisecond values, including the never-resolving provider case. There are no retries in B3a. A timeout, provider failure, settings read failure, malformed response, or background exception returns the original text array and an explicit failure response where a request ID is available.

The background runner observes provider failures while using the existing core `TranslationService`. A cache hit is successful and does not invoke the provider. A provider failure is normalized to `ok: false` with `fallback: 'original'`; the content translator never receives an exception for this path.

## Three cache layers and their intentional semantics

The core `CacheStore` interface is unchanged. `src/background/cache-store.ts` adapts IndexedDB using database `cs2-hltv-zh-cache-v1` and object store `translations`, with records keyed by the core text hash. Reads that fail are reported and treated as misses. Writes that fail are reported but are best effort, so a completed translation remains usable.

There are deliberately three distinct behaviors:

1. Within one content-script session, `background-translator.ts` remembers an already returned result and does not send a second message for the same text and purpose.
2. For a request that does reach background, an IndexedDB hit prevents a provider call.
3. A different page has no way to know that background IndexedDB contains the text before asking background, so a cross-page cache hit still requires one content-to-background message.

The third behavior is intentional, not a missing optimization: persistent storage is owned by background, while content must not receive the cache database or provider credentials merely to avoid the lookup message.

## Permissions and B3b boundary

B3a does not add `host_permissions` and does not call a provider. When B3b selects a provider, the manifest must add only the provider's exact origin pattern, for example `https://api.example.com/*`, rather than a broad web-wide pattern. The API call will remain in the background service worker.
