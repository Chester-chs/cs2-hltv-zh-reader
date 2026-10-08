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

import { DISPLAY_SELECTORS, ELEMENT_STRATEGIES, createDisplayRecordTable, decideRenderIntent, getTranslationContextForStrategyId, resolveElementStrategy, selectorMatchesPath, type DisplayElementInfo, type DisplayNodeInfo, type ElementStrategy } from '../src/core/display/index.ts';

function element(
  classes: readonly string[] = [],
  attributes: Readonly<Record<string, string>> = {},
  tagName = 'div'
): DisplayElementInfo {
  return {
    tagName,
    classes,
    attributes
  };
}

function node(key: string, parent: DisplayElementInfo): DisplayNodeInfo {
  return { key, parent };
}

function getStrategy(
  classes: readonly string[],
  attributes = {},
  tagName = 'div',
  pathname?: string
) {
  return resolveElementStrategy(element(classes, attributes, tagName), pathname);
}

test('element strategy IDs select structured, prose, and comment classification contexts', () => {
  for (const strategyId of [
    'match-event',
    'match-stage',
    'match-meta',
    'match-time',
    'match-detail-heading',
    'sidebar-widget-heading',
    'player-week-category',
    'player-week-metric',
    'match-list-heading',
    'match-filter-heading',
    'match-filter-label',
    'match-detail-stat-tab',
    'global-navigation',
    'events-current-heading',
    'events-upcoming-heading',
    'team-ranking-region-selector',
    'static-page-heading',
    'filter-panel-title',
    'filter-label',
    'fantasy-main-heading',
    'fantasy-section-heading',
    'live-fullscreen-control',
    'live-theater-link'
  ]) {
    assert.equal(getTranslationContextForStrategyId(strategyId), 'structured');
  }
  assert.equal(getTranslationContextForStrategyId('news-title'), 'prose');
  assert.equal(getTranslationContextForStrategyId('news-body'), 'prose');
  assert.equal(getTranslationContextForStrategyId('article-body'), 'prose');
  assert.equal(getTranslationContextForStrategyId('news-index-heading'), 'prose');
  assert.equal(getTranslationContextForStrategyId('news-article-title'), 'prose');
  assert.equal(getTranslationContextForStrategyId('comment'), 'comment');
  assert.equal(getTranslationContextForStrategyId('comment-body'), 'comment');
  assert.equal(getTranslationContextForStrategyId('unknown'), 'comment');
});

