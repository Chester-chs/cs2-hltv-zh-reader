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

import { classifyText, createOpenAICompatibleProvider, createTranslationService, findKeepAsIsMatches, hashText, isEntirelyKeepAsIs, lookupEntries, parseGlossaryJson, translateFixedUiTexts, translateGlossaryCoveredText, validateTranslation, type CacheStore, type ChatCompletionsTransport, type ChatCompletionsTransportRequest, type GlossaryDocument, type ProviderRequest, type ProviderResult, type TranslationContext, type TranslationProvider } from '../src/core/translate/index.ts';

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
      term: 'Playoffs',
      target: '季后赛',
      keep_as_is: false,
      category: 'stage'
    },
    {
      term: 'Semifinal',
      target: '半决赛',
      keep_as_is: false,
      category: 'stage'
    },
    {
      term: 'Quarterfinal',
      target: '四分之一决赛',
      keep_as_is: false,
      category: 'stage'
    },
    {
      term: 'Group Stage',
      target: '小组赛',
      keep_as_is: false,
      category: 'stage'
    },
    {
      term: 'bo3',
      target: 'bo3',
      keep_as_is: true,
      category: 'format'
    },
    {
      term: 'bo5',
      target: 'bo5',
      keep_as_is: true,
      category: 'format'
    },
    {
      term: 'Live',
      target: '直播',
      keep_as_is: false,
      category: 'status'
    },
    {
      term: 'IEM Katowice',
      target: 'IEM Katowice',
      keep_as_is: true,
      category: 'event'
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

async function loadProductionGlossary(): Promise<GlossaryDocument> {
  const fsPromisesModuleName = 'node:fs/promises';
  const { readFile } = (await import(fsPromisesModuleName)) as {
    readFile(path: URL, encoding: 'utf8'): Promise<string>;
  };
  const loaded = parseGlossaryJson(
    await readFile(new URL('../glossary.json', import.meta.url), 'utf8')
  );
  assert.deepEqual(loaded.diagnostics, []);
  return loaded.glossary;
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

test('structured context classifies short English page labels as translatable', () => {
  const samples = [
    'Grand Final',
    'Playoffs',
    'Semifinal',
    'Quarterfinal',
    'Live',
    'Group Stage',
    'IEM Katowice 2026',
    'StarLadder StarSeries Fall 2026',
    'Stake Pulse Beat II',
    'Upper Bracket Final'
  ];

  for (const sample of samples) {
    const decision = classifyText(sample, glossary, 'structured');
    assert.equal(decision.shouldTranslate, true, sample);
    assert.equal(decision.kind, 'translatable', sample);
  }
});

test('dictionary purpose sends a short selected word to the provider and bypasses glossary labels', async () => {
  const { provider, requests } = createMockProvider(async (request) => ({
    ok: true,
    translations: request.texts.map(() => '动词：让……坐替补席；形容词：被安排替补')
  }));
  const service = createService(provider);

  const result = await service.translateDictionary?.(['Live']);

  assert.deepEqual(result, ['动词：让……坐替补席；形容词：被安排替补']);
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0]?.texts, ['Live']);
  assert.deepEqual(requests[0]?.purposes, ['dictionary']);
});

test('prose uses a medium threshold while comments keep the conservative default', () => {
  assert.equal(classifyText('Thank you', glossary, 'prose').shouldTranslate, true);
  assert.equal(classifyText('Thank you', glossary, 'comment').shouldTranslate, false);
  assert.deepEqual(
    classifyText('Thank you', glossary),
    classifyText('Thank you', glossary, 'comment')
  );

  for (const sample of ['lol 4', 'bot ☠', '1v9?? gl', 'Thank you <3']) {
    const decision = classifyText(sample, glossary, 'comment');
    assert.equal(decision.shouldTranslate, false, sample);
  }
});

test('pure numbers, dates, symbols, and Chinese stay untranslated in every context', () => {
  const contexts: TranslationContext[] = ['structured', 'prose', 'comment'];
  const protectedValues = [
    '12345',
    '2026-09-20',
    'September 20, 2026',
    '20 September 2026',
    'Sep 2026',
    '🔥?!',
    '这是中文句子',
    '中文 text'
  ];

  for (const context of contexts) {
    for (const sample of protectedValues) {
      assert.equal(
        classifyText(sample, glossary, context).shouldTranslate,
        false,
        `${context}: ${sample}`
      );
    }
  }

  assert.equal(
    classifyText('Aurora', { version: 1, entries: [] }, 'structured')
      .shouldTranslate,
    true,
    'the display strategy, not the language classifier, excludes team names'
  );
});

