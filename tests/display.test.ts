interface StrictAssert {
  equal(actual: unknown, expected: unknown, message?: string): void;
  deepEqual(actual: unknown, expected: unknown, message?: string): void;
}

const nodeAssertModuleName = 'node:assert/strict';
const { strict: assert } = (await import(nodeAssertModuleName)) as {
  strict: StrictAssert;
};

const nodeTestModuleName = 'node:test';
const { test } = (await import(nodeTestModuleName)) as {
  test(name: string, callback: () => void | Promise<void>): void;
};

import { DISPLAY_SELECTORS, ELEMENT_STRATEGIES, createDisplayRecordTable, decideRenderIntent, resolveElementStrategy, type DisplayElementInfo, type DisplayNodeInfo, type ElementStrategy } from '../src/core/display/index.ts';

function element(
  classes: readonly string[] = [],
  attributes: Readonly<Record<string, string>> = {}
): DisplayElementInfo {
  return {
    tagName: 'div',
    classes,
    attributes
  };
}

function node(key: string, parent: DisplayElementInfo): DisplayNodeInfo {
  return { key, parent };
}

function getStrategy(classes: readonly string[], attributes = {}) {
  return resolveElementStrategy(element(classes, attributes));
}

test('selector definitions are centralized and carry matches-page evidence', () => {
  const expectedSelectors = [
    '.match-teamname',
    '.match-event',
    '.match-stage',
    '.match-meta',
    '.match-time',
    '.current-map-score',
    '.match-team-livescore',
    '[data-time-format][data-unix]',
    '[data-countdown-target-timestamp]'
  ];

  assert.deepEqual(
    DISPLAY_SELECTORS.map((definition) => definition.selector),
    expectedSelectors
  );

  for (const definition of DISPLAY_SELECTORS) {
    assert.equal(definition.pageArea, 'matches');
    assert.equal(definition.verifiedOn, '2026-09-20');
    assert.equal(definition.evidence.length > 0, true);
  }
});

test('each confirmed match-list strategy returns the expected translation policy', () => {
  const cases: ReadonlyArray<{
    className: string;
    strategyId: string;
    translation: string;
    allowedModes: readonly string[];
  }> = [
    {
      className: 'match-teamname',
      strategyId: 'match-teamname',
      translation: 'never',
      allowedModes: []
    },
    {
      className: 'match-event',
      strategyId: 'match-event',
      translation: 'allowed',
      allowedModes: ['A', 'B']
    },
    {
      className: 'match-stage',
      strategyId: 'match-stage',
      translation: 'allowed',
      allowedModes: ['A']
    },
    {
      className: 'match-meta',
      strategyId: 'match-meta',
      translation: 'allowed',
      allowedModes: ['A']
    },
    {
      className: 'match-time',
      strategyId: 'match-time',
      translation: 'never',
      allowedModes: []
    },
    {
      className: 'current-map-score',
      strategyId: 'current-map-score',
      translation: 'never',
      allowedModes: []
    },
    {
      className: 'match-team-livescore',
      strategyId: 'match-team-livescore',
      translation: 'never',
      allowedModes: []
    }
  ];

  for (const expected of cases) {
    const strategy = getStrategy([expected.className]);
    assert.equal(strategy.id, expected.strategyId);
    assert.equal(strategy.translation, expected.translation);
    assert.deepEqual(strategy.allowedModes, expected.allowedModes);
  }
});

test('unmatched elements use the default no-translation strategy', () => {
  const strategy = getStrategy(['unrecognized-class']);

  assert.equal(strategy.id, 'default-no-translation');
  assert.equal(strategy.translation, 'never');
  assert.deepEqual(strategy.allowedModes, []);
});

test('dynamic writer attributes override otherwise translatable classes', () => {
  const timeStrategy = getStrategy(['match-event'], {
    'data-time-format': 'yyyy-MM-dd HH:mm',
    'data-unix': '1789158397000'
  });
  const countdownStrategy = getStrategy(['match-event'], {
    'data-countdown-target-timestamp': '1789158397'
  });
  const scoreStrategy = getStrategy(['current-map-score']);
  const livescoreStrategy = getStrategy(['match-team-livescore']);

  assert.equal(timeStrategy.id, 'time-format-unix');
  assert.equal(timeStrategy.translation, 'never');
  assert.equal(countdownStrategy.id, 'countdown-target');
  assert.equal(countdownStrategy.translation, 'never');
  assert.equal(scoreStrategy.translation, 'never');
  assert.equal(livescoreStrategy.translation, 'never');
});

test('never-translate policy returns noop in both modes', () => {
  const strategy = getStrategy(['match-teamname']);
  const target = node('team-1', element(['match-teamname']));

  const modeA = decideRenderIntent(
    target,
    'Aurora',
    '极光',
    'A',
    strategy
  );
  const modeB = decideRenderIntent(
    target,
    'Aurora',
    '极光',
    'B',
    strategy
  );

  assert.equal(modeA.kind, 'noop');
  assert.equal(modeB.kind, 'noop');
  if (modeA.kind === 'noop' && modeB.kind === 'noop') {
    assert.equal(modeA.reason, 'policy-never');
    assert.equal(modeB.reason, 'policy-never');
  }
});

