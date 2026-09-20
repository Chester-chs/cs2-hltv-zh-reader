export interface GlossaryEntry {
  term: string;
  target: string;
  keep_as_is: boolean;
  category?: string;
  note?: string;
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
  options: { keepAsIsOnly?: boolean; category?: string } = {}
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
  options: { category?: string } = {}
): GlossaryLookup[] {
  return findMatches(text, glossary, options).map(({ entry, matchedText }) => ({
    entry,
    matchedText
  }));
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
  return /^\s*(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\s*$/u.test(
    text
  );
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

export function classifyText(
  text: string,
  glossary: GlossaryDocument
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

export type TranslationPurpose = 'plain' | 'event-name';

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
  transport: ChatCompletionsTransport;
}

class RequestTimeoutError extends Error {}

async function sendWithTimeout(
  transport: ChatCompletionsTransport,
  request: ChatCompletionsTransportRequest,
  timeoutMs: number
): Promise<ChatCompletionsTransportResponse> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new RequestTimeoutError('Provider request timed out.')),
        Math.max(1, timeoutMs)
      );
    });
    return await Promise.race([transport.send(request), timeout]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

  let parsedContent: unknown;
  try {
    parsedContent = JSON.parse(content) as unknown;
  } catch {
    return undefined;
  }

  if (
    !Array.isArray(parsedContent) ||
    parsedContent.length !== expectedLength ||
    !parsedContent.every((value): value is string => typeof value === 'string')
  ) {
    return undefined;
  }

  return parsedContent;
}

export function createOpenAICompatibleProvider(
  config: OpenAICompatibleProviderConfig
): TranslationProvider {
  const endpoint = `${config.baseURL.replace(/\/+$/u, '')}/chat/completions`;

  return {
    async translate(request) {
      const transportRequest: ChatCompletionsTransportRequest = {
        url: endpoint,
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeoutMs: config.timeoutMs,
        body: JSON.stringify({
          model: config.model,
          temperature: 0,
          messages: [
            {
              role: 'system',
              content:
                'Translate each text and return only a JSON string array. Protected fragments must remain character-for-character unchanged.'
            },
            {
              role: 'user',
              content: JSON.stringify({
                texts: request.texts,
                protectedFragments: request.protectedFragments,
                purposes: request.purposes
              })
            }
          ]
        })
      };

      let response: ChatCompletionsTransportResponse;
      try {
        response = await sendWithTimeout(
          config.transport,
          transportRequest,
          config.timeoutMs
        );
      } catch (error) {
        return {
          ok: false,
          error: {
            code:
              error instanceof RequestTimeoutError
                ? 'timeout'
                : 'transport-error',
            message: errorMessage(error)
          }
        };
      }

      if (response.status < 200 || response.status >= 300) {
        return {
          ok: false,
          error: {
            code: 'http-error',
            status: response.status,
            message: `Provider returned HTTP ${response.status}.`
          }
        };
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch (error) {
        return {
          ok: false,
          error: {
            code: 'invalid-response',
            message: errorMessage(error)
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
            message: 'Provider response did not contain the required string array.'
          }
        };
      }

      return { ok: true, translations };
    }
  };
}

export type ValidationFailureCode =
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

  const firstPositions = protectedFragments
    .filter((fragment) => fragment.length > 0)
    .map((fragment) => translated.indexOf(fragment));

  for (let index = 1; index < firstPositions.length; index += 1) {
    const previous = firstPositions[index - 1];
    const current = firstPositions[index];
    if (previous !== undefined && current !== undefined && current < previous) {
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
  glossary: GlossaryDocument
): TranslationValidation {
  const requiredTargets = new Map<string, number>();
  for (const lookup of lookupEntries(original, glossary)) {
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
  const protectedResult = validateProtectedFragments(
    translated,
    protectedFragments
  );
  if (!protectedResult.ok) {
    return protectedResult;
  }

  if (purpose === 'plain') {
    return { ok: true };
  }

  const yearResult = validateYearTokens(original, translated);
  if (!yearResult.ok) {
    return yearResult;
  }

  return validateGlossaryTargets(original, translated, glossary);
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
  hash?: TextHasher;
  onUncertainClassification?: UncertainClassificationSink;
}

export interface TranslationService {
  translate(texts: string[]): Promise<string[]>;
  translateEventNames(texts: string[]): Promise<string[]>;
}

export function createTranslationService(
  dependencies: TranslationServiceDependencies
): TranslationService {
  const hash = dependencies.hash ?? hashText;
  const inFlight = new Map<string, Promise<string>>();

  async function resolveOne(
    text: string,
    purpose: TranslationPurpose,
    key: string,
    protectedFragments: string[]
  ): Promise<string> {
    let cached: string | undefined;
    try {
      cached = await dependencies.cacheStore.get(key);
    } catch {
      cached = undefined;
    }

    if (cached !== undefined) {
      return cached;
    }

    let providerResult: ProviderResult;
    try {
      providerResult = await dependencies.provider.translate({
        texts: [text],
        protectedFragments: [protectedFragments],
        purposes: [purpose]
      });
    } catch {
      return text;
    }

    if (!providerResult.ok || providerResult.translations.length !== 1) {
      return text;
    }

    const translated = providerResult.translations[0];
    if (translated === undefined) {
      return text;
    }

    const validation = validateTranslation(
      text,
      translated,
      protectedFragments,
      purpose,
      dependencies.glossary
    );
    if (!validation.ok) {
      return text;
    }

    try {
      await dependencies.cacheStore.set(key, translated);
    } catch {
      // Cache persistence is best effort; the successful translation remains usable.
    }
    return translated;
  }

  async function translateBatch(
    texts: string[],
    purpose: TranslationPurpose
  ): Promise<string[]> {
    return Promise.all(
      texts.map(async (text) => {
        const decision = classifyText(text, dependencies.glossary);
        if (decision.reviewRequired) {
          dependencies.onUncertainClassification?.({ text, decision });
        }

        if (!decision.shouldTranslate) {
          return text;
        }

        const key = hash(text);
        const existing = inFlight.get(key);
        if (existing !== undefined) {
          return existing;
        }

        const protectedFragments = findKeepAsIsMatches(
          text,
          dependencies.glossary
        ).map((match) => match.matchedText);

        const pending = resolveOne(
          text,
          purpose,
          key,
          protectedFragments
        ).finally(() => {
          if (inFlight.get(key) === pending) {
            inFlight.delete(key);
          }
        });

        inFlight.set(key, pending);
        return pending;
      })
    );
  }

  return {
    translate(texts) {
      return translateBatch(texts, 'plain');
    },
    translateEventNames(texts) {
      return translateBatch(texts, 'event-name');
    }
  };
}