test('real page glossary values translate deterministically without classification or provider calls', async () => {
  const productionGlossary = await loadProductionGlossary();
  const { provider, requests } = createMockProvider(async () => ({
    ok: true,
    translations: []
  }));
  const uncertain: string[] = [];
  const service = createTranslationService({
    glossary: productionGlossary,
    provider,
    cacheStore: createMemoryCache(),
    context: 'structured',
    onUncertainClassification(record) {
      uncertain.push(record.text);
    }
  });
  const input = [
    'Grand Final',
    'Playoffs',
    'Semifinal',
    'Quarterfinal',
    'bo3',
    'bo5',
    'Live',
    'Group Stage',
    'IEM Katowice 2026',
    'StarLadder StarSeries Fall 2026'
  ];

  assert.deepEqual(await service.translate(input), [
    '总决赛',
    '季后赛',
    '半决赛',
    '四分之一决赛',
    'bo3',
    'bo5',
    '直播',
    '小组赛',
    'IEM Katowice 2026',
    'StarLadder StarSeries 秋季 2026'
  ]);
  assert.deepEqual(requests, []);
  assert.deepEqual(uncertain, []);
});

test('observed static HLTV interface labels translate from the production glossary without a provider', async () => {
  const productionGlossary = await loadProductionGlossary();
  const { provider, requests } = createMockProvider(async () => ({
    ok: true,
    translations: []
  }));
  const service = createTranslationService({
    glossary: productionGlossary,
    provider,
    cacheStore: createMemoryCache(),
    context: 'structured'
  });
  const input = [
    'News',
    'Matches',
    'Results',
    'Events',
    'Players',
    'Stats',
    'Forum',
    'Media',
    'Betting',
    'Live',
    'Fantasy',
    'Major',
    'Live Counter-Strike matches',
    'Upcoming Counter-Strike matches',
    'Match filters',
    'Starred matches only',
    'Ranked',
    'Unranked',
    'Win %',
    'Pick %',
    'Ban %',
    'Lineups',
    'Matches, past 3 months',
    'Head to head',
    'VRS forecast',
    'Ongoing events',
    'Upcoming events',
    'Regional rankings',
    'KAST',
    'Player of the week',
    'Opening duels won',
    'Sign in',
    'MINIGAME',
    'Play',
    'Complete ranking',
    'Event calendar',
    'Counter-Strike Players',
    'FILTERS',
    'Stars',
    'Time',
    'Match type',
    'Map',
    'Event',
    'Valve ranked',
    'Fantasy Fall season 2026',
    'Partner Games',
    'PRIZES',
    'ABOUT FALL SEASON 2026',
    'POINTS SYSTEM',
    'Fullscreen',
    'Theater',
    'RANKING',
    'FPL RANKING',
    'GALLERIES',
    'RECENT ACTIVITY',
    'TOP 30 TRANSFERS',
    'Download the HLTV app',
    'HLTV Community t-shirt and sweatshirt available now',
    'Optimized to keep you up to date on the go',
    '18+ Bet Responsibly'
  ];

  assert.deepEqual(await service.translate(input), [
    '新闻',
    '比赛',
    '赛果',
    '赛事',
    '选手',
    '数据',
    '论坛',
    '媒体',
    '竞猜',
    '直播',
    '梦幻电竞',
    'Major 赛事',
    '正在进行的 Counter-Strike 比赛',
    '即将开始的 Counter-Strike 比赛',
    '比赛筛选',
    '仅显示已收藏的比赛',
    '有排名',
    '无排名',
    '胜率',
    '选图率',
    '禁用率',
    '阵容',
    '近 3 个月的比赛',
    '历史交锋',
    'VRS 预测',
    '进行中赛事',
    '即将开始赛事',
    '地区排名',
    'KAST',
    '本周最佳选手',
    '首杀对决胜率',
    '登录',
    '小游戏',
    '开始',
    '查看完整排名',
    '赛事日历',
    'Counter-Strike 选手',
    '筛选',
    '星级',
    '时间',
    '比赛类型',
    '地图',
    '赛事',
    'Valve 排名',
    '梦幻电竞 2026 秋季赛',
    '合作游戏',
    '奖励',
    '关于 2026 秋季赛',
    '积分规则',
    '全屏',
    '影院模式',
    '排名',
    'FPL 排名',
    '图库',
    '最新动态',
    '近期前30转会',
    '下载 HLTV 应用',
    'HLTV 社区 T 恤和卫衣现已发售',
    '随时掌握最新动态',
    '18+ 理性投注'
  ]);
  assert.deepEqual(requests, []);
});

