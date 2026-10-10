import { parseProviderBaseURL } from '../../shared/provider-url.ts';
import {
  DEFAULT_TRANSLATION_CONTEXT,
  type TranslationContext
} from '../../shared/translation-context.ts';

export type { TranslationContext } from '../../shared/translation-context.ts';

export interface GlossaryEntry {
  term: string;
  target: string;
  keep_as_is: boolean;
  category?: string;
  note?: string;
  numericSuffix?: boolean;
}

export interface GlossaryDocument {
  version: number;
  entries: GlossaryEntry[];
}

export type GlossaryDiagnosticCode =
  | 'invalid-json'
  | 'invalid-document'
  | 'invalid-entry'
  | 'keep-as-is-target-mismatch';

export interface GlossaryDiagnostic {
  code: GlossaryDiagnosticCode;
  entryIndex?: number;
  message: string;
}

export interface GlossaryLoadResult {
  glossary: GlossaryDocument;
  diagnostics: GlossaryDiagnostic[];
}

export function parseGlossaryJson(source: string): GlossaryLoadResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(source) as unknown;
  } catch {
    return {
      glossary: { version: 1, entries: [] },
      diagnostics: [
        {
          code: 'invalid-json',
          message: 'Glossary source is not valid JSON.'
        }
      ]
    };
  }

  if (
    !isRecord(parsed) ||
    parsed.version !== 1 ||
    !Array.isArray(parsed.entries)
  ) {
    return {
      glossary: { version: 1, entries: [] },
      diagnostics: [
        {
          code: 'invalid-document',
          message: 'Glossary payload must contain version 1 and an entries array.'
        }
      ]
    };
  }

  const entries: GlossaryEntry[] = [];
  const diagnostics: GlossaryDiagnostic[] = [];

  parsed.entries.forEach((rawEntry, entryIndex) => {
    if (!isRecord(rawEntry)) {
      diagnostics.push({
        code: 'invalid-entry',
        entryIndex,
        message: 'Glossary entry must be an object.'
      });
      return;
    }

    const term = rawEntry.term;
    const target = rawEntry.target;
    const keepAsIs = rawEntry.keep_as_is;

    if (
      typeof term !== 'string' ||
      term.length === 0 ||
      typeof target !== 'string' ||
      target.length === 0 ||
      typeof keepAsIs !== 'boolean' ||
      (rawEntry.category !== undefined && typeof rawEntry.category !== 'string') ||
      (rawEntry.note !== undefined && typeof rawEntry.note !== 'string')
    ) {
      diagnostics.push({
        code: 'invalid-entry',
        entryIndex,
        message: 'Glossary entry has an invalid required or optional field.'
      });
      return;
    }

    if (keepAsIs && target !== term) {
      diagnostics.push({
        code: 'keep-as-is-target-mismatch',
        entryIndex,
        message: 'A keep-as-is entry must have an identical term and target.'
      });
      return;
    }

    const entry: GlossaryEntry = {
      term,
      target,
      keep_as_is: keepAsIs
    };

    if (typeof rawEntry.category === 'string') {
      entry.category = rawEntry.category;
    }
    if (typeof rawEntry.note === 'string') {
      entry.note = rawEntry.note;
    }
    if (rawEntry.numericSuffix === true) {
      entry.numericSuffix = true;
    }

    entries.push(entry);
  });

  return { glossary: { version: 1, entries }, diagnostics };
}

export interface GlossaryMatch {
  entry: GlossaryEntry;
  matchedText: string;
  start: number;
  end: number;
}

export interface GlossaryLookup {
  entry: GlossaryEntry;
  matchedText: string;
}

interface NormalizedText {
  value: string;
  starts: number[];
  ends: number[];
}

