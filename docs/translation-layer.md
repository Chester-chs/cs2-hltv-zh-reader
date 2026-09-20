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

classifyText(
  text: string,
  glossary: GlossaryDocument
): LanguageDecision;
```

判定顺序固定：

1. 空文本、纯数字、纯日期、纯符号/emoji；
2. 完整文本被 `keep_as_is` 词条覆盖；
3. 中文目标语言；
4. 其余文本判为可翻译，低置信度则判为 `uncertain`。

中文判定不是单一正则：至少两个汉字、汉字占文字字符约 60% 以上，且无日文假名或韩文冲突信号时才判为目标语言。含中文但比例不足的中英混排文本保守地保留。

英文判定要求至少 5 个拉丁字母和至少 2 个英文 token。短文本、数字混排、话题标签、括号/表情符号和歧义标签进入 `uncertain`，`shouldTranslate` 为 `false`，`reviewRequired` 为 `true`。

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

缓存 key 是原文 hash。服务会先查缓存，只请求增量；相同文本的并发请求通过 in-flight 去重。Provider、校验和缓存失败均回退原文。`CacheStore` 是必填依赖，核心层没有默认内存缓存。

本块尚未接入 background，也没有 IndexedDB 适配器，因此真实扩展集成的缓存命中率为 **0**。内存 CacheStore 只存在于测试代码中；后续由 background 侧提供 IndexedDB 适配器并复用此接口。