test('event-name validation ignores UI terms but still requires season terminology', async () => {
  const productionGlossary = await loadProductionGlossary();
  const result = validateTranslation(
    'Stake Ranked Fall 2026',
    'Stake Ranked 秋季 2026',
    [],
    'event-name',
    productionGlossary
  );

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(
    validateTranslation(
      'Stake Ranked Fall 2026',
      'Stake Ranked 2026',
      [],
      'event-name',
      productionGlossary
    ),
    {
      ok: false,
      code: 'glossary-target-missing',
      message: 'Glossary target is missing: 秋季'
    }
  );
});

test('event-name translations do not use UI-only glossary shortcuts', async () => {
  const productionGlossary = await loadProductionGlossary();
  const { provider, requests } = createMockProvider((request) => ({
    ok: true,
    translations: request.texts.map(() => '排位赛')
  }));
  const service = createTranslationService({
    glossary: productionGlossary,
    provider,
    cacheStore: createMemoryCache(),
    context: 'structured'
  });

  assert.deepEqual(await service.translateEventNames(['Ranked']), ['排位赛']);
  assert.deepEqual(requests.map((request) => request.texts), [['Ranked']]);
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
  const cache = createMemoryCache(new Map([[`v2:plain:${hashText(source)}`, '缓存译文']]));
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

test('provider body parsing is covered by the provider timeout', async () => {
  const transport: ChatCompletionsTransport = {
    send: async () => ({
      status: 200,
      json: () => new Promise<never>(() => undefined)
    })
  };
  const provider = createOpenAICompatibleProvider(openAIConfig(transport, 5));
  const service = createService(provider);
  const source = 'This is a full English sentence with a response body';

  const result = await Promise.race([
    service.translate([source]),
    new Promise<string[]>((resolve) => setTimeout(() => resolve(['timed out']), 50))
  ]);
  assert.deepEqual(result, [source]);
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
        choices: [{
          message: {
            content: [
              String.fromCharCode(96).repeat(3) + 'json',
              JSON.stringify({ translations: ['译文'] }),
              String.fromCharCode(96).repeat(3)
            ].join('\n')
          }
        }]
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
  assert.equal(requests[0]?.url, 'https://provider.invalid/v1/chat/completions');
  const body = JSON.parse(requests[0]?.body ?? '{}') as {
    temperature: number;
    response_format?: { type: string };
    messages: Array<{ role: string; content: string }>;
  };
  assert.equal(body.temperature, 0.2);
  assert.deepEqual(body.response_format, { type: 'json_object' });
  assert.match(body.messages[0]?.content ?? '', /简体中文/);
  const userInput = JSON.parse(body.messages[1]?.content ?? '{}') as {
    items: Array<{
      index: number;
      purpose: string;
      text: string;
      protected_fragments: string[];
    }>;
  };
  assert.deepEqual(userInput.items[0], {
    index: 1,
    purpose: 'event-name',
    text: 'StarLadder StarSeries Fall 2026',
    protected_fragments: ['StarLadder StarSeries']
  });
});

test('repeated protected fragments keep their original order', () => {
  assert.deepEqual(
    validateTranslation(
      'HLTV spoke with Valve about HLTV rankings',
      'HLTV 与 Valve 讨论了 HLTV 排名',
      ['HLTV', 'Valve', 'HLTV'],
      'plain',
      glossary
    ),
    { ok: true }
  );
});

test('blank provider translations are rejected and never cached', async () => {
  const writes: string[] = [];
  const { provider } = createMockProvider(async () => ({
    ok: true,
    translations: ['   ']
  }));
  const service = createService(provider, {
    async get() { return undefined; },
    async set(_key, value) { writes.push(value); }
  });

  const source = 'This is a full English sentence';
  assert.deepEqual(await service.translate([source]), [source]);
  assert.deepEqual(writes, []);
});

test('hash collisions do not reuse another source translation', async () => {
  const { provider, requests } = createMockProvider(async (request) => ({
    ok: true,
    translations: request.texts.map((text) => `译文:${text}`)
  }));
  const service = createTranslationService({
    glossary,
    provider,
    cacheStore: createMemoryCache(),
    hash: () => 'collision'
  });

  const first = 'This is a full English sentence one';
  const second = 'This is a full English sentence two';
  assert.deepEqual(await service.translate([first]), [`译文:${first}`]);
  assert.deepEqual(await service.translate([second]), [`译文:${second}`]);
  assert.equal(requests.length, 2);
});

test('translation cache namespaces isolate provider models', async () => {
  const cache = createMemoryCache();
  const first = createTranslationService({
    glossary,
    provider: createMockProvider(async () => ({ ok: true, translations: ['模型一'] })).provider,
    cacheStore: cache,
    cacheNamespace: 'model-one'
  });
  const second = createTranslationService({
    glossary,
    provider: createMockProvider(async () => ({ ok: true, translations: ['模型二'] })).provider,
    cacheStore: cache,
    cacheNamespace: 'model-two'
  });
  const source = 'This is a full English sentence for model isolation';

  assert.deepEqual(await first.translate([source]), ['模型一']);
  assert.deepEqual(await second.translate([source]), ['模型二']);
});

test('diacritic player names are treated as identity text', () => {
  const decision = classifyText('Buğra Arkın', glossary, 'prose');
  assert.equal(decision.shouldTranslate, false);
  assert.equal(decision.kind, 'uncertain');
});

test('provider adds v1 after a host or custom path prefix without duplicating it', async () => {
  const urls: string[] = [];
  const transport: ChatCompletionsTransport = {
    async send(request) {
      urls.push(request.url);
      return responseWithPayload({
        choices: [{ message: { content: JSON.stringify({ translations: ['译文'] }) } }]
      });
    }
  };
  const request: ProviderRequest = {
    texts: ['This is a full English sentence'],
    protectedFragments: [[]],
    purposes: ['plain']
  };
  const cases: Array<[string, string]> = [
    ['https://provider.invalid', 'https://provider.invalid/v1/chat/completions'],
    ['https://gateway.invalid/openai/', 'https://gateway.invalid/openai/v1/chat/completions'],
    ['https://gateway.invalid/openai/v1/', 'https://gateway.invalid/openai/v1/chat/completions']
  ];

  for (const [baseURL] of cases) {
    await createOpenAICompatibleProvider({
      ...openAIConfig(transport),
      baseURL
    }).translate(request);
  }

  assert.deepEqual(urls, cases.map(([, expectedURL]) => expectedURL));
});

test('provider config can disable response_format and override temperature', async () => {
  let sentBody: Record<string, unknown> | undefined;
  const transport: ChatCompletionsTransport = {
    async send(request) {
      sentBody = JSON.parse(request.body) as Record<string, unknown>;
      return responseWithPayload({
        choices: [{ message: { content: JSON.stringify({ translations: ['译文'] }) } }]
      });
    }
  };
  const provider = createOpenAICompatibleProvider({
    ...openAIConfig(transport),
    useJsonOutputMode: false,
    temperature: 0.1
  });

  await provider.translate({
    texts: ['This is a full English sentence'],
    protectedFragments: [[]],
    purposes: ['plain']
  });

  assert.equal(sentBody?.temperature, 0.1);
  assert.equal(Object.hasOwn(sentBody ?? {}, 'response_format'), false);
  const messages = sentBody?.messages as Array<{ role: string; content: string }>;
  assert.match(messages[0]?.content ?? '', /合法 JSON/);
});

test('provider reports response_format rejection without retrying or exposing body text', async () => {
  let attempts = 0;
  const transport: ChatCompletionsTransport = {
    async send() {
      attempts += 1;
      return responseWithPayload({
        error: { message: 'response_format rejected with private detail' }
      }, 400);
    }
  };
  const provider = createOpenAICompatibleProvider(openAIConfig(transport));

  const result = await provider.translate({
    texts: ['This is a full English sentence'],
    protectedFragments: [[]],
    purposes: ['plain']
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.status, 400);
    assert.match(result.error.message, /response_format/);
    assert.equal(result.error.message.includes('private detail'), false);
  }
  assert.equal(attempts, 1);
});

test('protected fragment validation failure falls back to the original event name', async () => {
  const { provider } = createMockProvider(async () => ({
    ok: true,
    translations: ['2026 秋季赛']
  }));
  const service = createService(provider);
  const source = 'StarLadder StarSeries Fall 2026 championship event';

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
  const source = 'StarLadder StarSeries Fall 2026 championship event';

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

test('one translation call batches every distinct uncached translatable text', async () => {
  const input = [
    'This is the first full English sentence for batching',
    'This is another full English sentence for batching',
    'This third English sentence contains enough words'
  ];
  const { provider, requests } = createMockProvider(async (request) => ({
    ok: true,
    translations: request.texts.map((_, index) => `译文 ${index + 1}`)
  }));
  const service = createService(provider);

  const result = await service.translate(input);

  assert.deepEqual(result, ['译文 1', '译文 2', '译文 3']);
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0]?.texts, input);
});

test('cache hits are returned without entering the provider batch', async () => {
  const cachedText = 'This full English sentence already has a cached result';
  const uncachedText = 'This other full English sentence needs translation';
  const cache = createMemoryCache(new Map([
    [`v2:plain:${hashText(cachedText)}`, '缓存译文']
  ]));
  const { provider, requests } = createMockProvider(async (request) => ({
    ok: true,
    translations: request.texts.map(() => '新译文')
  }));
  const service = createService(provider, cache);

  const result = await service.translate([cachedText, uncachedText]);

  assert.deepEqual(result, ['缓存译文', '新译文']);
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0]?.texts, [uncachedText]);
});

