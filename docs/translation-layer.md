# Gate 5：翻译层契约与实现记录

## 范围与依赖方向

翻译层位于 `src/core/translate/`，只处理字符串和注入的纯数据接口：

- 输入与输出面向 `string[]`，不感知显示模式，也不操作页面节点。
- 不读取文件，不自行加载 glossary；Provider 的传输由调用方注入，不绑定具体资源 API。
- glossary 文本由调用方注入，核心层通过 `parseGlossaryJson(source)` 解析。
- Provider、CacheStore 和不确定分类记录器均由调用方注入。
- 依赖方向测试会扫描该目录，拒绝页面 API、扩展 API 和持久化 API 引用。

## glossary 运行时加载与 schema

根目录的 `glossary.json` 是可编辑的数据资产。Vite 会在构建时把它原样复制到 `dist/glossary.json`；核心翻译层不会把 JSON 作为 TypeScript 模块导入。运行时由后续调用方读取打包后的文本，再传给 `parseGlossaryJson`。

`tsconfig.json` 未开启 `resolveJsonModule`，因此不存在编译期 JSON 导入路径。

当前 schema 为：

```ts
interface GlossaryEntry {
  term: string;
  target: string;
  keep_as_is: boolean;
  category?: string;
  note?: string;
}

interface GlossaryDocument {
  version: number;
  entries: GlossaryEntry[];
}
```

`keep_as_is: true` 时，`target` 必须与 `term` 完全一致。JSON、文档结构或单个词条非法时不抛异常；非法词条被跳过，并通过 `GlossaryDiagnostic` 报告。整个文件无法解析时返回空词表和诊断。

## 公共接口

### glossary 与匹配

```ts
type GlossaryDiagnosticCode =
  | 'invalid-json'
  | 'invalid-document'
  | 'invalid-entry'
  | 'keep-as-is-target-mismatch';

interface GlossaryDiagnostic {
  code: GlossaryDiagnosticCode;
  entryIndex?: number;
  message: string;
}

interface GlossaryLoadResult {
  glossary: GlossaryDocument;
  diagnostics: GlossaryDiagnostic[];
}

interface GlossaryMatch {
  entry: GlossaryEntry;
  matchedText: string;
  start: number;
  end: number;
}

interface GlossaryLookup {
  entry: GlossaryEntry;
  matchedText: string;
}

parseGlossaryJson(source: string): GlossaryLoadResult;

findKeepAsIsMatches(
  text: string,
  glossary: GlossaryDocument
): GlossaryMatch[];

isEntirelyKeepAsIs(
  text: string,
  glossary: GlossaryDocument
): boolean;

lookupEntries(
  text: string,
  glossary: GlossaryDocument,
  options?: { category?: string }
): GlossaryLookup[];
```

匹配使用归一化比较视图、token 边界和最长匹配优先规则，同时保留原文字面与原文大小写。长标识符内部的子串不会命中。`findKeepAsIsMatches` 只查 `keep_as_is: true`；`lookupEntries` 可查询普通译名并按 category 过滤；无匹配返回空数组。

### P0-LANG

```ts
type LanguageDecisionKind =
  | 'empty'
  | 'pure-number'
  | 'pure-date'
  | 'pure-symbol'
  | 'keep-as-is'
  | 'target-language'
  | 'translatable'
  | 'uncertain';

interface LanguageDecision {
  text: string;
  kind: LanguageDecisionKind;
  shouldTranslate: boolean;
  confidence: number;
  reason: string;
  glossaryMatches: GlossaryMatch[];
  reviewRequired: boolean;
}

type TranslationContext = 'structured' | 'prose' | 'comment';

classifyText(
  text: string,
  glossary: GlossaryDocument,
  context: TranslationContext = 'comment'
): LanguageDecision;
```

判定顺序固定：

1. 空文本、纯数字、纯日期、纯符号/emoji；
2. 完整文本被 `keep_as_is` 词条覆盖；
3. 中文目标语言；
4. 按调用方传入的 `TranslationContext` 判断其余文本。

中文判定不是单一正则：至少两个汉字、汉字占文字字符约 60% 以上，且无日文假名或韩文冲突信号时才判为目标语言。含中文但比例不足的中英混排文本保守地保留。

