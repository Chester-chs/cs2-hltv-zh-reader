# B3b Provider and Options Contract

## Implementation status

This document records the owner-approved B3b real-provider integration and B4 options-page contract and its implementation. It remains the normative provider, permission, cache, and options behavior reference.

## Defaults and manifest

The settings defaults are:

| Preset | Base URL | Default model |
| --- | --- | --- |
| DeepSeek | https://api.deepseek.com | deepseek-chat |
| OpenAI | https://api.openai.com | gpt-4o-mini |
| Custom | User supplied | User supplied |

The default enabled state remains true and the default display mode remains A. The API key starts empty. JSON output mode defaults to true. Selecting a preset fills its base URL and model; the model remains editable. Selecting Custom makes the base URL editable.

## Classification context and controlled vocabulary

The core accepts `TranslationContext = 'structured' | 'prose' | 'comment'` as an optional dependency setting. If no caller supplies a context, the default is `comment`, which preserves the conservative P0-LANG thresholds for user-generated text. Content strategies pass `structured` for match event, stage, meta, and time fields; `prose` for news titles and bodies; and `comment` for comments. A display strategy marked `translation: 'never'` (including team names such as Aurora) blocks translation independently of language classification.

Structured text may be short: after empty, numeric, date, symbol, Chinese, and complete keep-as-is checks, Latin-script text is eligible. Prose retains the medium threshold of at least five Latin letters and two English tokens. Comments retain the prior conservative threshold and keep ambiguous short, numeric-mixed, tagged, or emoticon text in the original language.

Controlled glossary values are replaced directly by the core before classification or provider calls whenever the glossary covers every letter in the input. Exact stage/status translations and keep-as-is event names therefore do not depend on model output. The production glossary keeps `bo3` and `bo5` unchanged: players commonly recognize these abbreviations, and the `.match-meta` field is only 28 px wide, so a Chinese expansion would not fit reliably.

## Context protocol

The content/background request protocol may carry an optional `context` value from the same three-value union. Existing callers that omit it are treated as `comment` by the background. The public `TranslationService.translate(texts)` and `translateEventNames(texts)` method signatures remain unchanged; background injects context through service dependencies. See [translation-layer.md](./translation-layer.md) for the exact classifier rules and glossary pre-classification behavior.

The manifest keeps only the storage permission, the optional HTTPS host range, and narrow HTTP permissions for loopback services:

~~~json
{
  "permissions": ["storage"],
  "optional_host_permissions": [
    "https://*/*",
    "http://localhost/*",
    "http://127.0.0.1/*",
    "http://[::1]/*"
  ],
  "options_ui": {
    "page": "options.html",
    "open_in_tab": true
  }
}
~~~

There is no fixed host permission and no all-URLs permission. The actual host permission is requested at runtime for one configured origin.

## URL normalization and host permission

The options page and background use one shared base URL parser:

1. Trim surrounding whitespace and parse with the platform URL parser. Require an absolute URL with a hostname. HTTPS is required for every non-loopback host. HTTP is accepted only when the parsed hostname is exactly `localhost`, `127.0.0.1`, or `[::1]`. Reject any `@` in the raw authority (including empty user information), usernames, passwords, query strings, and fragments.
2. Read the permission origin from URL.origin. This canonicalizes the scheme, hostname, and port and excludes the path. For example, https://api.deepseek.com/openai/ becomes the origin https://api.deepseek.com.
3. Remove trailing slashes from the URL path. Preserve a configured path prefix. If the path already ends with the exact, case-sensitive segment /v1, append /chat/completions. Otherwise append /v1/chat/completions.

Examples:

| Configured base URL | Permission pattern | Request URL |
| --- | --- | --- |
| https://api.deepseek.com | https://api.deepseek.com/* | https://api.deepseek.com/v1/chat/completions |
| https://api.openai.com/v1/ | https://api.openai.com/* | https://api.openai.com/v1/chat/completions |
| https://gateway.example/openai/ | https://gateway.example/* | https://gateway.example/openai/v1/chat/completions |
| http://localhost:11434 | http://localhost:11434/* | http://localhost:11434/v1/chat/completions |
| http://127.0.0.1:1234 | http://127.0.0.1:1234/* | http://127.0.0.1:1234/v1/chat/completions |

The code constructs the request URL from the parsed URL components; it does not concatenate an unchecked user string into a host or permission pattern. A configured port is part of URL.origin and therefore part of the single requested origin.

Loopback HTTP supports local models such as Ollama and LM Studio. The accepted hostnames resolve to the user's own machine, so this exception keeps local model traffic on the device; every external host still requires HTTPS. The manifest grants only these named loopback hosts over HTTP and does not enable general HTTP access.

### Save and authorization order