interface InternalGlossaryMatch extends GlossaryMatch {
  normalizedLength: number;
  entryIndex: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeWithSourceMap(source: string): NormalizedText {
  let value = '';
  const starts: number[] = [];
  const ends: number[] = [];
  let sourceIndex = 0;
  let previousWasSpace = false;

  for (const character of source) {
    const start = sourceIndex;
    sourceIndex += character.length;

    if (/\s/u.test(character)) {
      if (previousWasSpace && ends.length > 0) {
        ends[ends.length - 1] = sourceIndex;
        continue;
      }
      value += ' ';
      starts.push(start);
      ends.push(sourceIndex);
      previousWasSpace = true;
      continue;
    }

    previousWasSpace = false;
    const normalized = character.normalize('NFKC').toLocaleLowerCase();
    for (let index = 0; index < normalized.length; index += 1) {
      value += normalized[index];
      starts.push(start);
      ends.push(sourceIndex);
    }
  }

  return { value, starts, ends };
}

function isIdentifierCharacter(character: string | undefined): boolean {
  return character !== undefined && /[\p{L}\p{N}_]/u.test(character);
}

function findMatches(
  text: string,
  glossary: GlossaryDocument,
  options: {
    keepAsIsOnly?: boolean;
    category?: string;
    excludedCategories?: readonly string[];
  } = {}
): InternalGlossaryMatch[] {
  const normalizedText = normalizeWithSourceMap(text);
  const candidates: InternalGlossaryMatch[] = [];

  glossary.entries.forEach((entry, entryIndex) => {
    if (options.keepAsIsOnly && !entry.keep_as_is) {
      return;
    }
    if (options.category !== undefined && entry.category !== options.category) {
      return;
    }
    if (options.excludedCategories?.includes(entry.category ?? '')) {
      return;
    }

    const normalizedTerm = normalizeWithSourceMap(entry.term).value.trim();
    if (normalizedTerm.length === 0) {
      return;
    }

    let searchFrom = 0;
    while (searchFrom < normalizedText.value.length) {
      const normalizedStart = normalizedText.value.indexOf(
        normalizedTerm,
        searchFrom
      );
      if (normalizedStart === -1) {
        break;
      }

      const normalizedEnd = normalizedStart + normalizedTerm.length;
      const before = normalizedText.value[normalizedStart - 1];
      const after = normalizedText.value[normalizedEnd];

      if (
        !isIdentifierCharacter(before) &&
        !isIdentifierCharacter(after) &&
        normalizedText.starts[normalizedStart] !== undefined &&
        normalizedText.ends[normalizedEnd - 1] !== undefined
      ) {
        const start = normalizedText.starts[normalizedStart];
        const end = normalizedText.ends[normalizedEnd - 1];
        candidates.push({
          entry,
          matchedText: text.slice(start, end),
          start,
          end,
          normalizedLength: normalizedTerm.length,
          entryIndex
        });
      }

      searchFrom = normalizedStart + Math.max(normalizedTerm.length, 1);
    }
  });

  candidates.sort(
    (left, right) =>
      right.normalizedLength - left.normalizedLength ||
      left.start - right.start ||
      left.entryIndex - right.entryIndex
  );

  const selected: InternalGlossaryMatch[] = [];
  for (const candidate of candidates) {
    const overlaps = selected.some(
      (existing) =>
        candidate.start < existing.end && existing.start < candidate.end
    );
    if (!overlaps) {
      selected.push(candidate);
    }
  }

  return selected.sort(
    (left, right) => left.start - right.start || left.end - right.end
  );
}

export function findKeepAsIsMatches(
  text: string,
  glossary: GlossaryDocument
): GlossaryMatch[] {
  return findMatches(text, glossary, { keepAsIsOnly: true }).map(
    ({ entry, matchedText, start, end }) => ({
      entry,
      matchedText,
      start,
      end
    })
  );
}

export function lookupEntries(
  text: string,
  glossary: GlossaryDocument,
  options: { category?: string; excludedCategories?: readonly string[] } = {}
): GlossaryLookup[] {
  return findMatches(text, glossary, options).map(({ entry, matchedText }) => ({
    entry,
    matchedText
  }));
}

export function translateGlossaryCoveredText(
  text: string,
  glossary: GlossaryDocument,
  purpose: TranslationPurpose
): string | undefined {
  const matches = findMatches(text, glossary, {
    excludedCategories: excludedGlossaryCategoriesForPurpose(purpose)
  });
  return translateCoveredMatches(text, matches);
}

export function translateFixedUiTexts(
  texts: string[],
  glossary: GlossaryDocument,
  categories: readonly string[] = ['ui']
): string[] {
  const fixedGlossary: GlossaryDocument = {
    version: 1,
    entries: glossary.entries.filter((entry) => categories.includes(entry.category ?? ''))
  };
  return texts.map((text) => {
    const matches = findMatches(text, fixedGlossary);
    const complete = translateCoveredMatches(text, matches);
    if (complete !== undefined) {
      return complete;
    }
    const suffix = matches.find((match) => match.entry.numericSuffix === true &&
      /\d\s*$/u.test(text.slice(0, match.start)) && text.slice(match.end).trim().length === 0);
    if (suffix === undefined || suffix.entry.keep_as_is) {
      return text;
    }
    return text.slice(0, suffix.start) + suffix.entry.target + text.slice(suffix.end);
  });
}

function translateCoveredMatches(text: string, matches: readonly GlossaryMatch[]): string | undefined {
  if (matches.length === 0) {
    return undefined;
  }

  let foundLetter = false;
  for (let index = 0; index < text.length;) {
    const codePoint = text.codePointAt(index);
    if (codePoint === undefined) {
      break;
    }
    const character = String.fromCodePoint(codePoint);
    const nextIndex = index + character.length;
    if (/\p{L}/u.test(character)) {
      foundLetter = true;
      const covered = matches.some(
        (match) => index >= match.start && nextIndex <= match.end
      );
      if (!covered) {
        return undefined;
      }
    }
    index = nextIndex;
  }
  if (!foundLetter) {
    return undefined;
  }

  let translated = '';
  let cursor = 0;
  for (const match of matches) {
    translated += text.slice(cursor, match.start);
    translated += match.entry.keep_as_is
      ? match.matchedText
      : match.entry.target;
    cursor = match.end;
  }
  return translated + text.slice(cursor);
}

export function isEntirelyKeepAsIs(
  text: string,
  glossary: GlossaryDocument
): boolean {
  if (text.trim().length === 0) {
    return false;
  }

  const matches = findKeepAsIsMatches(text, glossary);
  if (matches.length === 0) {
    return false;
  }

  let cursor = 0;
  for (const match of matches) {
    if (text.slice(cursor, match.start).trim().length > 0) {
      return false;
    }
    cursor = match.end;
  }

  return text.slice(cursor).trim().length === 0;
}

export type LanguageDecisionKind =
  | 'empty'
  | 'pure-number'
  | 'pure-date'
  | 'pure-symbol'
  | 'keep-as-is'
  | 'target-language'
  | 'translatable'
  | 'uncertain';

export interface LanguageDecision {
  text: string;
  kind: LanguageDecisionKind;
  shouldTranslate: boolean;
  confidence: number;
  reason: string;
  glossaryMatches: GlossaryMatch[];
  reviewRequired: boolean;
}

function makeDecision(
  text: string,
  kind: LanguageDecisionKind,
  shouldTranslate: boolean,
  confidence: number,
  reason: string,
  glossaryMatches: GlossaryMatch[] = []
): LanguageDecision {
  return {
    text,
    kind,
    shouldTranslate,
    confidence,
    reason,
    glossaryMatches,
    reviewRequired: kind === 'uncertain'
  };
}

function isPureDate(text: string): boolean {
  if (
    /^\s*(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\s*$/u.test(
      text
    )
  ) {
    return true;
  }

  const month =
    '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
  const day = '\\d{1,2}(?:st|nd|rd|th)?';
  return new RegExp(
    `^\\s*(?:${month}\\s+${day}(?:,?\\s+\\d{4})?|${month}\\s+\\d{4}|${day}\\s+${month}(?:,?\\s+\\d{4})?)\\s*$`,
    'iu'
  ).test(text);
}

function isPureNumber(text: string): boolean {
  return /^\s*[+-]?\d+(?:[.,]\d+)?\s*$/u.test(text);
}

function hasOnlySymbols(text: string): boolean {
  return !/[\p{L}\p{N}]/u.test(text);
}

function isTargetLanguageText(text: string): boolean {
  const characters = Array.from(text);
  const hanCount = characters.filter((character) =>
    /\p{Script=Han}/u.test(character)
  ).length;
  const letterCount = characters.filter((character) =>
    /\p{L}/u.test(character)
  ).length;
  const hasConflictingScript = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(
    text
  );

  return (
    hanCount >= 2 &&
    letterCount > 0 &&
    hanCount / letterCount >= 0.6 &&
    !hasConflictingScript
  );
}

function isConservativeShortText(text: string): boolean {
  const tokens = text.match(/[A-Za-z]+(?:'[A-Za-z]+)?/gu) ?? [];
  const hasNumber = /\p{N}/u.test(text);
  const hasHashtag = /#[A-Za-z]/u.test(text);
  const hasBracketOrEmoticon = /[<>[\]]/u.test(text);

  return (
    tokens.length <= 2 ||
    hasNumber ||
    hasHashtag ||
    hasBracketOrEmoticon
  );
}

function hasOnlyLatinLetters(text: string): boolean {
  let foundLatinLetter = false;
  for (const character of text) {
    if (!/\p{L}/u.test(character)) {
      continue;
    }
    if (!/\p{Script=Latin}/u.test(character)) {
      return false;
    }
    foundLatinLetter = true;
  }
  return foundLatinLetter;
}

function isLikelyLatinIdentity(text: string): boolean {
  if (!/[^\u0000-\u007f]/u.test(text)) {
    return false;
  }
  const words = text.match(/\p{L}+/gu) ?? [];
  return (
    words.length === 2 &&
    words.every((word) => /^\p{Lu}\p{Ll}+$/u.test(word))
  );
}

export function classifyText(
  text: string,
  glossary: GlossaryDocument,
  context: TranslationContext = DEFAULT_TRANSLATION_CONTEXT
): LanguageDecision {
  const trimmed = text.trim();
  const keepMatches = findKeepAsIsMatches(text, glossary);

  if (trimmed.length === 0) {
    return makeDecision(text, 'empty', false, 1, 'Empty text.', keepMatches);
  }
  if (isPureNumber(trimmed)) {
    return makeDecision(
      text,
      'pure-number',
      false,
      1,
      'Pure numeric value.',
      keepMatches
    );
  }
  if (isPureDate(trimmed)) {
    return makeDecision(
      text,
      'pure-date',
      false,
      1,
      'Pure date value.',
      keepMatches
    );
  }
  if (hasOnlySymbols(trimmed)) {
    return makeDecision(
      text,
      'pure-symbol',
      false,
      1,
      'Pure symbol or emoji value.',
      keepMatches
    );
  }
  if (isEntirelyKeepAsIs(text, glossary)) {
    return makeDecision(
      text,
      'keep-as-is',
      false,
      1,
      'The complete text is covered by keep-as-is glossary entries.',
      keepMatches
    );
  }
  if (isTargetLanguageText(trimmed)) {
    return makeDecision(
      text,
      'target-language',
      false,
      0.95,
      'Multiple signals identify the text as Chinese.',
      keepMatches
    );
  }

  const containsHan = /\p{Script=Han}/u.test(trimmed);
  const tokens = trimmed.match(/[A-Za-z]+(?:'[A-Za-z]+)?/gu) ?? [];
  const latinCount = (trimmed.match(/[A-Za-z]/gu) ?? []).length;

  if (!hasOnlyLatinLetters(trimmed)) {
    return makeDecision(
      text,
      'uncertain',
      false,
      0.25,
      'Text does not contain English-only letter signals.',
      keepMatches
    );
  }

  if (context === 'structured') {
    return makeDecision(
      text,
      'translatable',
      true,
      0.9,
      'Structured content contains Latin-script text.',
      keepMatches
    );
  }

  if (context === 'prose') {
    if (isLikelyLatinIdentity(trimmed)) {
      return makeDecision(
        text,
        'uncertain',
        false,
        0.2,
        'Two title-cased Latin words with diacritics are likely a person or team identity.',
        keepMatches
      );
    }
    if (latinCount < 5 || tokens.length < 2) {
      return makeDecision(
        text,
        'uncertain',
        false,
        0.4,
        'Prose did not meet the minimum English word and letter threshold.',
        keepMatches
      );
    }
    return makeDecision(
      text,
      'translatable',
      true,
      0.8,
      'Prose contains multiple Latin-script words.',
      keepMatches
    );
  }

  if (
    containsHan ||
    latinCount < 5 ||
    tokens.length < 2 ||
    isConservativeShortText(trimmed)
  ) {
    return makeDecision(
      text,
      'uncertain',
      false,
      0.25,
      'Short, mixed, or ambiguous text requires review.',
      keepMatches
    );
  }

  return makeDecision(
    text,
    'translatable',
    true,
    0.9,
    'Sufficient English signals were found without a conflicting script.',
    keepMatches
  );
}

export type TranslationPurpose = 'plain' | 'event-name' | 'dictionary' | 'sentence';

function excludedGlossaryCategoriesForPurpose(
  purpose: TranslationPurpose
): readonly string[] {
  return purpose === 'event-name'
    ? ['ui', 'ui-match', 'ui-stats', 'ui-profile', 'ui-navigation']
    : ['ui-stats', 'ui-profile', 'ui-navigation'];
}

function excludedGlossaryValidationCategoriesForPurpose(
  purpose: TranslationPurpose
): readonly string[] {
  return purpose === 'event-name'
    ? ['ui', 'ui-match', 'ui-stats', 'ui-profile', 'ui-navigation']
    : ['ui-match', 'ui-stats', 'ui-profile', 'ui-navigation'];
}

export interface ProviderRequest {
  texts: string[];
  protectedFragments: string[][];
  purposes: TranslationPurpose[];
}

export type ProviderErrorCode =
  | 'timeout'
  | 'transport-error'
  | 'http-error'
  | 'invalid-response';

export interface ProviderError {
  code: ProviderErrorCode;
  message: string;
  status?: number;
}

export type ProviderResult =
  | { ok: true; translations: string[] }
  | { ok: false; error: ProviderError };

export interface TranslationProvider {
  translate(request: ProviderRequest): Promise<ProviderResult>;
}

export interface ChatCompletionsTransportRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
  timeoutMs: number;
}

export interface ChatCompletionsTransportResponse {
  status: number;
  json(): Promise<unknown>;
}

export interface ChatCompletionsTransport {
  send(
    request: ChatCompletionsTransportRequest
  ): Promise<ChatCompletionsTransportResponse>;
}

export interface OpenAICompatibleProviderConfig {
  baseURL: string;
  model: string;
  apiKey: string;
  timeoutMs: number;
  temperature?: number;
  useJsonOutputMode?: boolean;
  translationStyle?: 'natural' | 'literal';
  transport: ChatCompletionsTransport;
}

export const DEFAULT_PROVIDER_TEMPERATURE = 0.2;

class RequestTimeoutError extends Error {}

async function sendWithTimeout(
  operation: () => Promise<unknown>,
  timeoutMs: number
): Promise<unknown> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new RequestTimeoutError('Provider request timed out.')),
        Math.max(1, timeoutMs)
      );
    });
    return await Promise.race([operation(), timeout]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

function parseProviderTranslations(
  payload: unknown,
  expectedLength: number
): string[] | undefined {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) {
    return undefined;
  }

  const firstChoice = payload.choices[0];
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) {
    return undefined;
  }