`structured` 用于赛事名、赛段、meta 与时间等受控字段：存在拉丁字母且没有非拉丁字母冲突时，即使文本很短或混有数字也判为可翻译。纯数字、日期、符号、中文和完整 `keep_as_is` 项仍由前置规则拦截。glossary 能覆盖文本中全部字母时，TranslationService 会直接逐项替换译名或保留原文，并跳过分类器与 Provider；例如 `Grand Final` 直接变为 `总决赛`，`bo3` 保持 `bo3`。

`prose` 用于新闻标题与正文，要求至少 5 个拉丁字母和至少 2 个英文 token。低于此门槛的短文保留原文。

`comment` 用于评论，且为未传 context 时的默认值。它保留 P0-LANG 原有的保守规则：少于 5 个拉丁字母、少于 2 个 token、含数字、话题标签、括号/表情符号或其他歧义信号的文本进入 `uncertain`，`shouldTranslate` 为 `false`，`reviewRequired` 为 `true`。该策略避免把 `lol 4`、`bot ☠`、`1v9?? gl` 和 `Thank you <3` 等用户内容误送去翻译。

内容层按元素策略传递 context：`match-event`、`match-stage`、`match-meta`、`match-time` 使用 `structured`；新闻标题和正文使用 `prose`；评论使用 `comment`。队名等 `translation: 'never'` 策略在显示策略层拦截，分类器不负责决定是否展示队名翻译。旧的 `translate` 与 `translateEventNames` 方法没有 context 参数，仍以最保守的 `comment` 运行。

不确定分类通过以下可选接口记录：

```ts
type UncertainClassificationSink = (
  record: UncertainClassificationRecord
) => void;
```

记录失败不会改变保守回退原则；不确定文本不会发送给 Provider。

### Provider

```ts
type TranslationPurpose = 'plain' | 'event-name';

interface ProviderRequest {
  texts: string[];
  protectedFragments: string[][];
  purposes: TranslationPurpose[];
}

type ProviderErrorCode =
  | 'timeout'
  | 'transport-error'
  | 'http-error'
  | 'invalid-response';

interface ProviderError {
  code: ProviderErrorCode;
  message: string;
  status?: number;
}

type ProviderResult =
  | { ok: true; translations: string[] }
  | { ok: false; error: ProviderError };

interface TranslationProvider {
  translate(request: ProviderRequest): Promise<ProviderResult>;
}

createOpenAICompatibleProvider(
  config: OpenAICompatibleProviderConfig
): TranslationProvider;

interface ChatCompletionsTransportRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
  timeoutMs: number;
}

interface ChatCompletionsTransportResponse {
  status: number;
  json(): Promise<unknown>;
}

interface ChatCompletionsTransport {
  send(
    request: ChatCompletionsTransportRequest
  ): Promise<ChatCompletionsTransportResponse>;
}

interface OpenAICompatibleProviderConfig {
  baseURL: string;
  model: string;
  apiKey: string;
  timeoutMs: number;
  transport: ChatCompletionsTransport;
}
```

协议为 OpenAI 兼容的 `/chat/completions`。供应商通过 `baseURL`、`model`、`apiKey` 切换；`transport` 是测试和运行时注入的传输实现，`timeoutMs` 控制超时。

Provider 提示词会逐条列出保护片段，并要求返回与输入等长的 JSON 字符串数组。超时、传输错误、HTTP 错误、JSON 或响应格式错误都返回 `ProviderResult.ok: false`，不把异常抛给翻译调用方。

### 翻译结果校验

```ts
type ValidationFailureCode =
  | 'protected-fragment-missing'
  | 'protected-fragment-count-mismatch'
  | 'year-token-missing'
  | 'glossary-target-missing'
  | 'structure-mismatch';

type TranslationValidation =
  | { ok: true }
  | { ok: false; code: ValidationFailureCode; message: string };

validateTranslation(
  original: string,
  translated: string,
  protectedFragments: string[],
  purpose: TranslationPurpose,
  glossary: GlossaryDocument
): TranslationValidation;
```

所有 purpose 都检查：

- 保护片段逐字保留；
- 数量一致；
- 相对顺序一致。

`structure-mismatch` 只表示保护片段的相对顺序发生改变，不表示任何其他结构问题。

仅 `event-name` 检查：