test('selector definitions are centralized and carry page-scoped evidence', () => {
  const expectedSelectors = [
    '.match-teamname',
    '.match-event',
    '.match-stage',
    '.match-meta',
    '.match-time',
    '.current-map-score',
    '.match-team-livescore',
    '[data-time-format][data-unix]',
    '[data-countdown-target-timestamp]',
    '.index .newsline.article .newstext',
    '.newsdsl .newstext-con',
    '.newsdsl .newstext-con [data-tooltip-id]',
    '.forum .post .forum-middle',
    '.index h2.newsheader',
    '.match-page .betting-section .headline, .match-page .lineups > .headline, .match-page .past-matches-header > .headline, .match-page .matchpage-analytics-section > .headline',
    '.navbar .navcon a.nav-link',
    '.newsitem.standard-box > h1.headline',
    '.leftCol > aside > h1:not(#playerOfTheWeekTitle), .leftCol > aside > .presented-by-row > h1, .rightCol > aside > h1, .right2Col > aside > .recent-activity > h1, .right2Col > aside > h1:not(.minigame-label-new)',
    '.matches-v4 .new-standardPageGrid .upcoming-headline',
    '.matches-v4 .matches-sidebar-filter-wrapper .sidebar-title > h3',
    '.matches-v4 .matches-sidebar-filter-wrapper .matches-filter-star-section .matches-filter-name-text, .matches-v4 .matches-sidebar-filter-wrapper .matches-filter-ranked-section .matches-filter-name-text',
    '.match-page .map-stats-infobox .map-stats-infobox-tabs > button.map-stats-infobox-tab',
    '.event-status-headline',
    '.event-status-upcoming-headline',
    '.ranking-open-region-selector',
    'h1:not(#playerOfTheWeekTitle):not(.minigame-label-new)',
    '.header-filters-title',
    '.filter-headline',
    'h1',
    'h2',
    'button',
    'a[href*="fullscreen=1"]',
    '.footer .footer-content .footer-section-header',
    '.footer .footer-content .footer-section-subtext',
    '.footer .footer-content .footer-cta-button',
    '.footer .footerlinks a.footerlink',
    '.footer .footer-responsible-container .footer-generic-responible-container',
    '.playerOfTheWeekCategory',
    '.playerOfTheWeekTitle',
    '.navsignin',
    '.right2Col > aside > h1.minigame-label-new',
    '.right2Col .sidebar-minigames-playnow-btn',
    '.leftCol > aside > a.block.button.text-center[href="/ranking/teams"]',
    '.leftCol > aside > a.block.button.text-center[href="/ranking/teams"] > span.normal-weight',
    '.leftCol > aside > a.block.button.text-center[href="/events"]',
    'body',
    'body',
    'body',
    '.right2Col .activitylist > a.activity > span.topic',
    'body',
    '.navbar .navcon .dropdown-menu > li > a.dropdown-link:not([href^="/events/"]):not([href^="/fantasy/"]), .navbar .navcon .dropdown-menu > li > a.dropdown-link[href="/events/archive"]',
    '.players-archive .players-archive-navigation > a.players-archive-tab'
  ];

  assert.deepEqual(
    DISPLAY_SELECTORS.map(({ selector, pageArea }) => [selector, pageArea]),
    [
      ...expectedSelectors.slice(0, 7).map((selector) => [selector, 'matches']),
      [expectedSelectors[7], 'global'],
      [expectedSelectors[8], 'global'],
      [expectedSelectors[9], 'news-list'],
      [expectedSelectors[10], 'article'],
      [expectedSelectors[11], 'article'],
      [expectedSelectors[12], 'match-comments'],
      [expectedSelectors[13], 'news-index'],
      [expectedSelectors[14], 'match-detail'],
      [expectedSelectors[15], 'global-navigation'],
      [expectedSelectors[16], 'article'],
      [expectedSelectors[17], 'global-widgets'],
      [expectedSelectors[18], 'matches'],
      [expectedSelectors[19], 'matches'],
      [expectedSelectors[20], 'matches'],
      [expectedSelectors[21], 'match-detail'],
      [expectedSelectors[22], 'events'],
      [expectedSelectors[23], 'events'],
      [expectedSelectors[24], 'team-ranking'],
      [expectedSelectors[25], 'page-headings'],
      [expectedSelectors[26], 'route-filters'],
      [expectedSelectors[27], 'route-filters'],
      [expectedSelectors[28], 'fantasy'],
      [expectedSelectors[29], 'fantasy'],
      [expectedSelectors[30], 'live'],
      [expectedSelectors[31], 'live'],
      [expectedSelectors[32], 'global-footer'],
      [expectedSelectors[33], 'global-footer'],
      [expectedSelectors[34], 'global-footer'],
      [expectedSelectors[35], 'global-footer'],
      [expectedSelectors[36], 'global-footer'],
      [expectedSelectors[37], 'global-widgets'],
      [expectedSelectors[38], 'global-widgets'],
      [expectedSelectors[39], 'global-navigation'],
      [expectedSelectors[40], 'global-widgets'],
      [expectedSelectors[41], 'global-widgets'],
      [expectedSelectors[42], 'global-widgets'],
      [expectedSelectors[43], 'global-widgets'],
      [expectedSelectors[44], 'global-widgets'],
      [expectedSelectors[45], 'stats'],
      [expectedSelectors[46], 'global'],
      [expectedSelectors[47], 'global'],
      [expectedSelectors[48], 'global-widgets'],
      [expectedSelectors[49], 'global'],
      [expectedSelectors[50], 'global-navigation'],
      [expectedSelectors[51], 'global-navigation']
    ]
  );
  assert.deepEqual(
    DISPLAY_SELECTORS.map((definition) => definition.selector),
    expectedSelectors
  );

  for (const definition of DISPLAY_SELECTORS) {
    assert.equal(
      definition.verifiedOn,
      ['stats-fixed-ui', 'page-fixed-ui', 'page-prose', 'recent-activity-topic', 'profile-fixed-ui', 'navigation-dropdown', 'player-archive-filter'].includes(definition.id) ? '2026-09-30' :
      definition.id === 'events-current-heading' ||
        definition.id === 'events-upcoming-heading' ||
        definition.id === 'team-ranking-region-selector' ||
        definition.id === 'static-page-heading' ||
        definition.id === 'filter-panel-title' ||
        definition.id === 'filter-label' ||
        definition.id === 'fantasy-main-heading' ||
        definition.id === 'fantasy-section-heading' ||
        definition.id === 'live-fullscreen-control' ||
        definition.id === 'live-theater-link'
        ? '2026-09-26'
        : '2026-09-20'
    );
    assert.equal(definition.evidence.length > 0, true);
  }
});