  const content = firstChoice.message.content;
  if (typeof content !== 'string') {
    return undefined;
  }

  const fencedContent = content.trim();
  const fence = /^\x60{3}(?:json)?\s*([\s\S]*?)\s*\x60{3}$/iu.exec(fencedContent);
  let parsedContent: unknown;
  try {
    parsedContent = JSON.parse((fence?.[1] ?? fencedContent).trim()) as unknown;
  } catch {
    return undefined;
  }

  if (
    !isRecord(parsedContent) ||
    Object.keys(parsedContent).length !== 1 ||
    !Array.isArray(parsedContent.translations) ||
    parsedContent.translations.length !== expectedLength ||
    !parsedContent.translations.every(
      (value): value is string => typeof value === 'string'
    )
  ) {
    return undefined;
  }

  return parsedContent.translations;
}

function createChatCompletionsEndpoint(baseURL: string): string {
  const parsed = parseProviderBaseURL(baseURL);
  if (parsed === undefined) {
    throw new Error('Invalid provider base URL.');
  }
  return parsed.endpoint;
}

function mentionsResponseFormat(value: unknown): boolean {
  if (typeof value === 'string') {
    return /response[_\s-]?format/iu.test(value);
  }
  if (Array.isArray(value)) {
    return value.some(mentionsResponseFormat);
  }
  if (!isRecord(value)) {
    return false;
  }
  return Object.entries(value).some(
    ([key, child]) =>
      /response[_\s-]?format/iu.test(key) || mentionsResponseFormat(child)
  );
}