The permission prompt is initiated by the options page from a direct user action. This context is chosen because the browser permission prompt requires user intent; the background service worker cannot reliably initiate an interactive prompt. The background only checks permission and records diagnostics.

When Save is clicked, the options page performs these steps in order:

1. Validate and normalize the draft settings and parse the base URL.
2. Call browser.permissions.contains for the exact pattern URL.origin + "/*".
3. If permission is absent, call browser.permissions.request with only that one pattern.
4. If the request is rejected or errors, do not write any setting. Keep the saved settings unchanged and show: “未授权访问 <origin>，翻译将无法工作”.
5. If permission is already present or the request is granted, write the complete settings object to browser.storage.local.

The options page checks permission whenever the selected preset or edited base URL changes and shows the state for that draft origin. It offers an explicit Authorize action that requests only that origin. Save always repeats the contains check and follows the ordered flow above, including after an earlier authorization action.

The API key is never written to browser.storage.sync, a runtime message, or a log. It is stored in browser.storage.local and sent as an Authorization Bearer header to the configured provider when a translation or connection test is made. It is not sent to the extension developer. The page must describe this accurately; it must not claim that the key is never sent over the network.

### Startup and revocation handling

At background startup, load the saved settings, parse the saved base URL, and check its exact origin with browser.permissions.contains. If the saved origin has no permission, record a permission-missing diagnostic and do not request permission or call the provider.

Before every provider operation, check the saved origin permission again. If it is missing, return the B3a failure shape with ok:false and a copy of the complete original input array. Do not attempt a network request.

Register browser.permissions.onRemoved in the background. When a host permission is removed, re-read the saved origin and check whether it is now missing; if so, record the same diagnostic. This event path covers revocation from the browser extension management page. The next translation is independently blocked by the pre-request permission check, including when the background was not active at the instant the settings page was changed.

The options page listens for permission additions and removals and refreshes the status for the currently selected origin. A missing permission is shown as “当前配置缺少权限” with an Authorize repair action. The status is based on browser.permissions.contains, not on a cached boolean.

Permission rejection and permission revocation have different entry points but the same safe translation outcome:

| Event | Settings write | Translation behavior | User-visible recovery |
| --- | --- | --- | --- |
| Save permission prompt rejected | None; old settings remain | Existing settings remain active; if their permission is missing, return originals | Show “未授权访问 <origin>，翻译将无法工作”; retry Save or Authorize |
| Saved origin permission revoked | Existing settings remain | Block provider call and return originals with ok:false | Options reports missing permission and offers Authorize; after grant, settings can be saved or used again |

## Provider request and response contract

The background creates the core `createOpenAICompatibleProvider` for translations and injects the existing 5000 ms timeout. The content message timeout remains 6000 ms. Translation requests read the key from background settings. The connection test reads the current form in the options page and sends no runtime message containing the key.

The core provider request is changed to:

- POST to the normalized /v1/chat/completions endpoint.
- Use an injectable temperature. DEFAULT_PROVIDER_TEMPERATURE is 0.2; the provider config accepts an optional temperature override, and the request uses config.temperature ?? DEFAULT_PROVIDER_TEMPERATURE. Tests can inject another value without changing the production default.
- When the saved useJsonOutputMode setting is true, request JSON object output with response_format set to {"type":"json_object"}. When false, omit response_format entirely.
- Require the model content to be an object with a translations string array of exactly the input length.
- Strip one optional outer Markdown code fence before parsing model content.
- Treat malformed JSON, a missing translations field, a non-string array item, or a count mismatch as an invalid provider response. The background returns ok:false and the full original array.
- Run the existing validateTranslation for each parsed translation with its own original text, keep_as_is fragments, purpose, and glossary. A validation failure returns the original for that item only and does not discard valid translations in the same batch.

The intended provider configuration shape is:

~~~ts
export const DEFAULT_PROVIDER_TEMPERATURE = 0.2;

export interface OpenAICompatibleProviderConfig {
  baseURL: string;
  model: string;
  apiKey: string;
  timeoutMs: number;
  temperature?: number;
  useJsonOutputMode?: boolean;
  transport: ChatCompletionsTransport;
}

const temperature =
  config.temperature ?? DEFAULT_PROVIDER_TEMPERATURE;
~~~

### Approved core behavior change

This is an interface-preserving behavior change in src/core/translate. The TranslationService method signatures remain translate(texts: string[]): Promise<string[]> and translateEventNames(texts: string[]): Promise<string[]>; the TranslationProvider interface also remains unchanged. The provider call pattern changes: for one TranslationService invocation, all distinct, uncached texts classified as translatable are sent together in one provider call. Non-translatable and cache-hit entries do not enter that provider batch. Results are mapped back to the original input positions.