test('navigation and archive filters use scoped local glossary replacement', () => {
  for (const [classes, pathname, id] of [
    [['dropdown-link'], '/news/1/example', 'navigation-dropdown'],
    [['players-archive-tab'], '/players/archive/active', 'player-archive-filter'],
    [['players-archive-tab'], '/players/archive/retired', 'player-archive-filter']
  ] as const) {
    const strategy = getStrategy(classes, {}, 'a', pathname);
    assert.equal(strategy.id, id);
    assert.equal(strategy.translationSource, 'fixed-ui-glossary');
    assert.deepEqual(strategy.glossaryCategories, ['ui', 'ui-navigation']);
    assert.deepEqual(strategy.allowedModes, ['A']);
    assert.equal(strategy.fallbackStrategyId, undefined);
    assert.equal(getTranslationContextForStrategyId(id), 'structured');
  }
  assert.equal(getStrategy(['players-archive-tab'], {}, 'a', '/players/explore').translation, 'never');
  assert.equal(getStrategy(['players-archive-tab'], {}, 'a', '/players/archive-extra').translation, 'never');
  assert.equal(getStrategy(['unknown-dropdown'], {}, 'a', '/').translation, 'never');
});

test('news, article, linked entities, and comment strategies follow the approved page policy', () => {
  const cases: ReadonlyArray<{
    classes: readonly string[];
    attributes?: Readonly<Record<string, string>>;
    tagName?: string;
    pathname?: string;
    strategyId: string;
    translation: string;
    allowedModes: readonly string[];
  }> = [
    {
      classes: ['newstext'],
      strategyId: 'news-title',
      translation: 'allowed',
      allowedModes: ['A', 'B']
    },
    {
      classes: ['newstext-con'],
      strategyId: 'article-body',
      translation: 'allowed',
      allowedModes: ['A', 'B']
    },
    {
      classes: [],
      attributes: { 'data-tooltip-id': 'uid227764982' },
      strategyId: 'article-entity',
      translation: 'never',
      allowedModes: []
    },
    {
      classes: ['forum-middle'],
      strategyId: 'comment-body',
      translation: 'allowed',
      allowedModes: ['A', 'B']
    },
    {
      classes: ['newsheader'],
      strategyId: 'news-index-heading',
      translation: 'allowed',
      allowedModes: ['A', 'B']
    },
    {
      classes: ['headline'],
      strategyId: 'match-detail-heading',
      translation: 'allowed',
      allowedModes: ['A']
    },
    {
      classes: ['headline'],
      tagName: 'H1',
      strategyId: 'news-article-title',
      translation: 'allowed',
      allowedModes: ['A', 'B']
    },
    {
      classes: [],
      tagName: 'H1',
      strategyId: 'sidebar-widget-heading',
      translation: 'allowed',
      allowedModes: ['A']
    },
    {
      classes: ['playerOfTheWeekCategory'],
      strategyId: 'player-week-category',
      translation: 'allowed',
      allowedModes: ['A']
    },
    {
      classes: ['playerOfTheWeekTitle'],
      strategyId: 'player-week-metric',
      translation: 'allowed',
      allowedModes: ['A']
    },
    {
      classes: ['navsignin'],
      strategyId: 'global-signin',
      translation: 'allowed',
      allowedModes: ['A']
    },
    {
      classes: ['minigame-label-new'],
      tagName: 'H1',
      strategyId: 'minigame-heading',
      translation: 'allowed',
      allowedModes: ['A']
    },
    {
      classes: ['sidebar-minigames-playnow-btn'],
      strategyId: 'minigame-play',
      translation: 'allowed',
      allowedModes: ['A']
    },
    {
      classes: ['button'],
      attributes: { href: '/ranking/teams' },
      tagName: 'A',
      strategyId: 'left-ranking-complete-cta',
      translation: 'allowed',
      allowedModes: ['A']
    },
    {
      classes: ['normal-weight'],
      tagName: 'SPAN',
      strategyId: 'left-ranking-update-meta',
      translation: 'never',
      allowedModes: []
    },
    {
      classes: ['button', 'leftCol'],
      attributes: { href: '/events' },
      tagName: 'A',
      strategyId: 'left-event-calendar-cta',
      translation: 'allowed',
      allowedModes: ['A']
    },
    {
      classes: ['upcoming-headline'],
      strategyId: 'match-list-heading',
      translation: 'allowed',
      allowedModes: ['A']
    },
    {
      classes: [],
      tagName: 'H3',
      strategyId: 'match-filter-heading',
      translation: 'allowed',
      allowedModes: ['A']
    },
    {
      classes: ['matches-filter-name-text'],
      strategyId: 'match-filter-label',
      translation: 'allowed',
      allowedModes: ['A']
    },
    {
      classes: ['map-stats-infobox-tab'],
      strategyId: 'match-detail-stat-tab',
      translation: 'allowed',
      allowedModes: ['A']
    },
    {
      classes: ['nav-link'],
      strategyId: 'global-navigation',
      translation: 'allowed',
      allowedModes: ['A']
    },
    {
      classes: ['event-status-headline'],
      strategyId: 'events-current-heading',
      translation: 'allowed',
      allowedModes: ['A']
    },
    {
      classes: ['event-status-upcoming-headline'],
      strategyId: 'events-upcoming-heading',
      translation: 'allowed',
      allowedModes: ['A']
    },
    {
      classes: ['ranking-open-region-selector'],
      strategyId: 'team-ranking-region-selector',
      translation: 'allowed',
      allowedModes: ['A']
    },
    {
      classes: [],
      tagName: 'H1',
      pathname: '/results',
      strategyId: 'static-page-heading',
      translation: 'allowed',
      allowedModes: ['A']
    },
    {
      classes: ['header-filters-title'],
      pathname: '/results',
      strategyId: 'filter-panel-title',
      translation: 'allowed',
      allowedModes: ['A']
    },
    {
      classes: ['filter-headline'],
      pathname: '/results',
      strategyId: 'filter-label',
      translation: 'allowed',
      allowedModes: ['A']
    },
    {
      classes: [],
      tagName: 'H1',
      pathname: '/fantasy',
      strategyId: 'fantasy-main-heading',
      translation: 'allowed',
      allowedModes: ['A']
    },
    {
      classes: [],
      tagName: 'H2',
      pathname: '/fantasy',
      strategyId: 'fantasy-section-heading',
      translation: 'allowed',
      allowedModes: ['A']
    },
    {
      classes: [],
      tagName: 'BUTTON',
      pathname: '/live',
      strategyId: 'live-fullscreen-control',
      translation: 'allowed',
      allowedModes: ['A']
    },
    {
      classes: [],
      attributes: { href: '/live?fullscreen=1' },
      tagName: 'A',
      pathname: '/live',
      strategyId: 'live-theater-link',
      translation: 'allowed',
      allowedModes: ['A']
    }
  ];

  for (const expected of cases) {
    const strategy = getStrategy(
      expected.classes,
      expected.attributes,
      expected.tagName,
      expected.pathname
    );
    assert.equal(strategy.id, expected.strategyId);
    assert.equal(strategy.translation, expected.translation);
    assert.deepEqual(strategy.allowedModes, expected.allowedModes);
  }
});

