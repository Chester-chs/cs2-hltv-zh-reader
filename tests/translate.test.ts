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

import { classifyText, createOpenAICompatibleProvider, createTranslationService, findKeepAsIsMatches, hashText, isEntirelyKeepAsIs, lookupEntries, parseGlossaryJson, validateTranslation, type CacheStore, type ChatCompletionsTransport, type ChatCompletionsTransportRequest, type GlossaryDocument, type ProviderRequest, type ProviderResult, type TranslationProvider } from '../src/core/translate/index.ts';

const glossary: GlossaryDocument = {
  version: 1,
  entries: [
    {
      term: 'StarLadder StarSeries',
      target: 'StarLadder StarSeries',
      keep_as_is: true,
      category: 'event'
    },
    {
      term: 'StarLadder',
      target: 'StarLadder',
      keep_as_is: true,
      category: 'event'
    },
    {
      term: 'Aurora',
      target: 'Aurora',
      keep_as_is: true,
      category: 'team'
    },
    {
      term: 'Grand Final',
      target: '总决赛',
      keep_as_is: false,
      category: 'stage'
    },
    {
      term: 'Fall',
      target: '秋季',
      keep_as_is: false,
      category: 'season'
    },
    {
      term: 'Summer',
      target: '夏季',
      keep_as_is: false,
      category: 'season'
    },
    {
      term: 'Spring',
      target: '春季',
      keep_as_is: false,
      category: 'season'
    },
    {
      term: 'Winter',
      target: '冬季',
      keep_as_is: false,
      category: 'season'
    }
  ]
};

type ProviderHandler = (
  request: ProviderRequest
) => ProviderResult | Promise<ProviderResult>;

function createMockProvider(handler: ProviderHandler): {
  provider: TranslationProvider;
  requests: ProviderRequest[];
} {
  const requests: ProviderRequest[] = [];
  const provider: TranslationProvider = {
    translate(request) {
      requests.push(request);
      return Promise.resolve(handler(request));
    }
  };

  return { provider, requests };
}

function createMemoryCache(
  initial: Map<string, string> = new Map<string, string>()
): CacheStore {
  const values = new Map(initial);
  return {
    async get(key) {
      return values.get(key);
    },
    async set(key, value) {
      values.set(key, value);
    }
  };
}

function createService(
  provider: TranslationProvider,
  cacheStore: CacheStore = createMemoryCache()
) {
  return createTranslationService({ glossary, provider, cacheStore });
}

function openAIConfig(
  transport: ChatCompletionsTransport,
  timeoutMs = 50
) {
  return {
    baseURL: 'https://provider.invalid/v1',
    model: 'mock-model',
    apiKey: '',
    timeoutMs,
    transport
  };
}

function responseWithPayload(payload: unknown, status = 200) {
  return {
    status,
    async json() {
      return payload;
    }
  };
}

test('parseGlossaryJson rejects contradictory keep-as-is entries without throwing', () => {
  const result = parseGlossaryJson(
    JSON.stringify({
      version: 1,
      entries: [
        {
          term: 'Brand',
          target: '品牌',
          keep_as_is: true
        },
        {
          term: 'Valid',
          target: '有效',
          keep_as_is: false
        }
      ]
    })
  );

  assert.equal(result.glossary.entries.length, 1);
  assert.equal(result.glossary.entries[0]?.term, 'Valid');
  assert.equal(
    result.diagnostics.some(
      (diagnostic) => diagnostic.code === 'keep-as-is-target-mismatch'
    ),
    true
  );
});

test('parseGlossaryJson reports invalid JSON instead of throwing', () => {
  const result = parseGlossaryJson('{');

  assert.equal(result.glossary.entries.length, 0);
  assert.equal(result.diagnostics[0]?.code, 'invalid-json');
});

test('glossary matching is longest-first, token-aware, and preserves source spelling', () => {
  const matches = findKeepAsIsMatches(
    'starladder starseries and StarLadderX',
    glossary
  );

  assert.deepEqual(
    matches.map((match) => match.matchedText),
    ['starladder starseries']
  );
  assert.equal(matches[0]?.entry.term, 'StarLadder StarSeries');
});

test('isEntirelyKeepAsIs computes complete coverage for full, partial, and non-keep text', () => {
  assert.equal(isEntirelyKeepAsIs('StarLadder StarSeries', glossary), true);
  assert.equal(isEntirelyKeepAsIs('StarLadder StarSeries Fall', glossary), false);
  assert.equal(isEntirelyKeepAsIs('Grand Final', glossary), false);
});