test('one event validation failure preserves valid translations in the same batch', async () => {
  const validText = 'StarLadder StarSeries Fall championship event';
  const invalidText = 'StarLadder StarSeries Summer championship event';
  const validTranslation = '秋季赛事 StarLadder StarSeries';
  const { provider, requests } = createMockProvider(async (request) => ({
    ok: true,
    translations: request.texts.map((text) =>
      text === validText ? validTranslation : '夏季赛事'
    )
  }));
  const service = createService(provider);

  const result = await service.translateEventNames([validText, invalidText]);

  assert.deepEqual(result, [validTranslation, invalidText]);
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0]?.texts, [validText, invalidText]);
});

test('overlapping concurrent batches share in-flight translations', async () => {
  const sharedText = 'This full English sentence appears in concurrent batches';
  const secondText = 'Another complete English sentence joins the first batch';
  let releaseProvider: (() => void) | undefined;
  let markProviderStarted: (() => void) | undefined;
  const providerStarted = new Promise<void>((resolve) => {
    markProviderStarted = resolve;
  });
  const providerGate = new Promise<void>((resolve) => {
    releaseProvider = resolve;
  });
  const { provider, requests } = createMockProvider(async (request) => {
    markProviderStarted?.();
    await providerGate;
    return { ok: true, translations: request.texts.map(() => '译文') };
  });
  const service = createService(provider);

  const firstCall = service.translate([sharedText, secondText]);
  await providerStarted;
  const secondCall = service.translate([sharedText]);
  releaseProvider?.();
  const [first, second] = await Promise.all([firstCall, secondCall]);

  assert.deepEqual(first, ['译文', '译文']);
  assert.deepEqual(second, ['译文']);
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0]?.texts, [sharedText, secondText]);
});