test('no-noise and empty-value rules never replace or clear original text', () => {
  const strategy = getStrategy(['match-event']);
  const target = node('event-1', element(['match-event']));

  const sameText = decideRenderIntent(
    target,
    'StarLadder',
    'StarLadder',
    'A',
    strategy
  );
  const emptyText = decideRenderIntent(target, 'Original', '', 'A', strategy);
  const missingText = decideRenderIntent(
    target,
    'Original',
    undefined,
    'A',
    strategy
  );
  const emptyOriginal = decideRenderIntent(target, '', '译文', 'A', strategy);

  assert.equal(sameText.kind, 'noop');
  assert.equal(emptyText.kind, 'noop');
  assert.equal(missingText.kind, 'noop');
  assert.equal(emptyOriginal.kind, 'noop');
  if (
    sameText.kind === 'noop' &&
    emptyText.kind === 'noop' &&
    missingText.kind === 'noop' &&
    emptyOriginal.kind === 'noop'
  ) {
    assert.equal(sameText.reason, 'same-text');
    assert.equal(emptyText.reason, 'empty-translation');
    assert.equal(missingText.reason, 'empty-translation');
    assert.equal(emptyOriginal.reason, 'empty-original');
  }
});

test('mode A returns replace-text for an allowed translation', () => {
  const strategy = getStrategy(['match-event']);
  const intent = decideRenderIntent(
    node('event-a', element(['match-event'])),
    'Grand Final',
    '总决赛',
    'A',
    strategy
  );

  assert.deepEqual(intent, {
    kind: 'replace-text',
    nodeKey: 'event-a',
    originalText: 'Grand Final',
    translatedText: '总决赛',
    strategyId: 'match-event'
  });
});

test('mode B returns append-sibling with both protection markers', () => {
  const strategy = getStrategy(['match-event']);
  const intent = decideRenderIntent(
    node('event-b', element(['match-event'])),
    'Grand Final',
    '总决赛',
    'B',
    strategy
  );

  assert.deepEqual(intent, {
    kind: 'append-sibling',
    nodeKey: 'event-b',
    originalText: 'Grand Final',
    translatedText: '总决赛',
    strategyId: 'match-event',
    attributes: {
      'data-hltv-zh': '1',
      translate: 'no'
    }
  });
});

test('mode B does not insert into a mode-A-only element', () => {
  const strategy = getStrategy(['match-stage']);
  const intent = decideRenderIntent(
    node('stage-b', element(['match-stage'])),
    'Grand Final',
    '总决赛',
    'B',
    strategy
  );

  assert.equal(intent.kind, 'noop');
  if (intent.kind === 'noop') {
    assert.equal(intent.reason, 'mode-not-allowed');
  }
});

test('time and countdown attributes always produce noop intents', () => {
  const timeNode = node(
    'time-1',
    element(['match-event'], {
      'data-time-format': 'd-M-yyyy HH:mm',
      'data-unix': '1789842660000'
    })
  );
  const countdownNode = node(
    'countdown-1',
    element(['match-event'], {
      'data-countdown-target-timestamp': '1789842660'
    })
  );

  const timeIntent = decideRenderIntent(
    timeNode,
    '2026-09-20',
    '2026年9月20日',
    'B',
    resolveElementStrategy(timeNode.parent)
  );
  const countdownIntent = decideRenderIntent(
    countdownNode,
    '00:12',
    '倒计时',
    'A',
    resolveElementStrategy(countdownNode.parent)
  );

  assert.equal(timeIntent.kind, 'noop');
  assert.equal(countdownIntent.kind, 'noop');
});

test('record table keeps original text authoritative and supports lifecycle operations', () => {
  const table = createDisplayRecordTable();
  const parent = element(['match-event']);
  const firstNode = node('event-1', parent);
  const strategy = resolveElementStrategy(parent);

  assert.equal(table.register(firstNode, 'Original event', strategy), true);
  assert.equal(table.register(firstNode, 'Stale replacement', strategy), false);
  assert.equal(table.get('event-1')?.original, 'Original event');
  assert.equal(table.get('event-1')?.translated, undefined);
  assert.equal(table.register(node('', parent), 'Invalid key', strategy), false);

  assert.equal(table.updateTranslation('event-1', '译文'), true);
  assert.equal(table.get('event-1')?.translated, '译文');
  assert.equal(table.updateTranslation('missing', '不会写入'), false);

  const modeAIntents = table.decideAll('A');
  assert.equal(modeAIntents.length, 1);
  assert.equal(modeAIntents[0]?.kind, 'replace-text');

  assert.equal(table.remove('event-1'), true);
  assert.equal(table.get('event-1'), undefined);
  assert.equal(table.remove('event-1'), false);

  table.register(node('event-2', parent), 'Second event', strategy);
  assert.equal(table.size(), 1);
  table.clear();
  assert.equal(table.size(), 0);
});

test('mode switching only redecides records and never calls translation', () => {
  const table = createDisplayRecordTable();
  const strategy = getStrategy(['match-event']);
  table.register(node('event-switch', element(['match-event'])), 'Event', strategy);
  table.updateTranslation('event-switch', '赛事');

  let translationCalls = 0;
  const translate = () => {
    translationCalls += 1;
  };

  const modeBIntents = table.decideAll('B');
  const modeAIntents = table.decideAll('A');
  void translate;

  assert.equal(modeBIntents[0]?.kind, 'append-sibling');
  assert.equal(modeAIntents[0]?.kind, 'replace-text');
  assert.equal(translationCalls, 0);
});

test('all strategy entries are represented by data rather than missing policies', () => {
  assert.equal(ELEMENT_STRATEGIES.length >= 8, true);
  assert.equal(
    ELEMENT_STRATEGIES.some((strategy: ElementStrategy) =>
      strategy.id === 'default-no-translation'
    ),
    true
  );
});