The reason is to make the JSON translations array correspond to a known batch and allow the existing validateTranslation to run separately for every item. A whole-response parse or count failure returns the original batch with the existing B3a failure result. A per-item validation failure returns the original only at that item's position; valid sibling translations remain usable and cacheable.

In-flight de-duplication remains in force across concurrent TranslationService calls. Identical text and purpose share one pending result and cannot be added to more than one concurrent provider batch. Cache identity must preserve purpose so a plain result cannot bypass event-name validation.

The key is generated by the named `createTranslationCacheKey(text, purpose, hash)` function in `src/core/translate/index.ts` and has the format `v2:<purpose>:<text hash>`. B3a stored bare text hashes. Those old records are left in IndexedDB and are neither read nor automatically deleted; the only translation behavior impact is that a text whose only record uses the old format is translated once again and then cached under its new purpose-specific key. This does not alter settings, permissions, returned values, or any v2 cache record. Clear translation cache removes both old and current records.

The implementation must add or update meaningful tests that prove all of the following:

1. N distinct uncached translatable texts in one invocation cause exactly one provider call containing all N texts.
2. Cache-hit entries are returned from cache and omitted from that provider request.
3. If validation fails for one returned item, only that item falls back to its original while valid items in the same provider response are retained.
4. Concurrent calls containing the same text and purpose share in-flight work, preserving the existing same-text concurrent de-duplication behavior.

Existing tests whose provider-call-count assumptions change must be updated to assert the new batch contract and explain the changed premise. Assertions must not be weakened. All 64 current tests must continue to pass, along with the new coverage.

When useJsonOutputMode is true, if a provider returns 4xx and its error identifies response_format as unsupported, the provider returns a sanitized HTTP failure without retrying. The background then follows the existing B3a ok:false/original-array behavior. This avoids a silent second billable request. The options page explains the failure and directs the user to turn off the explicit JSON output mode switch.

When useJsonOutputMode is false, response_format is omitted but the system prompt still requires the same JSON object. The response parser and validation remain strict; malformed or non-JSON model output follows the existing failure behavior.

### Exact system prompt

The system message is the following text:

~~~text
你是 CS2 新闻与赛事名称翻译器。把输入中的每一条英文翻译成简体中文。

输入包含 items 数组。每项都有 index、purpose、text 和 protected_fragments。输出 translations 数组必须按输入顺序逐项对应，条数必须与 items 完全相同。

保护片段来自 glossary 中 keep_as_is 为 true 的条目。用户数据会针对每条输入逐条列出 protected_fragments。不得翻译、改写、增删、拆分或改变其中任何片段的字符；每个保护片段必须在对应译文中原样出现。

purpose 为 event-name 时，保留赛事及品牌名称。尤其要逐字保留该条目的全部 protected_fragments。允许调整其他词语的语序，使名称符合简体中文习惯，例如将季节和年份调整到赛事名称之前。

purpose 为 plain 时，将可翻译内容自然地翻译成简体中文，并保留原文中的事实、数字和含义。

只输出一个合法 JSON 对象，形状必须为 {"translations":["译文"]}。不要输出解释、额外字段、前后缀或 Markdown 代码块围栏。

最小示例：
输入：{"items":[{"index":1,"purpose":"event-name","text":"Fall 2026 StarLadder StarSeries","protected_fragments":["StarLadder StarSeries"]}]}
输出：{"translations":["2026 秋季赛 StarLadder StarSeries"]}
~~~

For each provider call, the user message is JSON generated from the actual ProviderRequest. It lists the protected fragments separately for each item:

~~~json
{
  "items": [
    {
      "index": 1,
      "purpose": "plain",
      "text": "The match starts Friday.",
      "protected_fragments": []
    },
    {
      "index": 2,
      "purpose": "event-name",
      "text": "Fall 2026 StarLadder StarSeries",
      "protected_fragments": ["StarLadder StarSeries"]
    }
  ]
}
~~~

### Complete request body example

This is the JSON body sent to DeepSeek for the two items above. The system content is the exact prompt shown above; JSON serialization escapes its line breaks in the HTTP body.