test('legacy text-only cache entries are orphaned and purpose caches stay separate', async () => {
  const source = 'StarLadder StarSeries Fall championship event';
  const legacyKey = hashText(source);
  const legacyValue = 'old cached plain result';
  const values = new Map([[legacyKey, legacyValue]]);
  const writes: string[] = [];
  const cache: CacheStore = {
    async get(key) {
      return values.get(key);
    },
    async set(key, value) {
      writes.push(key);
      values.set(key, value);
    }
  };
  const { provider, requests } = createMockProvider(async (request) => ({
    ok: true,
    translations: request.purposes.map((purpose) =>
      purpose === 'plain'
        ? 'Plain event result StarLadder StarSeries'
        : '秋季赛事 StarLadder StarSeries'
    )
  }));
  const service = createService(provider, cache);

  const result = await service.translateEventNames([source]);

  assert.deepEqual(result, ['秋季赛事 StarLadder StarSeries']);
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0]?.purposes, ['event-name']);
  assert.equal(values.get(legacyKey), legacyValue);
  assert.deepEqual(writes, [`v3:default:event-name:${encodeURIComponent(source)}`]);
});

test('statistics units translate after an identity without changing that identity or leaking scoped terms', async () => {
  const production = await loadProductionGlossary();
  assert.deepEqual(translateFixedUiTexts([
    'Nikola Kovač • 29 years', '2334 maps', '24 rounds', 'NiKo', 'NiKo maps',
    'GOOD', 'KAST', 'Unsupported English label'
  ], production, ['ui', 'ui-stats']), [
    'Nikola Kovač • 29 岁', '2334 地图', '24 回合', 'NiKo', 'NiKo maps',
    '优秀', '回合贡献率', 'Unsupported English label'
  ]);
  assert.deepEqual(translateFixedUiTexts(['GOOD', 'Firepower'], production), ['GOOD', 'Firepower']);
  assert.equal(translateGlossaryCoveredText('GOOD', production, 'plain'), undefined);
  assert.deepEqual(validateTranslation('Good Fall 2026', 'Good 2026 秋季', [], 'event-name', production), { ok: true });
});