test('lookupEntries filters by category and keeps the longest match', () => {
  const eventEntries = lookupEntries('StarLadder StarSeries', glossary, {
    category: 'event'
  });
  const seasonEntries = lookupEntries('Fall 2026', glossary, {
    category: 'season'
  });

  assert.deepEqual(
    eventEntries.map((entry) => [entry.entry.term, entry.matchedText]),
    [['StarLadder StarSeries', 'StarLadder StarSeries']]
  );
  assert.deepEqual(
    seasonEntries.map((entry) => [entry.entry.term, entry.matchedText]),
    [['Fall', 'Fall']]
  );
});

test('classifyText protects deterministic values, Chinese, and keep-as-is names', () => {
  assert.equal(classifyText('12345', glossary).kind, 'pure-number');
  assert.equal(classifyText('2026-09-20', glossary).kind, 'pure-date');
  assert.equal(classifyText('🔥?!', glossary).kind, 'pure-symbol');
  assert.equal(classifyText('这是中文句子', glossary).kind, 'target-language');
  assert.equal(classifyText('Aurora', glossary).kind, 'keep-as-is');
  assert.equal(classifyText('This is a clear English sentence', glossary).kind, 'translatable');
  assert.equal(
    classifyText('这是一句中文 with English', glossary).shouldTranslate,
    false
  );
});

test('real short comment samples use the conservative uncertain path', () => {
  const samples = [
    'Congratulations mouz',
    'Thank you <3',
    'bot [emoji]',
    'lol 4',
    'aurora will 2-0 mouz in semis #jimisrevenge #jimfapisback',
    'ez for aurora 3-1, we are looking so good right now mashallah',
    'Ez 4 GOON BOSS CEM FUAT',
    '1v9?? gl'
  ];

  for (const sample of samples) {
    const decision = classifyText(sample, glossary);
    assert.equal(decision.kind, 'uncertain', sample);
    assert.equal(decision.shouldTranslate, false, sample);
    assert.equal(decision.reviewRequired, true, sample);
  }
});

test('keep-as-is term is returned verbatim without calling the provider', async () => {
  const { provider, requests } = createMockProvider(async () => ({
    ok: true,
    translations: ['不应调用']
  }));
  const service = createService(provider);

  const result = await service.translateEventNames(['StarLadder StarSeries']);

  assert.deepEqual(result, ['StarLadder StarSeries']);
  assert.equal(requests.length, 0);
});

test('identical concurrent text requests call the provider once', async () => {
  const { provider, requests } = createMockProvider(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    return { ok: true, translations: ['这是翻译结果'] };
  });
  const service = createService(provider);
  const source = 'This is a full English sentence';

  const [first, second] = await Promise.all([
    service.translate([source]),
    service.translate([source])
  ]);

  assert.deepEqual(first, ['这是翻译结果']);
  assert.deepEqual(second, ['这是翻译结果']);
  assert.equal(requests.length, 1);
});

test('cache hit returns the cached value without calling the provider', async () => {
  const source = 'This is a full English sentence';
  const cache = createMemoryCache(new Map([[hashText(source), '缓存译文']]));
  const { provider, requests } = createMockProvider(async () => ({
    ok: true,
    translations: ['不应调用']
  }));
  const service = createService(provider, cache);

  const result = await service.translate([source]);

  assert.deepEqual(result, ['缓存译文']);
  assert.equal(requests.length, 0);
});

test('provider timeout returns the original text', async () => {
  const transport: ChatCompletionsTransport = {
    send: async () => new Promise<never>(() => undefined)
  };
  const provider = createOpenAICompatibleProvider(openAIConfig(transport, 5));
  const service = createService(provider);
  const source = 'This is a full English sentence';

  assert.deepEqual(await service.translate([source]), [source]);
});

test('provider transport error returns the original text', async () => {
  const transport: ChatCompletionsTransport = {
    send: async () => {
      throw new Error('network failure');
    }
  };
  const provider = createOpenAICompatibleProvider(openAIConfig(transport));
  const service = createService(provider);
  const source = 'This is a full English sentence';

  assert.deepEqual(await service.translate([source]), [source]);
});

test('provider HTTP error returns the original text', async () => {
  const transport: ChatCompletionsTransport = {
    send: async () => responseWithPayload({}, 503)
  };
  const provider = createOpenAICompatibleProvider(openAIConfig(transport));
  const service = createService(provider);
  const source = 'This is a full English sentence';

  assert.deepEqual(await service.translate([source]), [source]);
});