export function createOpenAICompatibleProvider(
  config: OpenAICompatibleProviderConfig
): TranslationProvider {
  const endpoint = createChatCompletionsEndpoint(config.baseURL);
  const temperature =
    config.temperature ?? DEFAULT_PROVIDER_TEMPERATURE;
  const useJsonOutputMode = config.useJsonOutputMode ?? true;
  const translationStyle = config.translationStyle ?? 'natural';
  const systemPrompt = [
    '你是 CS2 新闻与赛事名称翻译器。把输入中的每一条英文翻译成简体中文。',
    '',
    '输入包含 items 数组。每项都有 index、purpose、text 和 protected_fragments。输出 translations 数组必须按输入顺序逐项对应，条数必须与 items 完全相同。',
    '',
    '保护片段来自 glossary 中 keep_as_is 为 true 的条目。用户数据会针对每条输入逐条列出 protected_fragments。不得翻译、改写、增删、拆分或改变其中任何片段的字符；每个保护片段必须在对应译文中原样出现。',
    '',
    'purpose 为 event-name 时，保留赛事及品牌名称。尤其要逐字保留该条目的全部 protected_fragments。允许调整其他词语的语序，使名称符合简体中文习惯，例如将季节和年份调整到赛事名称之前。',
    '',
    `purpose 为 plain 时，${translationStyle === 'literal' ? '尽量贴近英文句子结构地翻译成简体中文' : '自然地翻译成简体中文'}，并保留原文中的事实、数字和含义。`,
    '',
    'purpose 为 dictionary 时，按学习词典风格整理每个选中的英文单词。必须包含所有适用的常见词性；每项使用“词性：中文释义 || concise English definition”格式，中文释义和英文解释都要简短准确。若输入是动词变形或过去分词，且能可靠确定原形，给出“动词原形：...”一项；无法确定时省略，不得仅凭词尾猜测。输入本身是动词原形时不要重复输出原形。若能确定发音，接着给出“英式音标：...；美式音标：...”两项；不确定时省略音标。给出“CEFR 参考等级：A1/A2/B1/B2/C1/C2”，无法可靠确定时写“CEFR 参考等级：未知”。这是模型参考信息，不得宣称来自牛津官方数据或捏造官方等级。可选地给出一条“例句：...”和“网络：...”义项。不要输出“中文释义”“英文释义”等字段名，不要编造不常见的词性，不要输出推理过程、Markdown 或额外字段。',
    'purpose 为 sentence 时，把选中的完整句子或短语自然翻译成简体中文，保留事实、数字、专名和原意，不输出词典格式。',
    '',
    '只输出一个合法 JSON 对象，形状必须为 {"translations":["译文"]}。不要输出解释、额外字段、前后缀或 Markdown 代码块围栏。',
    '',
    '最小示例：',
    '输入：{"items":[{"index":1,"purpose":"event-name","text":"Fall 2026 StarLadder StarSeries","protected_fragments":["StarLadder StarSeries"]}]}',
    '输出：{"translations":["2026 秋季赛 StarLadder StarSeries"]}'
  ].join('\n');

  return {
    async translate(request) {
      const messages = [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: JSON.stringify({
            items: request.texts.map((text, index) => ({
              index: index + 1,
              purpose: request.purposes[index] ?? 'plain',
              text,
              protected_fragments: request.protectedFragments[index] ?? []
            }))
          })
        }
      ];
      const body: Record<string, unknown> = {
        model: config.model,
        temperature,
        messages
      };
      if (useJsonOutputMode) {
        body.response_format = { type: 'json_object' };
      }

      const transportRequest: ChatCompletionsTransportRequest = {
        url: endpoint,
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeoutMs: config.timeoutMs,
        body: JSON.stringify(body)
      };

      let response: ChatCompletionsTransportResponse;
      let payload: unknown;
      let payloadReadable = false;
      try {
        const result = await sendWithTimeout(async () => {
          const nextResponse = await config.transport.send(transportRequest);
          let nextPayload: unknown;
          try {
            nextPayload = await nextResponse.json();
            payloadReadable = true;
          } catch {
            payloadReadable = false;
          }
          return { response: nextResponse, payload: nextPayload };
        }, config.timeoutMs) as { response: ChatCompletionsTransportResponse; payload: unknown };
        response = result.response;
        payload = result.payload;
      } catch (error) {
        return {
          ok: false,
          error: {
            code:
              error instanceof RequestTimeoutError
                ? 'timeout'
                : 'transport-error',
            message:
              error instanceof RequestTimeoutError
                ? 'Provider request timed out.'
                : 'Network request failed.'
          }
        };
      }

      if (response.status < 200 || response.status >= 300) {
        let rejectedResponseFormat = false;
        if (
          useJsonOutputMode &&
          response.status >= 400 &&
          response.status < 500
        ) {
          rejectedResponseFormat = payloadReadable && mentionsResponseFormat(payload);
        }
        return {
          ok: false,
          error: {
            code: 'http-error',
            status: response.status,
            message: rejectedResponseFormat
              ? 'Provider rejected response_format.'
              : 'Provider returned HTTP ' + response.status + '.'
          }
        };
      }

      if (!payloadReadable) {
        return {
          ok: false,
          error: {
            code: 'invalid-response',
            message: 'Provider returned invalid JSON.'
          }
        };
      }

      const translations = parseProviderTranslations(
        payload,
        request.texts.length
      );
      if (translations === undefined) {
        return {
          ok: false,
          error: {
            code: 'invalid-response',
            message: 'Provider response did not contain a valid translations array.'
          }
        };
      }

      return { ok: true, translations };
    }
  };
}

