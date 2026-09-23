# Gate 5 B3a: Background Integration Contract

## Scope

B3a originally connected the content script to the background service worker with an injectable fake provider. The fake remains available for tests; production B3b now uses the OpenAI-compatible provider factory and preserves the content-side injection interface.

No external provider request is made in B3a. The only runtime resource load is the packaged `dist/glossary.json` asset, which the background loads by extension URL and passes as text to `parseGlossaryJson`. The core layer does not read files, fetch resources, or import JSON modules.

## Message protocol

The shared protocol is in `src/background/protocol.ts`.

```ts
type TranslationPurpose = 'plain' | 'event-name';
type TranslationContext = 'structured' | 'prose' | 'comment';

interface TranslateRequest {
  type: 'hltv-zh-translate-request';
  requestId: string;
  purpose: TranslationPurpose;
  context?: TranslationContext;
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

One request contains one purpose, an optional classification context, and a `string[]` batch. The content runtime maps `match-event`, `match-stage`, `match-meta`, and `match-time` to `structured`; news title/body strategies to `prose`; and comment strategies to `comment`. The background defaults an omitted context to `comment`, so older callers preserve the conservative behavior. A failure response always has the same number of strings as the request and uses the original strings. The content script treats a malformed response, a rejected message, no response, or a timeout as the same original-text fallback. Unknown messages are ignored by the background handler. API keys are not fields in either message type.

Before classification, the core applies deterministic glossary substitutions whenever glossary terms cover all letters in a controlled value. These exact terms do not reach the classifier or provider. This lets short match labels translate without weakening the conservative default for comments.

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
  providerPreset: 'deepseek' | 'openai' | 'custom';
  baseURL: string;
  model: string;
  apiKey: string;
  useJsonOutputMode: boolean;
}
```

The defaults are `enabled: true`, `mode: 'A'`, DeepSeek base URL `https://api.deepseek.com`, model `deepseek-chat`, an empty API key, and JSON output mode enabled. OpenAI defaults to `https://api.openai.com` and `gpt-4o-mini`; Custom uses a user-provided HTTPS base URL and model, or HTTP for `localhost`, `127.0.0.1`, or `[::1]` local models. `content.ts` reads the shared enabled/mode defaults through `loadContentSettings`; it does not maintain a second independent default literal.

The background reads saved translation settings from `browser.storage.local`. The content script reads only `enabled` and `mode`. Translation API keys stay in the background settings/provider path. The options-page connection test reads the current form directly and sends its one test request from the options context; it does not put the key in a runtime message. The key is never read by the content settings loader, included in a message, written to a log, or placed in a test fixture.

```text
browser.storage.local -> background settings loader -> translation provider
options form -> one options-context connection-test request
```

The API key is stored only in `browser.storage.local`, never in `browser.storage.sync`. Translation and connection-test requests send it to the configured provider in the authorization header. It is not sent to the extension developer. The options page states these facts and does not claim the key is never transmitted over a network.

## Timeout and failure policy

The background operation timeout defaults to 5000 ms and the content message timeout defaults to 6000 ms. Both values are options, not hard-coded behavior: tests inject millisecond values, including the never-resolving provider case. There are no retries in B3a. A timeout, provider failure, settings read failure, malformed response, or background exception returns the original text array and an explicit failure response where a request ID is available.

The background runner observes provider failures while using the existing core `TranslationService`. A cache hit is successful and does not invoke the provider. A provider failure is normalized to `ok: false` with `fallback: 'original'`; the content translator never receives an exception for this path.

## Three cache layers and their intentional semantics

The core `CacheStore` interface is unchanged. `src/background/cache-store.ts` adapts IndexedDB using database `cs2-hltv-zh-cache-v1` and object store `translations`. B3b cache keys use `v2:<purpose>:<text hash>`, generated by `createTranslationCacheKey(text, purpose, hash)` in the core. Reads that fail are reported and treated as misses. Writes that fail are reported but are best effort, so a completed translation remains usable. The options page can clear the store and reports the committed number of deleted records.

B3a records used bare text hashes. They remain in IndexedDB but are no longer read or automatically deleted. A text whose only record is in the old format is translated once again and written under its purpose-specific v2 key. This does not affect returned values, settings, permissions, or records already stored with v2 keys. The clear-cache action removes both formats.

There are deliberately three distinct behaviors:

1. Within one content-script session, `background-translator.ts` remembers an already returned result and does not send a second message for the same text and purpose.
2. For a request that does reach background, an IndexedDB hit prevents a provider call.
3. A different page has no way to know that background IndexedDB contains the text before asking background, so a cross-page cache hit still requires one content-to-background message.

The third behavior is intentional, not a missing optimization: persistent storage is owned by background, while content must not receive the cache database or provider credentials merely to avoid the lookup message.

## Permissions and B3b boundary

B3a did not add host_permissions or call a provider. B3b keeps permissions: ["storage"], declares optional_host_permissions for HTTPS hosts plus only localhost, 127.0.0.1, and [::1] over HTTP, and requests one configured origin at runtime from the options page. HTTP is limited to loopback so local model traffic stays on the user's machine; external providers still require HTTPS. It does not add fixed host permissions or <all_urls>. Translation requests run in the background service worker after checking permission before each provider operation. The one-request connection test runs in the options page after checking the same exact origin. Its result uses a fixed enum and optional HTTP status only; it never contains raw provider text or settings, so a credential cannot leak through an unfamiliar error body. The background records missing saved-origin permission at startup and after removal events, never prompts for permission, and returns originals when permission is absent. The options page reacts to permission changes and offers the explicit repair action.

The owner-approved and implemented B3b/B4 contract, including URL normalization, permission lifecycle, request body, full prompt, response validation, options behavior, and cache clearing, is in [b3b-provider-options-contract.md](./b3b-provider-options-contract.md). The approved contract records an explicit JSON output mode setting, an injectable provider temperature, and the approved interface-preserving core batching change.