test('full statistics table labels and observed filters translate completely from scoped glossary entries', async () => {
  const production = await loadProductionGlossary();
  const labels: Array<[string, string]> = [
    ["Statistics","数据统计"],
    ["Total kills","总击杀数"],
    ["Headshot %","爆头率"],
    ["Total deaths","总死亡数"],
    ["K/D Ratio","击杀/死亡比"],
    ["Damage / Round","每回合平均伤害"],
    ["Grenade dmg / Round","每回合投掷物伤害"],
    ["Maps played","已打地图数"],
    ["Rounds played","已打回合数"],
    ["Kills / round","每回合击杀数"],
    ["Assists / round","每回合助攻数"],
    ["Deaths / round","每回合死亡数"],
    ["Saved by teammate / round","每回合被队友救下次数"],
    ["Saved teammates / round","每回合救下队友次数"],
    ["Impact rating","影响力评分"],
    ["Featured ratings","对阵强队评分"],
    ["Eco-adjust stats","按经济差异调整数据"],
    ["Avg.","平均"],
    ["Deaths per round","每回合死亡数"],
    ["Kills per round","每回合击杀数"],
    ["Teammates","队友"],
    ["Form in filter","筛选范围内状态"],
    ["Maps in filter","筛选范围内地图数"],
    ["Maps","地图"],
    ["Majors","官方大赛"],
    ["Big events","大型赛事"],
    ["MVP events","设有最佳选手奖的赛事"],
    ["LAN","线下赛事"],
    ["Online","线上赛事"],
    ["Last month","最近一个月"],
    ["Last 3 months","最近 3 个月"],
    ["Last 6 months","最近 6 个月"],
    ["Last 12 months","最近 12 个月"],
    ["Top 5","前 5 名"],
    ["Top 10","前 10 名"],
    ["Top 20","前 20 名"],
    ["Top 30","前 30 名"],
    ["Top 50","前 50 名"],
    ["Event type","赛事类型"],
    ["Best Of X","比赛赛制"],
    ["Best of 1","一局定胜负"],
    ["Best of 3","三局两胜"],
    ["Best of 5","五局三胜"],
    ["Grand final","总决赛"],
    ["Playoffs","淘汰赛"],
    ["Pre-playoff","淘汰赛前阶段"],
    ["vs top 5 opponents","对阵前 5 名对手"],
    ["vs top 10 opponents","对阵前 10 名对手"],
    ["vs top 20 opponents","对阵前 20 名对手"],
    ["vs top 30 opponents","对阵前 30 名对手"],
    ["vs top 50 opponents","对阵前 50 名对手"],
    ["Sides","阵营"],
    ["CT","防守方"],
    ["T","进攻方"],
    ["全部 Sides","双方"],
    ["CT 阵营","防守方"],
    ["T 阵营","进攻方"],
    ["Data from 2016 and onward only, be wary of your sample size.","数据仅包含 2016 年及之后的比赛，请注意样本量。"],
    ["How many times a teammate killed the attacker that was damaging this player within 1 second of the last attack. Data from 2016 and onward only, be wary of your sample size.","队友在最后一次攻击后 1 秒内，击杀正在伤害该选手的敌人的次数。数据仅包含 2016 年及之后的比赛，请注意样本量。"],
    ["How many times this player killed an opponent who was attacking a teammate, within 1 second of the last attack. Data from 2016 and onward only, be wary of your sample size.","该选手在最后一次攻击后 1 秒内，击杀正在攻击队友的敌人的次数。数据仅包含 2016 年及之后的比赛，请注意样本量。"],
    ["Measures the impact made from multikills, opening kills, and clutches.","衡量多杀、首杀和残局带来的影响。"],
    ["Search the stats section for teams, players and events, from here you can easily add them to your context.","搜索战队、选手和赛事，将它们加入当前统计范围。"]
  ];
  assert.deepEqual(
    translateFixedUiTexts(labels.map(([source]) => source), production, ['ui', 'ui-stats']),
    labels.map(([, translated]) => translated)
  );
  const untouched = ['donk', 'NiKo', 'FaZe', 'CT Player', 'T Player', '10292', '61.1%', '1.38', '2026-09-30', 'Unsupported English label'];
  assert.deepEqual(translateFixedUiTexts(untouched, production, ['ui', 'ui-stats']), untouched);
  assert.deepEqual(translateFixedUiTexts(['Statistics', 'CT', 'T', 'Total kills'], production), ['Statistics', 'CT', 'T', 'Total kills']);
  assert.equal(translateGlossaryCoveredText('Impact rating', production, 'plain'), undefined);
  assert.deepEqual(validateTranslation('Good Fall 2026', 'Good 2026 秋季', [], 'event-name', production), { ok: true });
});