export type ValidationFailureCode =
  | 'empty-translation'
  | 'protected-fragment-missing'
  | 'protected-fragment-count-mismatch'
  | 'year-token-missing'
  | 'glossary-target-missing'
  | 'structure-mismatch';

export type TranslationValidation =
  | { ok: true }
  | { ok: false; code: ValidationFailureCode; message: string };

function countExact(text: string, fragment: string): number {
  if (fragment.length === 0) {
    return 0;
  }

  let count = 0;
  let position = 0;
  while (position < text.length) {
    const found = text.indexOf(fragment, position);
    if (found === -1) {
      break;
    }
    count += 1;
    position = found + fragment.length;
  }
  return count;
}

function validateProtectedFragments(
  translated: string,
  protectedFragments: string[]
): TranslationValidation {
  const expectedCounts = new Map<string, number>();
  for (const fragment of protectedFragments) {
    if (fragment.length > 0) {
      expectedCounts.set(fragment, (expectedCounts.get(fragment) ?? 0) + 1);
    }
  }

  for (const [fragment, expectedCount] of expectedCounts) {
    const actualCount = countExact(translated, fragment);
    if (actualCount === 0) {
      return {
        ok: false,
        code: 'protected-fragment-missing',
        message: `Protected fragment is missing: ${fragment}`
      };
    }
    if (actualCount !== expectedCount) {
      return {
        ok: false,
        code: 'protected-fragment-count-mismatch',
        message: `Protected fragment count changed: ${fragment}`
      };
    }
  }

  const firstPositions: number[] = [];
  let searchFrom = 0;
  for (const fragment of protectedFragments) {
    if (fragment.length === 0) {
      continue;
    }
    const position = translated.indexOf(fragment, searchFrom);
    firstPositions.push(position);
    if (position < 0) {
      return {
        ok: false,
        code: 'structure-mismatch',
        message: 'Protected fragments changed relative order.'
      };
    }
    searchFrom = position + fragment.length;
  }

  for (let index = 1; index < firstPositions.length; index += 1) {
    const previous = firstPositions[index - 1];
    const current = firstPositions[index];
    if (previous >= 0 && current >= 0 && current < previous) {
      // structure-mismatch is intentionally limited to protected-fragment order.
      return {
        ok: false,
        code: 'structure-mismatch',
        message: 'Protected fragments changed relative order.'
      };
    }
  }

  return { ok: true };
}