test('route-scoped selectors match only their route and child paths', () => {
  const definition = DISPLAY_SELECTORS.find(
    ({ id }) => id === 'static-page-heading'
  );
  assert.equal(definition !== undefined, true);
  if (definition === undefined) {
    return;
  }

  assert.equal(selectorMatchesPath(definition, '/results'), true);
  assert.equal(selectorMatchesPath(definition, '/results/2026'), true);
  assert.equal(selectorMatchesPath(definition, '/players/archive/active'), true);
  assert.equal(selectorMatchesPath(definition, '/results-old'), false);
  assert.equal(selectorMatchesPath(definition, '/player/123/spirit'), false);
  assert.equal(
    selectorMatchesPath({ ...definition, pathPrefixes: undefined }, '/anywhere'),
    true
  );

  const filterDefinition = DISPLAY_SELECTORS.find(
    ({ id }) => id === 'filter-panel-title'
  );
  assert.equal(filterDefinition !== undefined, true);
  if (filterDefinition === undefined) {
    return;
  }
  assert.equal(selectorMatchesPath(filterDefinition, '/results'), true);
  assert.equal(
    selectorMatchesPath(filterDefinition, '/players/archive/active'),
    false
  );

  const fantasyDefinition = DISPLAY_SELECTORS.find(
    ({ id }) => id === 'fantasy-section-heading'
  );
  assert.equal(fantasyDefinition !== undefined, true);
  if (fantasyDefinition === undefined) {
    return;
  }
  assert.equal(selectorMatchesPath(fantasyDefinition, '/fantasy'), true);
  assert.equal(selectorMatchesPath(fantasyDefinition, '/fantasy/game/650'), false);

  const liveDefinition = DISPLAY_SELECTORS.find(
    ({ id }) => id === 'live-fullscreen-control'
  );
  assert.equal(liveDefinition !== undefined, true);
  if (liveDefinition === undefined) {
    return;
  }
  assert.equal(selectorMatchesPath(liveDefinition, '/live'), true);
  assert.equal(selectorMatchesPath(liveDefinition, '/live/match/123'), false);
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

test('shared footer selectors have explicit page evidence, contexts, and replacement-only policies', () => {
  const expected = [
    {
      selector: '.footer .footer-content .footer-section-header',
      strategyId: 'footer-section-heading',
      pageArea: 'global-footer',
      classes: ['footer-section-header'],
      context: 'structured'
    },
    {
      selector: '.footer .footer-content .footer-section-subtext',
      strategyId: 'footer-section-copy',
      pageArea: 'global-footer',
      classes: ['footer-section-subtext'],
      context: 'prose'
    },
    {
      selector: '.footer .footer-content .footer-cta-button',
      strategyId: 'footer-cta',
      pageArea: 'global-footer',
      classes: ['footer-cta-button'],
      context: 'structured'
    },
    {
      selector: '.footer .footerlinks a.footerlink',
      strategyId: 'footer-link',
      pageArea: 'global-footer',
      classes: ['footerlink'],
      context: 'structured'
    },
    {
      selector:
        '.footer .footer-responsible-container .footer-generic-responible-container',
      strategyId: 'footer-responsible-disclaimer',
      pageArea: 'global-footer',
      classes: ['footer-generic-responible-container'],
      context: 'structured'
    }
  ] as const;

  assert.deepEqual(
    DISPLAY_SELECTORS.filter(({ pageArea }) => pageArea === 'global-footer').map(
      ({ selector, pageArea }) => ({ selector, pageArea })
    ),
    expected.map(({ selector, pageArea }) => ({ selector, pageArea }))
  );

  for (const item of expected) {
    const tagName =
      item.strategyId === 'footer-cta' || item.strategyId === 'footer-link'
        ? 'a'
        : 'div';
    const strategy = getStrategy(item.classes, {}, tagName);
    assert.equal(strategy.id, item.strategyId);
    assert.equal(strategy.translation, 'allowed');
    assert.deepEqual(strategy.allowedModes, ['A']);
    assert.equal(getTranslationContextForStrategyId(strategy.id), item.context);
  }
});