test('navigation terminology is scoped to menus and excluded from provider glossary enforcement', async () => {
  const production = await loadProductionGlossary();
  assert.deepEqual(translateFixedUiTexts(['Retired Players', 'Archive', 'Counter-Strike', 'All', 'Maps'], production, ['ui', 'ui-navigation']),
    ['退役选手', '历史赛事', '反恐精英', '全部', '地图']);
  assert.deepEqual(translateFixedUiTexts(['Retired Players', 'Archive', 'Counter-Strike', 'All', 'Maps'], production),
    ['Retired Players', 'Archive', 'Counter-Strike', 'All', 'Maps']);
  for (const purpose of ['plain', 'event-name'] as const) {
    assert.equal(translateGlossaryCoveredText('Retired Players', production, purpose), undefined);
    assert.deepEqual(validateTranslation('Archive Fall 2026', 'Archive 2026 秋季', [], purpose, production), { ok: true });
  }
});

test('observed transfer streaming and privacy labels translate locally while stream identities and values remain original', async () => {
  const production = await loadProductionGlossary();
  const labels: Array<[string, string]> = [
    ["All transfers","查看全部转会"],
    ["Now playing","正在直播"],
    ["Top streams","热门直播"],
    ["Casters","解说"],
    ["Streamers","主播"],
    ["Organizers","赛事主办方"],
    ["viewers","观众"],
    ["Update privacy preferences","更新隐私偏好"],
    ["Timeline","时间线"],
    ["Start date","开始日期"],
    ["End date","结束日期"],
    ["Add to context..","添加战队、选手或赛事"],
    ["BENCH","替补席"],
    ["No team","暂无战队"],
    ["TOP 30 TRANSFERS","近期前30转会"]
  ];
  assert.deepEqual(
    translateFixedUiTexts(labels.map(([source]) => source), production),
    labels.map(([, translated]) => translated)
  );
  assert.deepEqual(translateFixedUiTexts(['1500 viewers', 'PlayerOne • 1500 viewers', 'PlayerOne viewers', 'Nuke', 'CS2'], production), [
    '1500 观众', 'PlayerOne • 1500 观众', 'PlayerOne viewers', 'Nuke', 'CS2'
  ]);
});