function validateYearTokens(
  original: string,
  translated: string
): TranslationValidation {
  const requiredYears = original.match(/\b(?:19|20)\d{2}\b/gu) ?? [];
  for (const year of new Set(requiredYears)) {
    if (countExact(translated, year) < countExact(original, year)) {
      return {
        ok: false,
        code: 'year-token-missing',
        message: `Year token is missing: ${year}`
      };
    }
  }
  return { ok: true };
}

function validateGlossaryTargets(
  original: string,
  translated: string,
  glossary: GlossaryDocument,
  purpose: TranslationPurpose
): TranslationValidation {
  const requiredTargets = new Map<string, number>();
  for (const lookup of lookupEntries(original, glossary, {
    excludedCategories: excludedGlossaryValidationCategoriesForPurpose(purpose)
  })) {
    if (!lookup.entry.keep_as_is) {
      requiredTargets.set(
        lookup.entry.target,
        (requiredTargets.get(lookup.entry.target) ?? 0) + 1
      );
    }
  }

  for (const [target, expectedCount] of requiredTargets) {
    if (countExact(translated, target) < expectedCount) {
      return {
        ok: false,
        code: 'glossary-target-missing',
        message: `Glossary target is missing: ${target}`
      };
    }
  }

  return { ok: true };
}