test('provider invalid response format returns the original text', async () => {
  const transport: ChatCompletionsTransport = {
    send: async () =>
      responseWithPayload({
        choices: [{ message: { content: 'not a JSON array' } }]
      })
  };
  const provider = createOpenAICompatibleProvider(openAIConfig(transport));
  const service = createService(provider);
  const source = 'This is a full English sentence';

  assert.deepEqual(await service.translate([source]), [source]);
});

test('OpenAI-compatible provider lists protected fragments in its prompt', async () => {
  const requests: ChatCompletionsTransportRequest[] = [];
  const transport: ChatCompletionsTransport = {
    async send(request) {
      requests.push(request);
      return responseWithPayload({
        choices: [{ message: { content: JSON.stringify(['译文']) } }]
      });
    }
  };
  const provider = createOpenAICompatibleProvider(openAIConfig(transport));

  const result = await provider.translate({
    texts: ['StarLadder StarSeries Fall 2026'],
    protectedFragments: [['StarLadder StarSeries']],
    purposes: ['event-name']
  });

  assert.deepEqual(result, { ok: true, translations: ['译文'] });
  assert.equal(requests.length, 1);
  assert.match(requests[0]?.body ?? '', /StarLadder StarSeries/);
});

test('protected fragment validation failure falls back to the original event name', async () => {
  const { provider } = createMockProvider(async () => ({
    ok: true,
    translations: ['2026 秋季赛']
  }));
  const service = createService(provider);
  const source = 'StarLadder StarSeries Fall 2026';

  assert.deepEqual(await service.translateEventNames([source]), [source]);
});

test('plain mode accepts a reasonable synonym instead of requiring the glossary target', async () => {
  const { provider } = createMockProvider(async () => ({
    ok: true,
    translations: ['他们输掉了决赛']
  }));
  const service = createService(provider);
  const source = 'They lost the Grand Final';

  assert.deepEqual(await service.translate([source]), ['他们输掉了决赛']);
});

test('event-name mode rejects a translation missing a glossary target', async () => {
  const { provider } = createMockProvider(async () => ({
    ok: true,
    translations: ['StarLadder StarSeries 2026']
  }));
  const service = createService(provider);
  const source = 'StarLadder StarSeries Fall 2026';

  assert.deepEqual(await service.translateEventNames([source]), [source]);
});

test('event-name season validation accepts reordered year and season tokens', () => {
  const result = validateTranslation(
    'StarLadder StarSeries Fall 2026',
    'StarLadder StarSeries 2026 秋季赛',
    ['StarLadder StarSeries'],
    'event-name',
    glossary
  );

  assert.deepEqual(result, { ok: true });
});

test('event-name season validation rejects a missing season target', () => {
  const result = validateTranslation(
    'StarLadder StarSeries Fall 2026',
    'StarLadder StarSeries 2026',
    ['StarLadder StarSeries'],
    'event-name',
    glossary
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, 'glossary-target-missing');
  }
});

test('unlisted season words do not create a false glossary-target failure', () => {
  const result = validateTranslation(
    'StarLadder StarSeries Monsoon 2026',
    'StarLadder StarSeries 2026 季赛',
    ['StarLadder StarSeries'],
    'event-name',
    glossary
  );

  assert.deepEqual(result, { ok: true });
});

test('structure-mismatch is reserved for protected-fragment order changes', () => {
  const protectedOrderResult = validateTranslation(
    'BrandOne BrandTwo',
    'BrandTwo BrandOne',
    ['BrandOne', 'BrandTwo'],
    'plain',
    glossary
  );
  const reorderedSeasonResult = validateTranslation(
    'Fall 2026',
    '2026 秋季',
    [],
    'event-name',
    glossary
  );

  assert.equal(protectedOrderResult.ok, false);
  if (!protectedOrderResult.ok) {
    assert.equal(protectedOrderResult.code, 'structure-mismatch');
  }
  assert.deepEqual(reorderedSeasonResult, { ok: true });
});

test('protected deterministic values and Chinese text never call the provider', async () => {
  const { provider, requests } = createMockProvider(async () => ({
    ok: true,
    translations: ['不应调用', '不应调用', '不应调用', '不应调用']
  }));
  const service = createService(provider);

  const input = ['12345', '2026-09-20', '?!🔥', '这是中文句子'];
  assert.deepEqual(await service.translate(input), input);
  assert.equal(requests.length, 0);
});

test('team names, player IDs, and ambiguous labels follow the conservative path', async () => {
  const { provider, requests } = createMockProvider(async () => ({
    ok: true,
    translations: ['不应调用']
  }));
  const service = createService(provider);

  const input = ['Aurora', 'kyxsan', 'BO3'];
  assert.deepEqual(await service.translate(input), input);
  assert.equal(requests.length, 0);
});