- 年份数字 token 保留；
- 原文命中 `category: "season"` 时，对应 `target` 必须出现；
- 原文命中其他 `keep_as_is: false` 词条时，对应 `target` 必须出现。

`plain` 不检查普通 glossary target。长句允许合理同义译法，例如：

```text
They lost the Grand Final → 他们输掉了决赛
```

这不会因缺少逐字的“总决赛”而回退原文。校验失败时服务层丢弃译文并返回原文。

校验已知局限：词表未收录的季节或月份无法校验；通用规则不能判断语序自然度；同一季节词在不同赛事中可能有不同习惯译法；未收录品牌和模型语义质量无法由该校验保证。

### CacheStore 与服务

```ts
interface CacheStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
}

type TextHasher = (text: string) => string;

hashText(text: string): string;

interface UncertainClassificationRecord {
  text: string;
  decision: LanguageDecision;
}

type UncertainClassificationSink = (
  record: UncertainClassificationRecord
) => void;

interface TranslationServiceDependencies {
  glossary: GlossaryDocument;
  provider: TranslationProvider;
  cacheStore: CacheStore;
  hash?: TextHasher;
  context?: TranslationContext;
  onUncertainClassification?: UncertainClassificationSink;
}

interface TranslationService {
  translate(texts: string[]): Promise<string[]>;
  translateEventNames(texts: string[]): Promise<string[]>;
}

createTranslationService(
  dependencies: TranslationServiceDependencies
): TranslationService;
```

缓存 key 由具名函数 `createTranslationCacheKey(text, purpose, hash)` 生成，格式为 `v2:<purpose>:<text hash>`。服务会先查缓存，只请求增量；相同文本与 purpose 的并发请求通过 in-flight 去重。Provider、校验和缓存失败均回退原文。`CacheStore` 是必填依赖，核心层没有默认内存缓存。

`context` 是 TranslationService 的可选依赖配置，默认 `comment`；`TranslationService` 的公开方法签名保持不变。内容运行时通过上下文适配器把元素策略映射传给 background，background 再注入核心服务。glossary 完整覆盖的受控文本在分类和 provider 调用前直接替换，因此受控术语由代码保证，不依赖提示词或模型遵守术语。

核心层仍然没有默认内存 CacheStore；内存实现只存在于测试代码中。B3a 已在 background 侧提供 IndexedDB 适配器并复用此接口，但真实浏览器中的缓存命中率尚未测量，不能把它报告为已验证的命中率。

## B3b provider batching: approved interface-preserving behavior change

B3b keeps the public TranslationService method signatures unchanged: translate(texts: string[]): Promise<string[]> and translateEventNames(texts: string[]): Promise<string[]>. The TranslationProvider interface also stays unchanged. The provider invocation behavior changes: one TranslationService invocation groups all distinct uncached texts classified as translatable into one provider call. Non-translatable and cache-hit entries stay out of that request, and returned results map back to their original positions.

This behavior change is required for structured JSON batch output and per-item validation. The existing validateTranslation runs independently for each returned item. A failed item returns its original text while valid siblings remain usable and cacheable. A malformed JSON response or array-count mismatch fails the provider batch and returns the original input through the existing B3a failure path.

B3a wrote cache keys as a bare text hash. B3b changes the key format to `v2:<purpose>:<text hash>` through the named `createTranslationCacheKey` function. This purpose namespace prevents a plain result from being reused as an event-name result without event-name validation. Existing B3a records remain in IndexedDB under their old bare hashes and are not read or automatically deleted. A text with only an old-format entry is translated once again and then stored under its new purpose-specific key. This does not change returned values, settings, permissions, or valid v2 cache entries; users can remove old and current records with Clear translation cache.

In-flight de-duplication remains active across concurrent calls for the same text and purpose. Cache identity includes purpose so a plain translation cannot bypass event-name validation. Tests must prove: N cache misses produce one provider call; cache hits are omitted; a single validation failure preserves valid siblings; and concurrent duplicate requests share pending work. Existing same-text concurrency coverage must remain. Update assertions whose provider-call premise changes without weakening them, and keep all 64 existing tests passing.

This is an interface-preserving behavior change, not a public interface change. It is part of the B3b provider contract and must not be mistaken for an accidental multi-text request.