export function validateTranslation(
  original: string,
  translated: string,
  protectedFragments: string[],
  purpose: TranslationPurpose,
  glossary: GlossaryDocument
): TranslationValidation {
  if (translated.trim().length === 0) {
    return {
      ok: false,
      code: 'empty-translation',
      message: 'Provider returned an empty translation.'
    };
  }
  const protectedResult = validateProtectedFragments(
    translated,
    protectedFragments
  );
  if (!protectedResult.ok) {
    return protectedResult;
  }

  if (purpose === 'plain' || purpose === 'dictionary' || purpose === 'sentence') {
    return { ok: true };
  }

  const yearResult = validateYearTokens(original, translated);
  if (!yearResult.ok) {
    return yearResult;
  }

  return validateGlossaryTargets(original, translated, glossary, purpose);
}

export interface CacheStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
}

export type TextHasher = (text: string) => string;

export function hashText(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * B3b format: v2:<purpose>:<text hash>. B3a used the bare text hash, so its
 * records become inert cache misses and remain until the user clears cache.
 */
function createTranslationCacheKey(
  text: string,
  purpose: TranslationPurpose,
  hash: TextHasher,
  namespace: string
): string {
  return 'v3:' + encodeURIComponent(namespace) + ':' + purpose + ':' + encodeURIComponent(text);
}

function createLegacyTranslationCacheKey(
  text: string,
  purpose: TranslationPurpose,
  hash: TextHasher
): string {
  return 'v2:' + purpose + ':' + hash(text);
}

export interface UncertainClassificationRecord {
  text: string;
  decision: LanguageDecision;
}

export type UncertainClassificationSink = (
  record: UncertainClassificationRecord
) => void;

export interface TranslationServiceDependencies {
  glossary: GlossaryDocument;
  provider: TranslationProvider;
  cacheStore: CacheStore;
  context?: TranslationContext;
  hash?: TextHasher;
  cacheNamespace?: string;
  onUncertainClassification?: UncertainClassificationSink;
}

export interface TranslationService {
  translate(texts: string[]): Promise<string[]>;
  translateEventNames(texts: string[]): Promise<string[]>;
  translateDictionary?(texts: string[]): Promise<string[]>;
}

export function createTranslationService(
  dependencies: TranslationServiceDependencies
): TranslationService {
  const hash = dependencies.hash ?? hashText;
  const cacheNamespace = dependencies.cacheNamespace ?? 'default';
  const inFlight = new Map<string, Promise<string>>();

  interface PendingTranslation {
    cacheKey: string;
    legacyCacheKey: string;
    text: string;
    purpose: TranslationPurpose;
    protectedFragments: string[];
    promise: Promise<string>;
    resolve(value: string): void;
  }

  async function translateBatch(
    texts: string[],
    purpose: TranslationPurpose
  ): Promise<string[]> {
    const results = [...texts];
    const owned = new Map<string, PendingTranslation>();
    const waiters: Array<{ index: number; promise: Promise<string> }> = [];

    for (let index = 0; index < texts.length; index += 1) {
      const text = texts[index] as string;
      const glossaryTranslation = purpose === 'dictionary'
        ? undefined
        : translateGlossaryCoveredText(
            text,
            dependencies.glossary,
            purpose
          );
      if (glossaryTranslation !== undefined) {
        results[index] = glossaryTranslation;
        continue;
      }

      const decision = classifyText(
        text,
        dependencies.glossary,
        purpose === 'dictionary'
          ? 'structured'
          : dependencies.context ?? DEFAULT_TRANSLATION_CONTEXT
      );
      if (decision.reviewRequired) {
        dependencies.onUncertainClassification?.({ text, decision });
      }
      if (!decision.shouldTranslate) {
        continue;
      }

      const cacheKey = createTranslationCacheKey(text, purpose, hash, cacheNamespace);
      const legacyCacheKey = createLegacyTranslationCacheKey(text, purpose, hash);
      const existing = inFlight.get(cacheKey);
      if (existing !== undefined) {
        waiters.push({ index, promise: existing });
        continue;
      }

      let pending = owned.get(cacheKey);
      if (pending === undefined) {
        let resolve!: (value: string) => void;
        const promise = new Promise<string>((accept) => {
          resolve = accept;
        });
        const protectedFragments = findKeepAsIsMatches(
          text,
          dependencies.glossary
        ).map((match) => match.matchedText);
        pending = {
          cacheKey,
          legacyCacheKey,
          text,
          purpose,
          protectedFragments,
          promise,
          resolve
        };
        owned.set(cacheKey, pending);
        inFlight.set(cacheKey, promise);
      }
      waiters.push({ index, promise: pending.promise });
    }

    const candidates = Array.from(owned.values());
    const cacheResults = await Promise.all(
      candidates.map(async (candidate) => {
        try {
          const current = await dependencies.cacheStore.get(candidate.cacheKey);
          if (current !== undefined) {
            return current;
          }
          return dependencies.cacheNamespace === undefined || cacheNamespace === 'default'
            ? dependencies.cacheStore.get(candidate.legacyCacheKey)
            : undefined;
        } catch {
          return undefined;
        }
      })
    );
    const misses: PendingTranslation[] = [];

    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index] as PendingTranslation;
      const cached = cacheResults[index];
      if (cached !== undefined) {
        candidate.resolve(cached);
        if (inFlight.get(candidate.cacheKey) === candidate.promise) {
          inFlight.delete(candidate.cacheKey);
        }
      } else {
        misses.push(candidate);
      }
    }

    if (misses.length > 0) {
      let providerResult: ProviderResult | undefined;
      try {
        providerResult = await dependencies.provider.translate({
          texts: misses.map((candidate) => candidate.text),
          protectedFragments: misses.map(
            (candidate) => candidate.protectedFragments
          ),
          purposes: misses.map((candidate) => candidate.purpose)
        });
      } catch {
        providerResult = undefined;
      }

      const validTranslations =
        providerResult?.ok === true &&
        Array.isArray(providerResult.translations) &&
        providerResult.translations.length === misses.length &&
        providerResult.translations.every(
          (translation): translation is string =>
            typeof translation === 'string'
        )
          ? providerResult.translations
          : undefined;

      for (let index = 0; index < misses.length; index += 1) {
        const candidate = misses[index] as PendingTranslation;
        const translated = validTranslations?.[index];
        let value = candidate.text;

        if (translated !== undefined) {
          const validation = validateTranslation(
            candidate.text,
            translated,
            candidate.protectedFragments,
            candidate.purpose,
            dependencies.glossary
          );
          if (validation.ok) {
            value = translated;
            try {
              await dependencies.cacheStore.set(candidate.cacheKey, translated);
            } catch {
              // Cache persistence is best effort; the translation remains usable.
            }
          }
        }

        candidate.resolve(value);
        if (inFlight.get(candidate.cacheKey) === candidate.promise) {
          inFlight.delete(candidate.cacheKey);
        }
      }
    }

    await Promise.all(
      waiters.map(async ({ index, promise }) => {
        results[index] = await promise;
      })
    );
    return results;
  }

  return {
    translate(texts) {
      return translateBatch(texts, 'plain');
    },
    translateEventNames(texts) {
      return translateBatch(texts, 'event-name');
    },
    translateDictionary(texts) {
      return translateBatch(texts, 'dictionary');
    }
  };
}