~~~json
{
  "model": "deepseek-chat",
  "temperature": 0.2,
  "response_format": {
    "type": "json_object"
  },
  "messages": [
    {
      "role": "system",
      "content": "你是 CS2 新闻与赛事名称翻译器。把输入中的每一条英文翻译成简体中文。\n\n输入包含 items 数组。每项都有 index、purpose、text 和 protected_fragments。输出 translations 数组必须按输入顺序逐项对应，条数必须与 items 完全相同。\n\n保护片段来自 glossary 中 keep_as_is 为 true 的条目。用户数据会针对每条输入逐条列出 protected_fragments。不得翻译、改写、增删、拆分或改变其中任何片段的字符；每个保护片段必须在对应译文中原样出现。\n\npurpose 为 event-name 时，保留赛事及品牌名称。尤其要逐字保留该条目的全部 protected_fragments。允许调整其他词语的语序，使名称符合简体中文习惯，例如将季节和年份调整到赛事名称之前。\n\npurpose 为 plain 时，将可翻译内容自然地翻译成简体中文，并保留原文中的事实、数字和含义。\n\n只输出一个合法 JSON 对象，形状必须为 {\"translations\":[\"译文\"]}。不要输出解释、额外字段、前后缀或 Markdown 代码块围栏。\n\n最小示例：\n输入：{\"items\":[{\"index\":1,\"purpose\":\"event-name\",\"text\":\"Fall 2026 StarLadder StarSeries\",\"protected_fragments\":[\"StarLadder StarSeries\"]}]}\n输出：{\"translations\":[\"2026 秋季赛 StarLadder StarSeries\"]}"
    },
    {
      "role": "user",
      "content": "{\"items\":[{\"index\":1,\"purpose\":\"plain\",\"text\":\"The match starts Friday.\",\"protected_fragments\":[]},{\"index\":2,\"purpose\":\"event-name\",\"text\":\"Fall 2026 StarLadder StarSeries\",\"protected_fragments\":[\"StarLadder StarSeries\"]}]}"
    }
  ]
}
~~~

The production body uses the resolved injected temperature value rather than a literal at the call site. With JSON output mode disabled, the same body omits the response_format member; its messages and JSON-only system prompt are unchanged.

The response content for that request must be:

~~~json
{
  "translations": [
    "比赛将于周五开始。",
    "2026 秋季赛 StarLadder StarSeries"
  ]
}
~~~

## Options page contract

The options page is built with plain HTML, CSS, and TypeScript. It adds no UI framework. The page provides:

- Translation enabled toggle.
- Display mode A (full translation) and B (bilingual).
- DeepSeek, OpenAI, and Custom preset selector.
- Base URL, read-only for the two presets and editable for Custom.
- Editable model name, initialized to the selected preset default.
- Password-type API key field with show/hide control.
- JSON output mode checkbox, enabled by default, labeled “使用 JSON 输出模式（推荐）”. Helper text: “若你的服务商不支持 response_format 而报错，可取消勾选。”
- Save, Test connection, and Clear translation cache actions.
- A visible permission state for the origin in the current draft, including “当前配置缺少权限” and an Authorize action when required.

The provider preset and useJsonOutputMode are stored with local settings so the selector state and output-mode choice persist. Older settings without the provider field are classified by exact preset URL; anything else is Custom. Older settings without useJsonOutputMode default to true.

Saving writes browser.storage.local only. The options success notice contains no key value. The options page states that the key is stored locally and is not synced or sent to the extension developer; it also states that translation and connection-test requests send the key to the configured provider domain.

After a successful save, the current tab and already-open HLTV tabs update without reload. The content script listens for relevant browser.storage.onChanged updates and applies enabled/mode changes through the existing runtime setters. The content script never receives the API key or provider settings.

### Test connection

Test connection uses the current form values, requires the exact origin permission, and sends one provider request containing one short string, “Hello.” It bypasses translation caching. It does not request permission by itself; if permission is missing, it reports “无权限” and leaves the Authorize action available. If JSON output mode is on and the single response is a 4xx error identifying response_format as unsupported, the result tells the user to turn off “使用 JSON 输出模式（推荐）” and test again. It does not retry automatically, so the test still sends exactly one request.

`ConnectionTestResult` is a discriminated union containing either `{ ok: true }` or `{ ok: false, reason, status? }`, where `reason` is a fixed enum. It never contains provider error text, response bodies, request headers, or settings. The UI maps that enum and optional HTTP status to fixed messages. This makes credential disclosure structurally impossible through the result object, rather than relying on string redaction that could miss an unfamiliar provider error format. Raw provider error bodies are not displayed or logged.

### Clear translation cache

Clear cache deletes records from the existing IndexedDB database cs2-hltv-zh-cache-v1 and object store translations. The clear operation counts and deletes records within a read-write transaction and reports the committed deletion count, for example “已清除 128 条翻译缓存记录”. If IndexedDB fails, the page reports that failure and does not claim records were deleted.

## Implemented files and behavior

The implementation updates the root manifest and settings defaults; the core OpenAI-compatible provider and translation batching/validation path; background provider creation, permission checks, and revocation diagnostics; IndexedDB cache clearing; content settings-change handling; the Vite options build; options HTML/CSS/TypeScript; the translation-layer contract and regression tests; and the linked background and progress documentation.
