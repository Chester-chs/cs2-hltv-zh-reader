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

import {
  createContentRuntime,
  type ContentTranslator
} from '../src/content/runtime.ts';
import { createStubTranslationService } from '../src/content/stub-translator.ts';
import { encodeTranslateResponse } from '../src/background/protocol.ts';
import { createBackgroundTranslationService } from '../src/content/background-translator.ts';
import { applyContentSettingsChanges } from '../src/content/settings-sync.ts';
import { partitionPageRecords } from '../src/content/translation-batches.ts';
import { parseGlossaryJson, type GlossaryDocument, type TranslationContext, type TranslationPurpose } from '../src/core/translate/index.ts';

type FakeNode = FakeElement | FakeText;

class FakeDocument {
  private readonly candidates = new Map<string, FakeElement[]>();
  readonly location: { pathname: string };
  readonly head = new FakeElement(this, 'head');

  constructor(pathname = '/') {
    this.location = { pathname };
  }

  addCandidate(selector: string, element: FakeElement): void {
    const current = this.candidates.get(selector) ?? [];
    current.push(element);
    this.candidates.set(selector, current);
  }

  querySelectorAll(selector: string): FakeElement[] {
    return [...(this.candidates.get(selector) ?? [])];
  }

  createElement(tagName: string): FakeElement {
    return new FakeElement(this, tagName);
  }

  createTextNode(data: string): FakeText {
    return new FakeText(this, data);
  }
}

class FakeText {
  readonly nodeType = 3;
  parentElement: FakeElement | null = null;
  readonly ownerDocument: FakeDocument;
  data: string;

  constructor(ownerDocument: FakeDocument, data: string) {
    this.ownerDocument = ownerDocument;
    this.data = data;
  }

  get nextSibling(): FakeNode | null {
    if (this.parentElement === null) {
      return null;
    }

    const index = this.parentElement.childNodes.indexOf(this);
    return this.parentElement.childNodes[index + 1] ?? null;
  }
}

class FakeElement {
  readonly nodeType = 1;
  readonly tagName: string;
  readonly ownerDocument: FakeDocument;
  readonly childNodes: FakeNode[] = [];
  readonly classes: Set<string>;
  private readonly attributeValues = new Map<string, string>();
  parentElement: FakeElement | null = null;

  readonly classList = {
    contains: (name: string): boolean => this.classes.has(name),
    [Symbol.iterator]: (): Iterator<string> => this.classes.values()
  };

  constructor(ownerDocument: FakeDocument, tagName: string, classes: readonly string[] = []) {
    this.ownerDocument = ownerDocument;
    this.tagName = tagName.toUpperCase();
    this.classes = new Set(classes);
  }

  appendChild<T extends FakeNode>(node: T): T {
    return this.insertBefore(node, null);
  }

  insertBefore<T extends FakeNode>(node: T, reference: FakeNode | null): T {
    if (node.parentElement !== null) {
      node.parentElement.removeChild(node);
    }

    const index = reference === null ? this.childNodes.length : this.childNodes.indexOf(reference);
    this.childNodes.splice(index < 0 ? this.childNodes.length : index, 0, node);
    node.parentElement = this;
    return node;
  }

  removeChild<T extends FakeNode>(node: T): T {
    const index = this.childNodes.indexOf(node);
    if (index >= 0) {
      this.childNodes.splice(index, 1);
      node.parentElement = null;
    }
    return node;
  }

  getAttribute(name: string): string | null {
    return this.attributeValues.get(name) ?? null;
  }

  get attributes(): Array<{ name: string; value: string }> {
    return Array.from(this.attributeValues, ([name, value]) => ({ name, value }));
  }

  setAttribute(name: string, value: string): void {
    this.attributeValues.set(name, value);
  }

  removeAttribute(name: string): void {
    this.attributeValues.delete(name);
  }

  get textContent(): string {
    return this.childNodes
      .map((node) => node instanceof FakeText ? node.data : node.textContent)
      .join('');
  }

  set textContent(_value: string) {
    throw new Error('B2 must not assign container textContent.');
  }

  set innerHTML(_value: string) {
    throw new Error('B2 must not assign container innerHTML.');
  }
}

class FakeObserver {
  observed = false;
  options: MutationObserverInit | undefined;
  disconnectCount = 0;
  private readonly callback: MutationCallback;

  constructor(callback: MutationCallback) {
    this.callback = callback;
  }

  observe(_target: Node, options: MutationObserverInit): void {
    this.observed = true;
    this.options = { ...options, attributeFilter: options.attributeFilter === undefined ? undefined : [...options.attributeFilter] };
  }

  disconnect(): void {
    this.observed = false;
    this.disconnectCount += 1;
  }

  takeRecords(): MutationRecord[] {
    return [];
  }

  emit(records: MutationRecord[]): void {
    if (this.observed) {
      this.callback(records, this as unknown as MutationObserver);
    }
  }
}

class CountingTranslator implements ContentTranslator {
  readonly plainCalls: string[][] = [];
  readonly eventCalls: string[][] = [];
  readonly contextualCalls: Array<{
    texts: string[];
    context: TranslationContext;
    purpose: TranslationPurpose;
  }> = [];

  async translate(texts: string[]): Promise<string[]> {
    this.plainCalls.push([...texts]);
    return texts.map((text) => `【译】${text}`);
  }

  async translateEventNames(texts: string[]): Promise<string[]> {
    this.eventCalls.push([...texts]);
    return texts.map((text) => `【译】${text}`);
  }

  async translateWithContext(
    texts: string[],
    context: TranslationContext,
    purpose: TranslationPurpose
  ): Promise<string[]> {
    this.contextualCalls.push({ texts: [...texts], context, purpose });
    return purpose === 'event-name'
      ? this.translateEventNames(texts)
      : this.translate(texts);
  }
}

function asDocument(document: FakeDocument): Document {
  return document as unknown as Document;
}

function asNode(node: FakeNode): Node {
  return node as unknown as Node;
}

function makeRuntime(
  document: FakeDocument,
  translator: ContentTranslator,
  diagnostics: Array<{ code: string; message: string }>,
  initialMode: 'A' | 'B' = 'A',
  initialEnabled = true
): { runtime: ReturnType<typeof createContentRuntime>; observer: () => FakeObserver } {
  let observer: FakeObserver | undefined;
  const runtime = createContentRuntime({
    document: asDocument(document),
    translator,
    initialMode,
    initialEnabled,
    observerFactory: (callback) => {
      observer = new FakeObserver(callback);
      return observer as unknown as MutationObserver;
    },
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic)
  });

  return {
    runtime,
    observer: () => {
      if (observer === undefined) {
        throw new Error('Observer was not created.');
      }
      return observer;
    }
  };
}

async function flushObserver(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

test('navigation dropdowns translate locally, preserve anchors and badges, and restore originals', async () => {
  const document = new FakeDocument('/players/archive/active');
  const body = new FakeElement(document, 'body');
  document.addCandidate('body', body);
  const labels: Array<[string, string]> = [
    ['All events', '全部赛事'], ['Ongoing', '进行中的'], ['Archive', '历史赛事'],
    ['Calendar', '赛事日历'], ['VRS Invites', '排名积分邀请'], ['Players', '选手'],
    ['Retired Players', '退役选手'], ['Transfers', '转会'], ['MVPs', '最佳选手奖'],
    ['EVPs', '杰出选手奖'], ['Top20', '年度前20选手'], ['Prospects', '潜力新星'],
    ['Player explorer', '选手探索'], ['Hall of Fame', '名人堂'],
    ['Stats overview', '数据概览'], ['Top players', '选手排行'], ['Top teams', '战队排行'],
    ['Maps', '地图'], ['Fantasy Overview', '梦幻电竞概览'], ['Counter-Strike', '反恐精英'],
    ['Fantasy', '梦幻电竞'], ['Betting', '竞猜'], ['Hardware & Tweaks', '硬件与调校'],
    ['Bugs & Suggestions', '问题与建议'], ['HLTV Confirmed', 'HLTV访谈节目'], ['Galleries', '图库'],
    ['Betting US', '美国竞猜'], ['Betting Canada', '加拿大竞猜'], ['Betting UK', '英国竞猜'],
    ['Betting India', '印度竞猜'], ['Betting Brazil', '巴西竞猜'], ['Betting Sweden', '瑞典竞猜'],
    ['Betting Denmark', '丹麦竞猜'], ['Betting Other Locations', '其他地区竞猜'],
    ['Compare odds', '比较赔率'], ['Analytics', '数据分析']
  ];
  const selector = '.navbar .navcon .dropdown-menu > li > a.dropdown-link:not([href^="/events/"]):not([href^="/fantasy/"]), .navbar .navcon .dropdown-menu > li > a.dropdown-link[href="/events/archive"]';
  const links = labels.map(([source], index) => {
    const link = body.appendChild(new FakeElement(document, 'a', ['dropdown-link']));
    link.setAttribute('href', `/destination/${index}`);
    const label = link.appendChild(new FakeElement(document, 'div', ['text-ellipsis']));
    const text = label.appendChild(document.createTextNode(` ${source} `));
    document.addCandidate(selector, link);
    return { link, label, text };
  });
  const badge = links[12]!.link.appendChild(new FakeElement(document, 'span', ['new-box']));
  const badgeText = badge.appendChild(document.createTextNode('New'));
  const other = body.appendChild(document.createTextNode('Archive'));
  const unknown = body.appendChild(document.createTextNode('Unknown option'));
  const event = body.appendChild(new FakeElement(document, 'a', ['dropdown-link']));
  event.setAttribute('href', '/fantasy/659/gameredirect');
  const eventText = event.appendChild(document.createTextNode('Group Stage - ESL Pro League Season 24'));
  const translator = new CountingTranslator();
  const runtime = createContentRuntime({
    document: asDocument(document), translator, fixedUiGlossary: await statsGlossary(),
    observerFactory: callback => new FakeObserver(callback) as unknown as MutationObserver
  });
  await runtime.start();
  assert.deepEqual(links.map(({ text }) => text.data), labels.map(([, chinese]) => ` ${chinese} `));
  assert.equal(badgeText.data, '新');
  assert.equal(links[12]!.link.childNodes[1], badge);
  assert.deepEqual(links.map(({ link }) => link.getAttribute('href')), labels.map((_, i) => `/destination/${i}`));
  assert.equal(other.data, 'Archive');
  assert.equal(unknown.data, 'Unknown option');
  assert.equal(eventText.data, '【译】Group Stage - ESL Pro League Season 24');
  assert.deepEqual(translator.contextualCalls, [{ texts: ['Group Stage - ESL Pro League Season 24'], context: 'prose', purpose: 'plain' }]);
  await runtime.requestScan();
  assert.equal(translator.contextualCalls.length, 1);
  await runtime.setMode('B');
  assert.deepEqual(links.map(({ text }) => text.data), labels.map(([source]) => ` ${source} `));
  assert.equal(badgeText.data, 'New');
  await runtime.setMode('A');
  assert.equal(links[6]!.text.data, ' 退役选手 ');
  const added = body.appendChild(new FakeElement(document, 'a', ['dropdown-link']));
  added.setAttribute('href', '/players/explore');
  const addedText = added.appendChild(document.createTextNode('Player explorer'));
  document.addCandidate(selector, added);
  await runtime.requestScan();
  assert.equal(addedText.data, '选手探索');
  await runtime.setEnabled(false);
  assert.deepEqual(links.map(({ text }) => text.data), labels.map(([source]) => ` ${source} `));
  assert.equal(addedText.data, 'Player explorer');
  assert.equal(badgeText.data, 'New');
  assert.equal(eventText.data, 'Group Stage - ESL Pro League Season 24');
});

test('player archive All filter translates only on archive routes and preserves alphabet links', async () => {
  for (const pathname of ['/players/archive/active', '/players/archive/retired', '/players/explore', '/stats']) {
    const document = new FakeDocument(pathname);
    const link = new FakeElement(document, 'a', ['players-archive-tab']);
    link.setAttribute('href', `${pathname}?filter=all`);
    const text = link.appendChild(document.createTextNode('All'));
    const alphabet = link.appendChild(document.createTextNode(' A B 123 !@#'));
    document.addCandidate('.players-archive .players-archive-navigation > a.players-archive-tab', link);
    const translator = new CountingTranslator();
    const runtime = createContentRuntime({
      document: asDocument(document), translator, fixedUiGlossary: await statsGlossary(),
      observerFactory: callback => new FakeObserver(callback) as unknown as MutationObserver
    });
    await runtime.start();
    assert.equal(text.data, pathname.startsWith('/players/archive/') ? '全部' : 'All');
    assert.equal(alphabet.data, ' A B 123 !@#');
    assert.equal(link.getAttribute('href'), `${pathname}?filter=all`);
    assert.deepEqual(translator.contextualCalls, []);
    await runtime.setEnabled(false);
    assert.equal(text.data, 'All');
  }
});

test('scans match-list candidates and changes only text nodes', async () => {
  const document = new FakeDocument();
  const event = new FakeElement(document, 'div', ['match-event']);
  const eventText = document.createTextNode('StarLadder StarSeries Fall 2026');
  event.appendChild(eventText);
  document.addCandidate('.match-event', event);

  const team = new FakeElement(document, 'div', ['match-teamname']);
  const teamText = document.createTextNode('Aurora');
  team.appendChild(teamText);
  document.addCandidate('.match-teamname', team);

  const linkedStage = new FakeElement(document, 'div', ['match-stage']);
  const linkedLabel = new FakeElement(document, 'a');
  const linkedText = document.createTextNode('Grand Final');
  linkedLabel.appendChild(linkedText);
  linkedStage.appendChild(linkedLabel);
  document.addCandidate('.match-stage', linkedStage);

  const score = new FakeElement(document, 'div', ['current-map-score']);
  const scoreText = document.createTextNode('1');
  score.appendChild(scoreText);
  document.addCandidate('.current-map-score', score);

  const translator = new CountingTranslator();
  const diagnostics: Array<{ code: string; message: string }> = [];
  const { runtime } = makeRuntime(document, translator, diagnostics);

  await runtime.start();

  assert.equal(eventText.data, '【译】StarLadder StarSeries Fall 2026');
  assert.equal(teamText.data, 'Aurora');
  assert.equal(linkedText.data, '【译】Grand Final');
  assert.equal(linkedStage.childNodes[0], linkedLabel);
  assert.equal(scoreText.data, '1');
  assert.equal(translator.eventCalls.length, 1);
  assert.equal(translator.plainCalls.length, 1);
  assert.deepEqual(translator.contextualCalls, [
    {
      texts: ['StarLadder StarSeries Fall 2026'],
      context: 'structured',
      purpose: 'event-name'
    },
    { texts: ['Grand Final'], context: 'structured', purpose: 'plain' }
  ]);
  assert.equal(
    translator.contextualCalls.some((call) => call.texts.includes('Aurora')),
    false,
    'match-teamname is blocked by its never-translate display strategy'
  );
  assert.equal(diagnostics.length, 0);
  assert.equal(runtime.stats().processedNodes, 4);
});

test('translates approved news and article prose while preserving linked entities and conservative comments', async () => {
  const document = new FakeDocument();

  const title = new FakeElement(document, 'div', ['newstext']);
  const titleText = document.createTextNode('Vitality ease past FURIA into StarSeries final');
  title.appendChild(titleText);
  document.addCandidate('.index .newsline.article .newstext', title);

  const articleBody = new FakeElement(document, 'div', ['newstext-con']);
  const beforeEntity = document.createTextNode('The latest iteration saw ');
  const entity = new FakeElement(document, 'a');
  entity.setAttribute('data-tooltip-id', 'uid227764982');
  const entityText = document.createTextNode('Nemiga');
  entity.appendChild(entityText);
  const afterEntity = document.createTextNode(' claim the tournament title.');
  articleBody.appendChild(beforeEntity);
  articleBody.appendChild(entity);
  articleBody.appendChild(afterEntity);
  document.addCandidate('.newsdsl .newstext-con', articleBody);
  document.addCandidate('.newsdsl .newstext-con [data-tooltip-id]', entity);

  const comment = new FakeElement(document, 'div', ['forum-middle']);
  const commentText = document.createTextNode(
    'The teams will play the final match this Sunday.'
  );
  comment.appendChild(commentText);
  document.addCandidate(
    '.forum .post .forum-middle',
    comment
  );

  const translator = new CountingTranslator();
  const diagnostics: Array<{ code: string; message: string }> = [];
  const { runtime } = makeRuntime(document, translator, diagnostics, 'B');

  await runtime.start();

  assert.equal(titleText.data, 'Vitality ease past FURIA into StarSeries final');
  assert.equal(titleText.nextSibling?.nodeType, 1);
  assert.equal(beforeEntity.data, 'The latest iteration saw ');
  assert.equal(beforeEntity.nextSibling?.nodeType, 1);
  assert.equal(entityText.data, 'Nemiga');
  assert.equal(entityText.nextSibling, null);
  assert.equal(afterEntity.data, ' claim the tournament title.');
  assert.equal(afterEntity.nextSibling?.nodeType, 1);
  assert.equal(commentText.data, 'The teams will play the final match this Sunday.');
  assert.equal(commentText.nextSibling?.nodeType, 1);
  assert.deepEqual(translator.contextualCalls, [
    {
      texts: [
        'Vitality ease past FURIA into StarSeries final',
        'The latest iteration saw ',
        ' claim the tournament title.'
      ],
      context: 'prose',
      purpose: 'plain'
    },
    {
      texts: ['The teams will play the final match this Sunday.'],
      context: 'comment',
      purpose: 'plain'
    }
  ]);
  assert.equal(diagnostics.length, 0);
});

test('Chinese mode replaces eligible comments and switching to bilingual reuses their translation', async () => {
  const document = new FakeDocument();
  const comment = new FakeElement(document, 'div', ['forum-middle']);
  const commentText = document.createTextNode(
    'The teams will play the final match this Sunday.'
  );
  comment.appendChild(commentText);
  document.addCandidate(
    '.forum .post .forum-middle',
    comment
  );

  const translator = new CountingTranslator();
  const diagnostics: Array<{ code: string; message: string }> = [];
  const { runtime } = makeRuntime(document, translator, diagnostics, 'A');

  await runtime.start();

  assert.deepEqual(translator.contextualCalls, [{
    texts: ['The teams will play the final match this Sunday.'], context: 'comment', purpose: 'plain'
  }]);
  assert.equal(commentText.data, '【译】The teams will play the final match this Sunday.');
  assert.equal(commentText.nextSibling, null);
  assert.equal(diagnostics.length, 0);

  await runtime.setMode('B');

  assert.deepEqual(translator.contextualCalls, [
    {
      texts: ['The teams will play the final match this Sunday.'],
      context: 'comment',
      purpose: 'plain'
    }
  ]);
  assert.equal(commentText.data, 'The teams will play the final match this Sunday.');
  assert.equal(commentText.nextSibling?.nodeType, 1);
  assert.equal(diagnostics.length, 0);
});

test('translates the three captured home news section headings as prose', async () => {
  const document = new FakeDocument();
  const headings = ["Today's news", "Yesterday's news", 'Previous news'];
  const textNodes = headings.map((text) => {
    const heading = new FakeElement(document, 'h2', ['newsheader']);
    const textNode = document.createTextNode(text);
    heading.appendChild(textNode);
    document.addCandidate('.index h2.newsheader', heading);
    return textNode;
  });

  const translator = new CountingTranslator();
  const diagnostics: Array<{ code: string; message: string }> = [];
  const { runtime } = makeRuntime(document, translator, diagnostics, 'B');

  await runtime.start();

  assert.deepEqual(textNodes.map((textNode) => textNode.data), headings);
  assert.deepEqual(
    textNodes.map((textNode) => textNode.nextSibling?.nodeType),
    [1, 1, 1]
  );
  assert.deepEqual(translator.contextualCalls, [
    { texts: headings, context: 'prose', purpose: 'plain' }
  ]);
  assert.equal(diagnostics.length, 0);
});

test('translates the captured news archive heading through the shared news-index selector', async () => {
  const document = new FakeDocument();
  const heading = new FakeElement(document, 'h2', ['newsheader']);
  const text = document.createTextNode('News from September, 2026');
  heading.appendChild(text);
  document.addCandidate('.index h2.newsheader', heading);

  const translator = new CountingTranslator();
  const diagnostics: Array<{ code: string; message: string }> = [];
  const { runtime } = makeRuntime(document, translator, diagnostics, 'A');

  await runtime.start();

  assert.equal(text.data, '【译】News from September, 2026');
  assert.equal(text.nextSibling, null);
  assert.deepEqual(translator.contextualCalls, [
    { texts: ['News from September, 2026'], context: 'prose', purpose: 'plain' }
  ]);
  assert.equal(diagnostics.length, 0);
});

test('translates the captured news article headline in both display modes', async () => {
  for (const mode of ['A', 'B'] as const) {
    const document = new FakeDocument();
    const headline = new FakeElement(document, 'h1', ['headline']);
    const text = document.createTextNode('$50,000 WINLINE CIS LAN Season 9 announced');
    headline.appendChild(text);
    document.addCandidate('.newsitem.standard-box > h1.headline', headline);

    const translator = new CountingTranslator();
    const diagnostics: Array<{ code: string; message: string }> = [];
    const { runtime } = makeRuntime(document, translator, diagnostics, mode);

    await runtime.start();

    assert.equal(text.data, mode === 'A' ? '【译】$50,000 WINLINE CIS LAN Season 9 announced' : '$50,000 WINLINE CIS LAN Season 9 announced', mode);
    assert.equal(mode === 'A' ? text.nextSibling : text.nextSibling?.nodeType,
      mode === 'A' ? null : 1, mode);
    assert.deepEqual(translator.contextualCalls, [
      {
        texts: ['$50,000 WINLINE CIS LAN Season 9 announced'],
        context: 'prose',
        purpose: 'plain'
      }
    ]);
    assert.equal(diagnostics.length, 0);
  }
});

test('splits linked article prose into small provider batches', async () => {
  const document = new FakeDocument('/news/45679/sashi-sign-chelleos');
  const articleBody = new FakeElement(document, 'div', ['newstext-con']);
  const texts = Array.from({ length: 17 }, (_, index) =>
    articleBody.appendChild(
      document.createTextNode(`The article paragraph ${index} contains readable prose.`)
    )
  );
  document.addCandidate('.newsdsl .newstext-con', articleBody);

  const translator = new CountingTranslator();
  const diagnostics: Array<{ code: string; message: string }> = [];
  const { runtime } = makeRuntime(document, translator, diagnostics, 'A');

  await runtime.start();

  assert.deepEqual(
    translator.contextualCalls.map((call) => call.texts.length),
    [8, 8, 1]
  );
  assert.equal(texts.every((text) => text.data.startsWith('【译】')), true);
  assert.equal(diagnostics.length, 0);
});

test('retranslates page text when the site rewrites an already rendered node', async () => {
  for (const mode of ['A', 'B'] as const) {
    const document = new FakeDocument();
    const headline = new FakeElement(document, 'div', ['match-event']);
    const text = document.createTextNode('First tournament headline');
    headline.appendChild(text);
    document.addCandidate('.match-event', headline);

    const translator = new CountingTranslator();
    const diagnostics: Array<{ code: string; message: string }> = [];
    const { runtime, observer } = makeRuntime(document, translator, diagnostics, mode);
    await runtime.start();

    text.data = 'Updated tournament headline';
    observer().emit([{ type: 'characterData', target: asNode(text) } as MutationRecord]);
    await flushObserver();
    await runtime.requestScan();

    assert.equal(text.data, mode === 'A' ? '【译】Updated tournament headline' : 'Updated tournament headline', mode);
    if (mode === 'B') {
      const sibling = text.nextSibling;
      assert.equal(sibling instanceof FakeElement ? sibling.textContent : undefined, '【译】Updated tournament headline');
    }
    assert.deepEqual(translator.contextualCalls.map((call) => call.texts), [
      ['First tournament headline'],
      ['Updated tournament headline']
    ]);
    assert.equal(diagnostics.some(({ code }) => code === 'original-mismatch'), false);
  }
});

test('mixed-language forum comments stay untouched as one classified unit', async () => {
  const document = new FakeDocument('/forum/123/topic');
  const comment = new FakeElement(document, 'div', ['forum-middle']);
  const english = comment.appendChild(document.createTextNode('This is an English sentence'));
  const chinese = comment.appendChild(new FakeElement(document, 'span'));
  chinese.appendChild(document.createTextNode('这是一段中文'));
  document.addCandidate('.forum .post .forum-middle', comment);

  const translator = new CountingTranslator();
  const diagnostics: Array<{ code: string; message: string }> = [];
  const { runtime } = makeRuntime(document, translator, diagnostics, 'A');
  await runtime.start();

  assert.equal(english.data, 'This is an English sentence');
  assert.equal(translator.contextualCalls.length, 0);
  assert.equal(diagnostics.length, 0);
});

test('translates only the captured static sidebar module headings', async () => {
  const document = new FakeDocument();
  const selector =
    '.leftCol > aside > h1:not(#playerOfTheWeekTitle), .leftCol > aside > .presented-by-row > h1, .rightCol > aside > h1, .right2Col > aside > .recent-activity > h1, .right2Col > aside > h1:not(.minigame-label-new)';
  const headings = [
    'RANKING',
    'EVENTS',
    'FPL RANKING',
    'GALLERIES',
    "TODAY'S MATCHES",
    'RESULTS',
    'RECENT ACTIVITY',
    'TOP 30 TRANSFERS'
  ];
  const nodes = headings.map((label) => {
    const heading = new FakeElement(document, 'h1');
    const text = document.createTextNode(label);
    heading.appendChild(text);
    document.addCandidate(selector, heading);
    return text;
  });

  const translator = new CountingTranslator();
  const diagnostics: Array<{ code: string; message: string }> = [];
  const { runtime } = makeRuntime(document, translator, diagnostics, 'A');

  await runtime.start();

  assert.deepEqual(nodes.map((text) => text.data), headings.map((label) => `【译】${label}`));
  assert.deepEqual(nodes.map((text) => text.nextSibling), headings.map(() => null));
  assert.deepEqual(translator.contextualCalls, [
    { texts: headings, context: 'structured', purpose: 'plain' }
  ]);
  assert.equal(diagnostics.length, 0);
});

test('translates the captured player-of-the-week labels without touching player stats', async () => {
  const document = new FakeDocument();
  const category = new FakeElement(document, 'div', ['playerOfTheWeekCategory']);
  const categoryText = document.createTextNode('Player of the week');
  category.appendChild(categoryText);
  document.addCandidate('.playerOfTheWeekCategory', category);

  const metric = new FakeElement(document, 'h1', ['playerOfTheWeekTitle']);
  const metricText = document.createTextNode('Opening duels won');
  metric.appendChild(metricText);
  document.addCandidate('.playerOfTheWeekTitle', metric);

  const playerName = document.createTextNode('latto');
  const statistic = document.createTextNode('90.9%');
  const translator = new CountingTranslator();
  const diagnostics: Array<{ code: string; message: string }> = [];
  const { runtime } = makeRuntime(document, translator, diagnostics, 'A');

  await runtime.start();

  assert.deepEqual([categoryText.data, metricText.data], [
    '【译】Player of the week',
    '【译】Opening duels won'
  ]);
  assert.deepEqual([playerName.data, statistic.data], ['latto', '90.9%']);
  assert.deepEqual(translator.contextualCalls, [
    {
      texts: ['Player of the week', 'Opening duels won'],
      context: 'structured',
      purpose: 'plain'
    }
  ]);
  assert.equal(diagnostics.length, 0);
});

test('translates captured navigation and sidebar controls while preserving dynamic update dates', async () => {
  const document = new FakeDocument();
  const signIn = new FakeElement(document, 'div', ['navsignin']);
  const signInText = document.createTextNode('Sign in');
  signIn.appendChild(signInText);
  document.addCandidate('.navsignin', signIn);

  const minigameHeading = new FakeElement(document, 'h1', ['minigame-label-new']);
  const minigameText = document.createTextNode('MINIGAME');
  minigameHeading.appendChild(minigameText);
  document.addCandidate('.right2Col > aside > h1.minigame-label-new', minigameHeading);

  const minigamePlay = new FakeElement(document, 'div', ['sidebar-minigames-playnow-btn']);
  const playText = document.createTextNode('Play');
  minigamePlay.appendChild(playText);
  document.addCandidate('.right2Col .sidebar-minigames-playnow-btn', minigamePlay);

  const rankingLink = new FakeElement(document, 'a', ['block', 'button', 'text-center']);
  rankingLink.setAttribute('href', '/ranking/teams');
  const rankingText = document.createTextNode('Complete ranking');
  rankingLink.appendChild(rankingText);
  const lastUpdated = new FakeElement(document, 'span', ['normal-weight']);
  const lastUpdatedText = document.createTextNode('Last updated: ');
  lastUpdated.appendChild(lastUpdatedText);
  rankingLink.appendChild(lastUpdated);
  const updateDate = new FakeElement(document, 'span', ['normal-weight']);
  const updateDateText = document.createTextNode('14th of Sep');
  updateDate.appendChild(updateDateText);
  rankingLink.appendChild(updateDate);
  document.addCandidate(
    '.leftCol > aside > a.block.button.text-center[href="/ranking/teams"]',
    rankingLink
  );
  document.addCandidate(
    '.leftCol > aside > a.block.button.text-center[href="/ranking/teams"] > span.normal-weight',
    lastUpdated
  );
  document.addCandidate(
    '.leftCol > aside > a.block.button.text-center[href="/ranking/teams"] > span.normal-weight',
    updateDate
  );

  const eventCalendar = new FakeElement(document, 'a', ['block', 'button', 'text-center', 'leftCol']);
  eventCalendar.setAttribute('href', '/events');
  const eventCalendarText = document.createTextNode('Event calendar');
  eventCalendar.appendChild(eventCalendarText);
  document.addCandidate(
    '.leftCol > aside > a.block.button.text-center[href="/events"]',
    eventCalendar
  );

  const translator = new CountingTranslator();
  const diagnostics: Array<{ code: string; message: string }> = [];
  const { runtime } = makeRuntime(document, translator, diagnostics, 'A');

  await runtime.start();

  assert.deepEqual(
    [signInText.data, minigameText.data, playText.data, rankingText.data, eventCalendarText.data],
    ['【译】Sign in', '【译】MINIGAME', '【译】Play', '【译】Complete ranking', '【译】Event calendar']
  );
  assert.deepEqual([lastUpdatedText.data, updateDateText.data], [
    'Last updated: ',
    '14th of Sep'
  ]);
  assert.equal(rankingLink.getAttribute('href'), '/ranking/teams');
  assert.equal(eventCalendar.getAttribute('href'), '/events');
  assert.deepEqual(translator.contextualCalls, [
    {
      texts: ['Sign in', 'MINIGAME', 'Play', 'Complete ranking', 'Event calendar'],
      context: 'structured',
      purpose: 'plain'
    }
  ]);
  assert.equal(diagnostics.length, 0);
});

test('translates the captured match-list headings and static filter labels in place', async () => {
  const document = new FakeDocument();
  const headingsSelector = '.matches-v4 .new-standardPageGrid .upcoming-headline';
  const headings = ['Live Counter-Strike matches', 'Upcoming Counter-Strike matches'];
  const headingNodes = headings.map((label, index) => {
    const heading = new FakeElement(document, index === 0 ? 'h2' : 'h1', ['upcoming-headline']);
    const text = document.createTextNode(label);
    heading.appendChild(text);
    document.addCandidate(headingsSelector, heading);
    return text;
  });

  const filterTitle = new FakeElement(document, 'h3');
  const filterTitleText = document.createTextNode('Match filters');
  filterTitle.appendChild(filterTitleText);
  document.addCandidate(
    '.matches-v4 .matches-sidebar-filter-wrapper .sidebar-title > h3',
    filterTitle
  );

  const filterSelector =
    '.matches-v4 .matches-sidebar-filter-wrapper .matches-filter-star-section .matches-filter-name-text, .matches-v4 .matches-sidebar-filter-wrapper .matches-filter-ranked-section .matches-filter-name-text';
  const filterLabels = ['Starred matches only', 'Ranked', 'Unranked'];
  const filterNodes = filterLabels.map((label) => {
    const element = new FakeElement(document, 'div', ['matches-filter-name-text']);
    const text = document.createTextNode(label);
    element.appendChild(text);
    document.addCandidate(filterSelector, element);
    return text;
  });

  const translator = new CountingTranslator();
  const diagnostics: Array<{ code: string; message: string }> = [];
  const { runtime } = makeRuntime(document, translator, diagnostics, 'A');

  await runtime.start();

  assert.deepEqual(
    headingNodes.map((text) => text.data),
    headings.map((label) => `【译】${label}`)
  );
  assert.equal(filterTitleText.data, '【译】Match filters');
  assert.deepEqual(
    filterNodes.map((text) => text.data),
    filterLabels.map((label) => `【译】${label}`)
  );
  assert.deepEqual(translator.contextualCalls, [
    {
      texts: [...headings, 'Match filters', ...filterLabels],
      context: 'structured',
      purpose: 'plain'
    }
  ]);
  assert.equal(diagnostics.length, 0);
});

test('translates the three captured match-detail statistics tab labels in place', async () => {
  const document = new FakeDocument();
  const selector =
    '.match-page .map-stats-infobox .map-stats-infobox-tabs > button.map-stats-infobox-tab';
  const labels = ['Win %', 'Pick %', 'Ban %'];
  const nodes = labels.map((label) => {
    const button = new FakeElement(document, 'button', ['map-stats-infobox-tab']);
    const text = document.createTextNode(label);
    button.appendChild(text);
    document.addCandidate(selector, button);
    return { button, text };
  });

  const translator = new CountingTranslator();
  const diagnostics: Array<{ code: string; message: string }> = [];
  const { runtime } = makeRuntime(document, translator, diagnostics, 'A');

  await runtime.start();

  assert.deepEqual(nodes.map(({ text }) => text.data), labels.map((label) => `【译】${label}`));
  assert.deepEqual(nodes.map(({ text }) => text.nextSibling), labels.map(() => null));
  assert.deepEqual(translator.contextualCalls, [
    { texts: labels, context: 'structured', purpose: 'plain' }
  ]);
  assert.equal(diagnostics.length, 0);
});

test('translates only approved match-detail module headings in full-Chinese mode', async () => {
  const document = new FakeDocument();
  const selector =
    '.match-page .betting-section .headline, .match-page .lineups > .headline, .match-page .past-matches-header > .headline, .match-page .matchpage-analytics-section > .headline';
  const approvedHeadings = [
    'Betting',
    'Lineups',
    'Matches, past 3 months',
    'Head to head',
    'VRS forecast'
  ];
  const approvedNodes = approvedHeadings.map((text) => {
    const heading = new FakeElement(document, 'span', ['headline']);
    const textNode = document.createTextNode(text);
    heading.appendChild(textNode);
    document.addCandidate(selector, heading);
    return textNode;
  });
  const excludedHeadings = ['Maps', 'Watch(143k)', 'Map stats'].map((text) => {
    const heading = new FakeElement(document, 'span', ['headline']);
    const textNode = document.createTextNode(text);
    heading.appendChild(textNode);
    return textNode;
  });

  const translator = new CountingTranslator();
  const diagnostics: Array<{ code: string; message: string }> = [];
  const { runtime } = makeRuntime(document, translator, diagnostics, 'A');

  await runtime.start();

  assert.deepEqual(
    approvedNodes.map((textNode) => textNode.data),
    approvedHeadings.map((text) => `【译】${text}`)
  );
  assert.deepEqual(approvedNodes.map((textNode) => textNode.nextSibling), [
    null,
    null,
    null,
    null,
    null
  ]);
  assert.deepEqual(
    excludedHeadings.map((textNode) => [textNode.data, textNode.nextSibling]),
    ['Maps', 'Watch(143k)', 'Map stats'].map((text) => [text, null])
  );
  assert.deepEqual(translator.contextualCalls, [
    { texts: approvedHeadings, context: 'structured', purpose: 'plain' }
  ]);
  assert.equal(diagnostics.length, 0);
});

test('replaces main navigation labels in place while preserving link attributes and icons', async () => {
  const document = new FakeDocument();
  const link = new FakeElement(document, 'a', ['nav-link']);
  link.setAttribute('href', '/matches');
  const label = document.createTextNode('Matches');
  const icon = new FakeElement(document, 'svg');
  const iconPath = new FakeElement(document, 'path');
  icon.appendChild(iconPath);
  link.appendChild(label);
  link.appendChild(icon);
  document.addCandidate('.navbar .navcon a.nav-link', link);

  const translator = new CountingTranslator();
  const diagnostics: Array<{ code: string; message: string }> = [];
  const { runtime } = makeRuntime(document, translator, diagnostics, 'A');

  await runtime.start();

  assert.equal(label.data, '【译】Matches');
  assert.equal(link.getAttribute('href'), '/matches');
  assert.equal(link.childNodes.length, 2);
  assert.equal(link.childNodes[0], label);
  assert.equal(link.childNodes[1], icon);
  assert.equal(icon.childNodes[0], iconPath);
  assert.deepEqual(translator.contextualCalls, [
    { texts: ['Matches'], context: 'structured', purpose: 'plain' }
  ]);
  assert.equal(diagnostics.length, 0);
});

test('translates shared footer copy in place and preserves links and responsible-gaming logos', async () => {
  const document = new FakeDocument();
  const heading = new FakeElement(document, 'div', ['footer-section-header']);
  const headingText = document.createTextNode('Download the HLTV app');
  heading.appendChild(headingText);
  document.addCandidate('.footer .footer-content .footer-section-header', heading);

  const subtext = new FakeElement(document, 'div', ['footer-section-subtext']);
  const subtextNode = document.createTextNode('Optimized to keep you up to date on the go');
  subtext.appendChild(subtextNode);
  document.addCandidate('.footer .footer-content .footer-section-subtext', subtext);

  const cta = new FakeElement(document, 'a', ['footer-cta-button']);
  cta.setAttribute('href', '/download');
  const ctaText = document.createTextNode('Buy HLTV merch');
  cta.appendChild(ctaText);
  document.addCandidate('.footer .footer-content .footer-cta-button', cta);

  const footerLink = new FakeElement(document, 'a', ['footerlink']);
  footerLink.setAttribute('href', '/privacy');
  const footerLinkText = document.createTextNode('Privacy policy');
  footerLink.appendChild(footerLinkText);
  document.addCandidate('.footer .footerlinks a.footerlink', footerLink);

  const responsible = new FakeElement(document, 'div', [
    'footer-generic-responible-container'
  ]);
  const responsibleText = document.createTextNode('18+ Bet Responsibly |');
  const logo = new FakeElement(document, 'img');
  responsible.appendChild(responsibleText);
  responsible.appendChild(logo);
  document.addCandidate(
    '.footer .footer-responsible-container .footer-generic-responible-container',
    responsible
  );

  const translator = new CountingTranslator();
  const diagnostics: Array<{ code: string; message: string }> = [];
  const { runtime } = makeRuntime(document, translator, diagnostics, 'A');

  await runtime.start();

  assert.equal(headingText.data, '【译】Download the HLTV app');
  assert.equal(subtextNode.data, '【译】Optimized to keep you up to date on the go');
  assert.equal(ctaText.data, '【译】Buy HLTV merch');
  assert.equal(cta.getAttribute('href'), '/download');
  assert.equal(footerLinkText.data, '【译】Privacy policy');
  assert.equal(footerLink.getAttribute('href'), '/privacy');
  assert.equal(responsibleText.data, '【译】18+ Bet Responsibly |');
  assert.equal(responsible.childNodes[1], logo);
  assert.deepEqual(translator.contextualCalls, [
    {
      texts: [
        'Download the HLTV app',
        'Buy HLTV merch',
        'Privacy policy',
        '18+ Bet Responsibly |'
      ],
      context: 'structured',
      purpose: 'plain'
    },
    {
      texts: ['Optimized to keep you up to date on the go'],
      context: 'prose',
      purpose: 'plain'
    }
  ]);
  assert.equal(diagnostics.length, 0);
});

test('translates the observed events headings and ranking selector without changing ranking data', async () => {
  const document = new FakeDocument();
  const routeLabels = [
    {
      selector: '.event-status-headline',
      className: 'event-status-headline',
      text: 'Ongoing events'
    },
    {
      selector: '.event-status-upcoming-headline',
      className: 'event-status-upcoming-headline',
      text: 'Upcoming events'
    },
    {
      selector: '.ranking-open-region-selector',
      className: 'ranking-open-region-selector',
      text: 'Regional rankings'
    }
  ] as const;
  const translatedLabels = routeLabels.map(({ selector, className, text }) => {
    const element = new FakeElement(document, 'div', [className]);
    const textNode = document.createTextNode(text);
    element.appendChild(textNode);
    document.addCandidate(selector, element);
    return textNode;
  });

  const team = new FakeElement(document, 'div', ['ranking-team']);
  const teamName = document.createTextNode('Spirit');
  const points = document.createTextNode('1000 HLTV points');
  const player = document.createTextNode('donk');
  team.appendChild(teamName);
  team.appendChild(points);
  team.appendChild(player);

  const translator = new CountingTranslator();
  const diagnostics: Array<{ code: string; message: string }> = [];
  const { runtime } = makeRuntime(document, translator, diagnostics, 'A');

  await runtime.start();

  assert.deepEqual(
    translatedLabels.map((textNode) => textNode.data),
    ['Ongoing events', 'Upcoming events', 'Regional rankings'].map(
      (text) => `【译】${text}`
    )
  );
  assert.deepEqual([teamName.data, points.data, player.data], [
    'Spirit',
    '1000 HLTV points',
    'donk'
  ]);
  assert.deepEqual(translator.contextualCalls, [
    {
      texts: ['Ongoing events', 'Upcoming events', 'Regional rankings'],
      context: 'structured',
      purpose: 'plain'
    }
  ]);
  assert.equal(diagnostics.length, 0);
});

test('translates results and player archive headings while route-gating profile titles', async () => {
  const resultsDocument = new FakeDocument('/results');
  const resultsHeading = new FakeElement(resultsDocument, 'h1');
  const resultsHeadingText = resultsDocument.createTextNode('Results');
  resultsHeading.appendChild(resultsHeadingText);
  resultsDocument.addCandidate(
    'h1:not(#playerOfTheWeekTitle):not(.minigame-label-new)',
    resultsHeading
  );

  const filterTitle = new FakeElement(resultsDocument, 'div', [
    'header-filters-title'
  ]);
  const filterTitleText = resultsDocument.createTextNode('FILTERS');
  filterTitle.appendChild(filterTitleText);
  resultsDocument.addCandidate('.header-filters-title', filterTitle);

  const filterLabelTexts = [
    'Stars',
    'Time',
    'Match type',
    'Map',
    'Event',
    'Player',
    'Team',
    'Game',
    'Valve ranked'
  ].map((label) => {
    const filterLabel = new FakeElement(resultsDocument, 'div', ['filter-headline']);
    const textNode = resultsDocument.createTextNode(label);
    filterLabel.appendChild(textNode);
    resultsDocument.addCandidate('.filter-headline', filterLabel);
    return textNode;
  });

  const resultsTranslator = new CountingTranslator();
  const resultsDiagnostics: Array<{ code: string; message: string }> = [];
  const resultsRuntime = makeRuntime(
    resultsDocument,
    resultsTranslator,
    resultsDiagnostics,
    'A'
  ).runtime;

  await resultsRuntime.start();

  assert.deepEqual(
    [resultsHeadingText.data, filterTitleText.data, ...filterLabelTexts.map(({ data }) => data)],
    ['Results', 'FILTERS', 'Stars', 'Time', 'Match type', 'Map', 'Event', 'Player', 'Team', 'Game', 'Valve ranked'].map(
      (text) => `【译】${text}`
    )
  );
  assert.deepEqual(resultsTranslator.contextualCalls, [
    {
      texts: [
        'Results',
        'FILTERS',
        'Stars',
        'Time',
        'Match type',
        'Map',
        'Event',
        'Player',
        'Team',
        'Game',
        'Valve ranked'
      ],
      context: 'structured',
      purpose: 'plain'
    }
  ]);
  assert.equal(resultsDiagnostics.length, 0);

  const archiveDocument = new FakeDocument('/players/archive/active');
  const archiveHeading = new FakeElement(archiveDocument, 'h1');
  const archiveHeadingText = archiveDocument.createTextNode('Counter-Strike Players');
  archiveHeading.appendChild(archiveHeadingText);
  archiveDocument.addCandidate(
    'h1:not(#playerOfTheWeekTitle):not(.minigame-label-new)',
    archiveHeading
  );
  const archiveRuntime = makeRuntime(
    archiveDocument,
    new CountingTranslator(),
    [],
    'A'
  ).runtime;

  await archiveRuntime.start();

  assert.equal(archiveHeadingText.data, '【译】Counter-Strike Players');

  const profileDocument = new FakeDocument('/player/123/spirit');
  const profileHeading = new FakeElement(profileDocument, 'h1');
  const profileHeadingText = profileDocument.createTextNode('donk');
  profileHeading.appendChild(profileHeadingText);
  profileDocument.addCandidate(
    'h1:not(#playerOfTheWeekTitle):not(.minigame-label-new)',
    profileHeading
  );
  const profileTranslator = new CountingTranslator();
  const profileRuntime = makeRuntime(
    profileDocument,
    profileTranslator,
    [],
    'A'
  ).runtime;

  await profileRuntime.start();

  assert.equal(profileHeadingText.data, 'donk');
  assert.equal(profileTranslator.contextualCalls.length, 0);
});

test('translates only the Fantasy overview headings and preserves leaderboard data', async () => {
  const document = new FakeDocument('/fantasy');
  const headingLabels = [
    { selector: 'h1', tagName: 'h1', text: 'Fantasy Fall season 2026' },
    { selector: 'h1', tagName: 'h1', text: 'Partner Games' },
    { selector: 'h2', tagName: 'h2', text: 'PRIZES' },
    { selector: 'h2', tagName: 'h2', text: 'ABOUT FALL SEASON 2026' },
    { selector: 'h2', tagName: 'h2', text: 'POINTS SYSTEM' }
  ] as const;
  const headingTextNodes = headingLabels.map(({ selector, tagName, text }) => {
    const heading = new FakeElement(document, tagName);
    const textNode = document.createTextNode(text);
    heading.appendChild(textNode);
    document.addCandidate(selector, heading);
    return textNode;
  });

  const user = new FakeElement(document, 'a');
  const username = document.createTextNode('adrbb');
  const points = document.createTextNode('5000');
  user.appendChild(username);
  user.appendChild(points);

  const translator = new CountingTranslator();
  const diagnostics: Array<{ code: string; message: string }> = [];
  const runtime = makeRuntime(document, translator, diagnostics, 'A').runtime;

  await runtime.start();

  assert.deepEqual(
    headingTextNodes.map(({ data }) => data),
    headingLabels.map(({ text }) => `【译】${text}`)
  );
  assert.deepEqual([username.data, points.data], ['adrbb', '5000']);
  assert.deepEqual(translator.contextualCalls, [
    {
      texts: ['Fantasy Fall season 2026', 'Partner Games', 'PRIZES', 'ABOUT FALL SEASON 2026', 'POINTS SYSTEM'],
      context: 'structured',
      purpose: 'plain'
    }
  ]);
  assert.equal(diagnostics.length, 0);

  const gameDocument = new FakeDocument('/fantasy/650/gameredirect');
  const gameHeading = new FakeElement(gameDocument, 'h2');
  const gameHeadingText = gameDocument.createTextNode('FISSURE Playground 3');
  gameHeading.appendChild(gameHeadingText);
  gameDocument.addCandidate('h2', gameHeading);
  const gameTranslator = new CountingTranslator();
  const gameRuntime = makeRuntime(gameDocument, gameTranslator, [], 'A').runtime;

  await gameRuntime.start();

  assert.equal(gameHeadingText.data, 'FISSURE Playground 3');
  assert.equal(gameTranslator.contextualCalls.length, 0);
});

test('translates only the Live fullscreen and theater controls, preserving live data', async () => {
  const document = new FakeDocument('/live');
  const fullscreen = new FakeElement(document, 'button');
  const fullscreenText = document.createTextNode('Fullscreen');
  fullscreen.appendChild(fullscreenText);
  document.addCandidate('button', fullscreen);

  const theaterLink = new FakeElement(document, 'a');
  theaterLink.setAttribute('href', '/live?fullscreen=1');
  const theaterText = document.createTextNode('Theater');
  theaterLink.appendChild(theaterText);
  document.addCandidate('a[href*="fullscreen=1"]', theaterLink);

  const teamName = document.createTextNode('HEROIC');
  const liveScore = document.createTextNode('0');
  const emptyState = document.createTextNode('No match selected');
  const translator = new CountingTranslator();
  const diagnostics: Array<{ code: string; message: string }> = [];
  const runtime = makeRuntime(document, translator, diagnostics, 'A').runtime;

  await runtime.start();

  assert.deepEqual([fullscreenText.data, theaterText.data], [
    '【译】Fullscreen',
    '【译】Theater'
  ]);
  assert.equal(theaterLink.getAttribute('href'), '/live?fullscreen=1');
  assert.deepEqual([teamName.data, liveScore.data, emptyState.data], [
    'HEROIC',
    '0',
    'No match selected'
  ]);
  assert.deepEqual(translator.contextualCalls, [
    {
      texts: ['Fullscreen', 'Theater'],
      context: 'structured',
      purpose: 'plain'
    }
  ]);
  assert.equal(diagnostics.length, 0);

  const matchDocument = new FakeDocument('/live/match/123');
  const matchFullscreen = new FakeElement(matchDocument, 'button');
  const matchFullscreenText = matchDocument.createTextNode('Fullscreen');
  matchFullscreen.appendChild(matchFullscreenText);
  matchDocument.addCandidate('button', matchFullscreen);
  const matchTranslator = new CountingTranslator();
  const matchRuntime = makeRuntime(matchDocument, matchTranslator, [], 'A').runtime;

  await matchRuntime.start();

  assert.equal(matchFullscreenText.data, 'Fullscreen');
  assert.equal(matchTranslator.contextualCalls.length, 0);
});

test('nested candidates use the innermost strategy while outer direct text stays bilingual', async () => {
  const document = new FakeDocument();
  const event = new FakeElement(document, 'div', ['match-event']);
  const eventTextContainer = new FakeElement(document, 'div', ['text-ellipsis']);
  const eventText = document.createTextNode('StarLadder StarSeries Fall 2026');
  eventTextContainer.appendChild(eventText);
  event.appendChild(eventTextContainer);

  const stage = new FakeElement(document, 'div', ['match-stage']);
  const stageText = document.createTextNode('Grand Final');
  stage.appendChild(stageText);
  event.appendChild(stage);

  document.addCandidate('.match-event', event);
  document.addCandidate('.match-stage', stage);

  const translator = new CountingTranslator();
  const diagnostics: Array<{ code: string; message: string }> = [];
  const { runtime } = makeRuntime(document, translator, diagnostics, 'B');

  await runtime.start();

  assert.equal(eventText.data, 'StarLadder StarSeries Fall 2026');
  assert.equal(eventTextContainer.childNodes.length, 2);
  assert.equal(stageText.data, 'Grand Final');
  assert.equal(stage.childNodes.length, 1);
  assert.equal(
    eventTextContainer.childNodes[1] instanceof FakeElement &&
      eventTextContainer.childNodes[1].getAttribute('data-hltv-zh') === '1',
    true
  );
  assert.equal(
    stage.childNodes.some(
      (node) => node instanceof FakeElement && node.getAttribute('data-hltv-zh') === '1'
    ),
    false
  );
  await runtime.setMode('A');
  assert.equal(stageText.data, '【译】Grand Final');
  await runtime.setMode('B');
  assert.equal(stageText.data, 'Grand Final');
  assert.equal(stage.childNodes.length, 1);
  assert.equal(diagnostics.length, 0);
});

test('non-nested sibling candidates are both retained', async () => {
  const document = new FakeDocument();
  const firstEvent = new FakeElement(document, 'div', ['match-event']);
  const firstText = document.createTextNode('First event');
  firstEvent.appendChild(firstText);
  const secondEvent = new FakeElement(document, 'div', ['match-event']);
  const secondText = document.createTextNode('Second event');
  secondEvent.appendChild(secondText);
  document.addCandidate('.match-event', firstEvent);
  document.addCandidate('.match-event', secondEvent);

  const diagnostics: Array<{ code: string; message: string }> = [];
  const { runtime } = makeRuntime(
    document,
    new CountingTranslator(),
    diagnostics,
    'B'
  );

  await runtime.start();

  assert.equal(firstEvent.childNodes.length, 2);
  assert.equal(secondEvent.childNodes.length, 2);
  assert.equal(diagnostics.length, 0);
});

test('mode B appends one marked sibling and observer processing is idempotent', async () => {
  const document = new FakeDocument();
  const event = new FakeElement(document, 'div', ['match-event']);
  const eventText = document.createTextNode('StarLadder StarSeries');
  event.appendChild(eventText);
  document.addCandidate('.match-event', event);

  const translator = new CountingTranslator();
  const diagnostics: Array<{ code: string; message: string }> = [];
  const { runtime, observer } = makeRuntime(document, translator, diagnostics, 'B');

  await runtime.start();

  const marker = event.childNodes[1];
  assert.equal(eventText.data, 'StarLadder StarSeries');
  assert.equal(marker instanceof FakeElement, true);
  if (marker instanceof FakeElement) {
    assert.equal(marker.getAttribute('data-hltv-zh'), '1');
    assert.equal(marker.getAttribute('translate'), 'no');
    assert.equal(marker.textContent, '【译】StarLadder StarSeries');
  }
  assert.equal(observer().disconnectCount > 0, true);

  const callsBeforeMutation = translator.eventCalls.length;
  observer().emit([
    {
      type: 'childList',
      target: asNode(event),
      addedNodes: [marker] as unknown as NodeList,
      removedNodes: [] as unknown as NodeList
    } as unknown as MutationRecord
  ]);
  await flushObserver();

  assert.equal(translator.eventCalls.length, callsBeforeMutation);
  assert.equal(
    event.childNodes.filter(
      (node) => node instanceof FakeElement && node.getAttribute('data-hltv-zh') === '1'
    ).length,
    1
  );
  assert.equal(diagnostics.length, 0);
});

test('mode switching reuses translations and disabling restores and clears the page', async () => {
  const document = new FakeDocument();
  const event = new FakeElement(document, 'div', ['match-event']);
  const eventText = document.createTextNode('StarLadder StarSeries');
  event.appendChild(eventText);
  document.addCandidate('.match-event', event);

  const translator = new CountingTranslator();
  const diagnostics: Array<{ code: string; message: string }> = [];
  const { runtime, observer } = makeRuntime(document, translator, diagnostics);

  await runtime.start();
  assert.equal(translator.eventCalls.length, 1);

  await runtime.setMode('B');
  assert.equal(translator.eventCalls.length, 1);
  assert.equal(eventText.data, 'StarLadder StarSeries');
  assert.equal(event.childNodes.length, 2);

  await runtime.setMode('A');
  assert.equal(translator.eventCalls.length, 1);
  assert.equal(eventText.data, '【译】StarLadder StarSeries');
  assert.equal(event.childNodes.length, 1);

  await runtime.setEnabled(false);
  assert.equal(observer().observed, false);
  assert.equal(eventText.data, 'StarLadder StarSeries');
  assert.equal(event.childNodes.length, 1);
  assert.equal(runtime.stats().enabled, false);
  assert.equal(runtime.stats().processedNodes, 0);
  assert.equal(diagnostics.length, 0);
});

test('provider settings changes rescan failed nodes and insert one translated sibling', async () => {
  const document = new FakeDocument();
  const event = new FakeElement(document, 'div', ['match-event']);
  const eventText = document.createTextNode('StarLadder StarSeries');
  event.appendChild(eventText);
  document.addCandidate('.match-event', event);

  let requests = 0;
  const translator = createBackgroundTranslationService({
    sendMessage(message) {
      requests += 1;
      if (requests === 1) {
        return Promise.resolve(encodeTranslateResponse({
          type: 'hltv-zh-translate-response',
          requestId: message.requestId,
          purpose: message.purpose,
          ok: false,
          translations: message.texts,
          error: {
            code: 'provider-failure',
            fallback: 'original',
            message: 'Provider permission is missing.'
          }
        }));
      }
      return Promise.resolve(encodeTranslateResponse({
        type: 'hltv-zh-translate-response',
        requestId: message.requestId,
        purpose: message.purpose,
        ok: true,
        translations: message.texts.map((text) => `译:${text}`)
      }));
    }
  });
  const diagnostics: Array<{ code: string; message: string }> = [];
  const { runtime } = makeRuntime(document, translator, diagnostics, 'B');

  await runtime.start();
  assert.equal(eventText.data, 'StarLadder StarSeries');
  assert.equal(event.childNodes.length, 1);
  assert.equal(requests, 1);

  await applyContentSettingsChanges(runtime, {
    baseURL: { newValue: 'https://provider.example/v1' },
    apiKey: { newValue: 'configured' }
  });

  assert.equal(requests, 2);
  assert.equal(eventText.data, 'StarLadder StarSeries');
  assert.equal(event.childNodes.length, 2);
  assert.equal(
    event.childNodes.filter(
      (node) => node instanceof FakeElement && node.getAttribute('data-hltv-zh') === '1'
    ).length,
    1
  );
  assert.equal(runtime.stats().processedNodes, 1);
  assert.equal(diagnostics.length, 0);
});

test('rapid provider settings changes stay serialized and do not duplicate translation nodes', async () => {
  const document = new FakeDocument();
  const event = new FakeElement(document, 'div', ['match-event']);
  const eventText = document.createTextNode('StarLadder StarSeries');
  event.appendChild(eventText);
  document.addCandidate('.match-event', event);

  let requests = 0;
  const translator = createBackgroundTranslationService({
    sendMessage(message) {
      requests += 1;
      return Promise.resolve(encodeTranslateResponse({
        type: 'hltv-zh-translate-response',
        requestId: message.requestId,
        purpose: message.purpose,
        ok: true,
        translations: message.texts.map((text) => `译:${text}`)
      }));
    }
  });
  const { runtime } = makeRuntime(document, translator, [], 'B');
  await runtime.start();

  await Promise.all([
    applyContentSettingsChanges(runtime, { baseURL: { newValue: 'https://one.example' } }),
    applyContentSettingsChanges(runtime, { model: { newValue: 'model-two' } }),
    applyContentSettingsChanges(runtime, { apiKey: { newValue: 'key-three' } })
  ]);

  assert.equal(requests, 4);
  assert.equal(event.childNodes.length, 2);
  assert.equal(
    event.childNodes.filter(
      (node) => node instanceof FakeElement && node.getAttribute('data-hltv-zh') === '1'
    ).length,
    1
  );
  assert.equal(runtime.stats().processedNodes, 1);
});

test('provider settings rescan failures safely and do not retry without another setting change', async () => {
  const document = new FakeDocument();
  const event = new FakeElement(document, 'div', ['match-event']);
  const eventText = document.createTextNode('StarLadder StarSeries');
  event.appendChild(eventText);
  document.addCandidate('.match-event', event);

  let requests = 0;
  const translator = createBackgroundTranslationService({
    sendMessage() {
      requests += 1;
      return Promise.reject(new Error('Permission is still missing.'));
    }
  });
  const { runtime, observer } = makeRuntime(document, translator, [], 'B');
  await runtime.start();

  await applyContentSettingsChanges(runtime, {
    baseURL: { newValue: 'https://provider.example/v1' }
  });
  await flushObserver();

  assert.equal(requests, 2);
  assert.equal(eventText.data, 'StarLadder StarSeries');
  assert.equal(event.childNodes.length, 1);
  assert.equal(runtime.stats().processedNodes, 1);
  assert.equal(observer().observed, true);
});

test('permission recovery retries failed translations without changing content settings', async () => {
  const document = new FakeDocument();
  const event = new FakeElement(document, 'div', ['match-event']);
  const eventText = event.appendChild(document.createTextNode('StarLadder StarSeries'));
  document.addCandidate('.match-event', event);

  let requests = 0;
  const translator: ContentTranslator = {
    async translateEventNames(texts) {
      requests += 1;
      return requests === 1 ? [...texts] : texts.map((text) => `译:${text}`);
    },
    async translate(texts) {
      requests += 1;
      return texts.map((text) => `译:${text}`);
    }
  };
  const { runtime } = makeRuntime(document, translator, [], 'A');
  await runtime.start();
  assert.equal(eventText.data, 'StarLadder StarSeries');
  assert.equal(requests, 1);

  await applyContentSettingsChanges(runtime, {
    permissionRevision: { newValue: Date.now() }
  });

  assert.equal(requests, 2);
  assert.equal(eventText.data, '译:StarLadder StarSeries');
});

test('disabled content runtime does not rescan after settings changes', async () => {
  const document = new FakeDocument();
  const event = new FakeElement(document, 'div', ['match-event']);
  event.appendChild(document.createTextNode('StarLadder StarSeries'));
  document.addCandidate('.match-event', event);

  let requests = 0;
  const translator = createBackgroundTranslationService({
    sendMessage() {
      requests += 1;
      return Promise.reject(new Error('A disabled page must not request translation.'));
    }
  });
  const { runtime } = makeRuntime(document, translator, [], 'A', false);
  await runtime.start();

  await applyContentSettingsChanges(runtime, {
    enabled: { newValue: false },
    baseURL: { newValue: 'https://provider.example/v1' }
  });

  assert.equal(requests, 0);
  assert.equal(runtime.stats().processedNodes, 0);
  assert.equal(event.childNodes.length, 1);
});

test('dynamic writer attributes never call the translator', async () => {
  const document = new FakeDocument();
  const time = new FakeElement(document, 'div', ['match-event']);
  time.setAttribute('data-time-format', 'yyyy-MM-dd HH:mm');
  time.setAttribute('data-unix', '1789842660000');
  const timeText = document.createTextNode('2026-09-20');
  time.appendChild(timeText);
  document.addCandidate('.match-event', time);

  const countdown = new FakeElement(document, 'div', ['match-event']);
  countdown.setAttribute('data-countdown-target-timestamp', '1789842660');
  const countdownText = document.createTextNode('00:12');
  countdown.appendChild(countdownText);
  document.addCandidate('.match-event', countdown);

  const translator = new CountingTranslator();
  const diagnostics: Array<{ code: string; message: string }> = [];
  const { runtime } = makeRuntime(document, translator, diagnostics);

  await runtime.start();

  assert.equal(timeText.data, '2026-09-20');
  assert.equal(countdownText.data, '00:12');
  assert.equal(translator.eventCalls.length, 0);
  assert.equal(translator.plainCalls.length, 0);
});

test('an original-text rewrite gets a fresh record without container assignment', async () => {
  const document = new FakeDocument();
  const event = new FakeElement(document, 'div', ['match-event']);
  const eventText = document.createTextNode('StarLadder StarSeries');
  event.appendChild(eventText);
  document.addCandidate('.match-event', event);

  const translator = new CountingTranslator();
  const diagnostics: Array<{ code: string; message: string }> = [];
  const { runtime } = makeRuntime(document, translator, diagnostics);

  await runtime.start();
  eventText.data = 'Page changed this text';
  await runtime.setMode('B');

  assert.equal(eventText.data, 'Page changed this text');
  assert.equal(event.childNodes.length, 2);
  assert.equal(
    diagnostics.some((diagnostic) => diagnostic.code === 'original-mismatch'),
    true
  );
  const sibling = event.childNodes[1];
  assert.equal(sibling instanceof FakeElement ? sibling.textContent : undefined, '【译】Page changed this text');
});

test('the wiring stub returns a conspicuous translation without network access', async () => {
  const translator = createStubTranslationService();

  assert.deepEqual(await translator.translate(['Aurora']), ['【译】Aurora']);
  assert.deepEqual(
    await translator.translateEventNames(['StarLadder StarSeries']),
    ['【译】StarLadder StarSeries']
  );
});

async function statsGlossary(): Promise<GlossaryDocument> {
  const moduleName = 'node:fs/promises';
  const { readFile } = await import(moduleName) as {
    readFile(path: URL, encoding: 'utf8'): Promise<string>;
  };
  return parseGlossaryJson(await readFile(new URL('../glossary.json', import.meta.url), 'utf8')).glossary;
}

test('stats screenshot labels translate locally without sending page data to the provider', async () => {
  const document = new FakeDocument('/stats/players/3741/niko');
  const body = new FakeElement(document, 'body');
  const labels = [
    'PLAYER CONTEXT', 'NAVIGATION', 'SEARCH STATS', 'EVENT FILTER', 'TIME FILTER',
    'RANKING FILTER', 'MAP FILTER', 'VERSION', 'All', 'Both', 'Overview',
    'Individual', 'Matches', 'Events', 'Career', 'Weapons', 'Clutches',
    'Multi-kills', 'Opponents', 'Flashes', 'Opening kills', 'Pistol rounds',
    'Teams', 'Maps', 'Leaderboards', 'Compare', '1.6 stats section',
    '2334 maps', 'Show player average', 'GOOD', 'T RATING', 'CT RATING',
    'RATING 1.0', 'ROUND SWING', 'DPR', 'KAST', 'MULTI-KILL', 'ADR', 'KPR',
    'N/A', 'OKAY', 'POOR', '29 years', 'Player profile', 'Side:',
    'Both Sides', 'CT Side', 'T Side', 'Stats per:', 'Round', '24 rounds',
    'Firepower', 'Entrying', 'Trading', 'Opening', 'Clutching', 'Sniping', 'Utility'
  ];
  const nodes = labels.map((label) => {
    const container = new FakeElement(document, 'div');
    body.appendChild(container);
    return container.appendChild(document.createTextNode(label));
  });
  const identity = body.appendChild(document.createTextNode('NiKo'));
  const userTitle = body.appendChild(document.createTextNode('SunPayus departs G2'));
  const value = body.appendChild(document.createTextNode('1.14'));
  document.addCandidate('body', body);
  const translator = new CountingTranslator();
  const runtime = createContentRuntime({
    document: asDocument(document), translator, fixedUiGlossary: await statsGlossary(),
    observerFactory: (callback) => new FakeObserver(callback) as unknown as MutationObserver
  });
  await runtime.start();
  assert.deepEqual(nodes.map((node) => node.data), [
    '选手信息', '导航', '搜索数据', '赛事筛选', '时间筛选', '排名筛选', '地图筛选',
    '游戏版本', '全部', '全部', '概览', '个人数据', '比赛', '赛事', '职业生涯',
    '武器', '残局', '多杀', '对手', '闪光弹', '首杀', '手枪局', '战队', '地图',
    '排行榜', '对比', '1.6 数据专区', '2334 地图', '显示选手平均值', '优秀',
    '进攻评分', '防守评分', '评分 1.0', '回合影响', '回合死亡', '回合贡献率',
    '多杀率', '回合均伤', '回合击杀', '暂无', '一般', '较差', '29 岁', '选手主页',
    '阵营:', '双方', '防守方', '进攻方', '统计口径:', '每回合', '24 回合',
    '火力', '突破', '补枪', '首杀', '残局', '狙击', '道具'
  ]);
  assert.deepEqual(translator.contextualCalls, []);
  assert.deepEqual([identity.data, userTitle.data, value.data], ['NiKo', 'SunPayus departs G2', '1.14']);
  await runtime.setEnabled(false);
  assert.deepEqual(nodes.map((node) => node.data), labels);
  await runtime.setEnabled(true);
  assert.equal(nodes[0]?.data, '选手信息');
});

test('stats fixed-label fallback excludes scripts, editable text, forums, and live writers', async () => {
  const document = new FakeDocument('/stats/players/3741/niko');
  const body = new FakeElement(document, 'body');
  const excluded = [
    new FakeElement(document, 'script'), new FakeElement(document, 'style'),
    new FakeElement(document, 'textarea'), new FakeElement(document, 'div', ['forum']),
    new FakeElement(document, 'div', ['recent-activity']),
    new FakeElement(document, 'div', ['match-team-livescore']),
    new FakeElement(document, 'div'), new FakeElement(document, 'div'), new FakeElement(document, 'div')
  ];
  excluded[6]?.setAttribute('data-countdown-target-timestamp', '123456');
  excluded[7]?.setAttribute('contenteditable', 'true');
  excluded[8]?.setAttribute('data-livescore-status', 'active');
  const nodes = excluded.map((container) => {
    body.appendChild(container);
    return container.appendChild(document.createTextNode('Overview'));
  });
  document.addCandidate('body', body);
  const translator = new CountingTranslator();
  const runtime = createContentRuntime({
    document: asDocument(document), translator, fixedUiGlossary: await statsGlossary(),
    observerFactory: (callback) => new FakeObserver(callback) as unknown as MutationObserver
  });
  await runtime.start();
  assert.deepEqual(nodes.map((node) => node.data), nodes.map(() => 'Overview'));
  assert.equal(runtime.stats().processedNodes, 0);
  assert.deepEqual(translator.contextualCalls, []);
});

test('stats fallback remains off unrelated routes and admits newly inserted labels', async () => {
  const glossary = await statsGlossary();
  for (const pathname of ['/news/1/example', '/stats-extra', '/stats/players/3741/niko']) {
    const document = new FakeDocument(pathname);
    const body = new FakeElement(document, 'body');
    const label = body.appendChild(document.createTextNode('Overview'));
    document.addCandidate('body', body);
    const translator = new CountingTranslator();
    const runtime = createContentRuntime({
      document: asDocument(document), translator, fixedUiGlossary: glossary,
      observerFactory: (callback) => new FakeObserver(callback) as unknown as MutationObserver
    });
    await runtime.start();
    assert.equal(label.data, pathname.startsWith('/stats/') ? '概览' : 'Overview');
    const added = body.appendChild(document.createTextNode('Firepower'));
    await runtime.requestScan();
    assert.equal(added.data, pathname.startsWith('/stats/') ? '火力' : 'Firepower');
    assert.deepEqual(translator.contextualCalls, []);
  }
});

test('shared fixed labels translate in uncovered layouts while stats terminology stays route-scoped', async () => {
  const document = new FakeDocument('/team/6667/faze');
  const body = new FakeElement(document, 'body');
  const shared = body.appendChild(document.createTextNode('Sign in'));
  const statsOnly = body.appendChild(document.createTextNode('Firepower'));
  const unknown = body.appendChild(document.createTextNode('FaZe'));
  document.addCandidate('body', body);
  const translator = new CountingTranslator();
  const runtime = createContentRuntime({
    document: asDocument(document), translator, fixedUiGlossary: await statsGlossary(),
    observerFactory: (callback) => new FakeObserver(callback) as unknown as MutationObserver
  });
  await runtime.start();
  assert.deepEqual([shared.data, statsOnly.data, unknown.data], ['登录', 'Firepower', 'FaZe']);
  assert.deepEqual(translator.contextualCalls, []);
});

test('match-detail fixed labels translate locally without sending controls to the provider', async () => {
  const document = new FakeDocument('/matches/2398749/spirit-vs-m80');
  const body = new FakeElement(document, 'body');
  const labels = ['Match over', 'Maps', 'Rewatch', 'Demo download', 'Match stats', 'Detailed stats'];
  const nodes = labels.map((label) => body.appendChild(document.createTextNode(label)));
  document.addCandidate('body', body);
  const translator = new CountingTranslator();
  const runtime = createContentRuntime({
    document: asDocument(document),
    translator,
    fixedUiGlossary: await statsGlossary(),
    observerFactory: (callback) => new FakeObserver(callback) as unknown as MutationObserver
  });

  await runtime.start();

  assert.deepEqual(nodes.map((node) => node.data), ['比赛结束', '地图', '回看', '下载录像', '比赛数据', '详细数据']);
  assert.deepEqual(translator.contextualCalls, []);
});

test('page rewrites to fixed labels are translated again and disable restores the latest original', async () => {
  const document = new FakeDocument('/stats/players/3741/niko');
  const body = new FakeElement(document, 'body');
  const label = body.appendChild(document.createTextNode('All'));
  document.addCandidate('body', body);
  const translator = new CountingTranslator();
  let observer: FakeObserver | undefined;
  const runtime = createContentRuntime({
    document: asDocument(document), translator, fixedUiGlossary: await statsGlossary(),
    observerFactory: (callback) => {
      observer = new FakeObserver(callback);
      return observer as unknown as MutationObserver;
    }
  });
  await runtime.start();
  assert.equal(label.data, '全部');
  label.data = 'GOOD';
  observer?.emit([{ type: 'characterData', target: asNode(label) } as MutationRecord]);
  await runtime.requestScan();
  assert.equal(label.data, '优秀');
  await runtime.setEnabled(false);
  assert.equal(label.data, 'GOOD');
  await runtime.setEnabled(true);
  label.data = 'NiKo';
  await runtime.requestScan();
  assert.equal(label.data, 'NiKo');
  await runtime.setEnabled(false);
  assert.equal(label.data, 'NiKo');
  assert.deepEqual(translator.contextualCalls, []);
});

test('fixed input hints and CSS badges translate without touching entered values and restore on disable', async () => {
  const document = new FakeDocument('/stats/players/3741/niko');
  const input = new FakeElement(document, 'input', ['navsearchinput']);
  input.setAttribute('placeholder', 'Search...');
  input.setAttribute('value', 'NiKo');
  document.addCandidate('input[placeholder]', input);
  const translator = new CountingTranslator();
  const runtime = createContentRuntime({
    document: asDocument(document), translator, fixedUiGlossary: await statsGlossary(),
    observerFactory: (callback) => new FakeObserver(callback) as unknown as MutationObserver
  });
  await runtime.start();
  assert.equal(input.getAttribute('placeholder'), '搜索…');
  assert.equal(input.getAttribute('value'), 'NiKo');
  assert.equal(document.head.childNodes.length, 1);
  const style = document.head.childNodes[0] as FakeElement;
  assert.equal(style.tagName, 'STYLE');
  assert.equal(style.textContent.includes('.minigame-label-new::after'), true);
  assert.equal(style.textContent.includes('\\65b0 '), true);
  await runtime.setMode('B');
  assert.equal(input.getAttribute('placeholder'), 'Search...');
  assert.equal(document.head.childNodes.length, 0);
  await runtime.setMode('A');
  assert.equal(input.getAttribute('placeholder'), '搜索…');
  input.setAttribute('placeholder', 'Username');
  await runtime.requestScan();
  assert.equal(input.getAttribute('placeholder'), '用户名');
  await runtime.setEnabled(false);
  assert.equal(input.getAttribute('placeholder'), 'Username');
  assert.equal(input.getAttribute('value'), 'NiKo');
  assert.equal(document.head.childNodes.length, 0);
  assert.deepEqual(translator.contextualCalls, []);
});

test('readable page prose reaches the configured provider while short identities and numeric data stay original', async () => {
  const document = new FakeDocument('/major');
  const body = new FakeElement(document, 'body');
  const prose = body.appendChild(document.createTextNode('The next tournament starts later this month.'));
  const name = body.appendChild(document.createTextNode('Nikola Kovač'));
  const value = body.appendChild(document.createTextNode('24'));
  const label = body.appendChild(document.createTextNode('Sign in'));
  document.addCandidate('body', body);
  const translator = new CountingTranslator();
  const runtime = createContentRuntime({
    document: asDocument(document), translator, fixedUiGlossary: await statsGlossary(),
    observerFactory: (callback) => new FakeObserver(callback) as unknown as MutationObserver
  });
  await runtime.start();
  assert.deepEqual([prose.data, name.data, value.data, label.data], [
    '【译】The next tournament starts later this month.', 'Nikola Kovač', '24', '登录'
  ]);
  assert.deepEqual(translator.contextualCalls, [{
    texts: ['The next tournament starts later this month.'], context: 'prose', purpose: 'plain'
  }]);
  await runtime.setEnabled(false);
  assert.equal(prose.data, 'The next tournament starts later this month.');
});

test('recent activity titles translate without including their adjacent comment counts', async () => {
  const document = new FakeDocument('/stats/players/3741/niko');
  const row = new FakeElement(document, 'a', ['activity']);
  const topic = new FakeElement(document, 'span', ['topic']);
  const text = topic.appendChild(document.createTextNode('SunPayus departs G2'));
  row.appendChild(topic);
  const count = row.appendChild(document.createTextNode('112'));
  document.addCandidate('.right2Col .activitylist > a.activity > span.topic', topic);
  const translator = new CountingTranslator();
  const { runtime } = makeRuntime(document, translator, []);
  await runtime.start();
  assert.equal(text.data, '【译】SunPayus departs G2');
  assert.equal(count.data, '112');
  assert.deepEqual(translator.contextualCalls, [{
    texts: ['SunPayus departs G2'], context: 'prose', purpose: 'plain'
  }]);
});

test('observed profile labels translate by glossary without guessed profile classes', async () => {
  const document = new FakeDocument('/team/12467/parivision');
  const body = new FakeElement(document, 'body');
  const text = body.appendChild(document.createTextNode('World ranking'));
  const unknown = body.appendChild(document.createTextNode('PARIVISION'));
  document.addCandidate('body', body);
  const translator = new CountingTranslator();
  const runtime = createContentRuntime({
    document: asDocument(document), translator, fixedUiGlossary: await statsGlossary(),
    observerFactory: (callback) => new FakeObserver(callback) as unknown as MutationObserver
  });
  await runtime.start();
  assert.deepEqual([text.data, unknown.data], ['世界排名', 'PARIVISION']);
  assert.deepEqual(translator.contextualCalls, []);
});

test('statistics tooltip labels and SVG text stay eligible', async () => {
  const document = new FakeDocument('/stats/players/3741/niko');
  const body = new FakeElement(document, 'body');
  const tooltip = new FakeElement(document, 'span');
  tooltip.setAttribute('data-tooltip-id', 'statistics-label');
  const label = tooltip.appendChild(document.createTextNode('Firepower'));
  body.appendChild(tooltip);
  const svg = new FakeElement(document, 'svg');
  const svgText = new FakeElement(document, 'text');
  const status = svgText.appendChild(document.createTextNode('GOOD'));
  svg.appendChild(svgText);
  body.appendChild(svg);
  document.addCandidate('body', body);
  const translator = new CountingTranslator();
  const runtime = createContentRuntime({
    document: asDocument(document), translator, fixedUiGlossary: await statsGlossary(),
    observerFactory: (callback) => new FakeObserver(callback) as unknown as MutationObserver
  });
  await runtime.start();
  assert.deepEqual([label.data, status.data], ['火力', '优秀']);
  assert.deepEqual(translator.contextualCalls, []);
});

test('fixed UI is rendered before a slow provider finishes page prose', async () => {
  const document = new FakeDocument('/major');
  const body = new FakeElement(document, 'body');
  const label = body.appendChild(document.createTextNode('Sign in'));
  body.appendChild(document.createTextNode('This tournament will start later this month.'));
  document.addCandidate('body', body);
  let release: () => void = () => {};
  let started: () => void = () => {};
  const providerStarted = new Promise<void>((resolve) => { started = resolve; });
  const providerGate = new Promise<void>((resolve) => { release = resolve; });
  const translator: ContentTranslator = {
    async translate(texts) {
      started();
      await providerGate;
      return texts.map((text) => `【译】${text}`);
    },
    async translateEventNames(texts) { return [...texts]; }
  };
  const runtime = createContentRuntime({
    document: asDocument(document), translator, fixedUiGlossary: await statsGlossary(),
    observerFactory: (callback) => new FakeObserver(callback) as unknown as MutationObserver
  });
  const starting = runtime.start();
  await providerStarted;
  const visibleBeforeProvider = label.data;
  release();
  await starting;
  assert.equal(visibleBeforeProvider, '登录');
});

test('large page translations are bounded and render earlier batches before later ones finish', async () => {
  const document = new FakeDocument('/major');
  const body = new FakeElement(document, 'body');
  const nodes = Array.from({ length: 45 }, (_, index) =>
    body.appendChild(document.createTextNode(`This is the English page announcement number ${index}.`)));
  document.addCandidate('body', body);
  const sent: number[] = [];
  let earlierVisible: string | undefined;
  const translator: ContentTranslator = {
    async translate(texts) {
      sent.push(texts.length);
      if (sent.length === 2) {
        earlierVisible = nodes[0]?.data;
      }
      return texts.map((text) => `【译】${text}`);
    },
    async translateEventNames(texts) { return [...texts]; }
  };
  const { runtime } = makeRuntime(document, translator, []);
  await runtime.start();
  assert.deepEqual(sent, [20, 20, 5]);
  assert.equal(earlierVisible, '【译】This is the English page announcement number 0.');
  assert.equal(nodes[44]?.data, '【译】This is the English page announcement number 44.');
});

test('page batching also bounds characters and preserves a single oversized record intact', () => {
  const records = [{ original: 'a'.repeat(4000) }, { original: 'b'.repeat(4000) }, { original: 'c'.repeat(8000) }];
  assert.deepEqual(partitionPageRecords(records), [[records[0]], [records[1]], [records[2]]]);
});

test('lower statistics screenshot labels render offline with their values intact and restore across toggles', async () => {
  const document = new FakeDocument('/stats/players/21167/donk');
  const body = new FakeElement(document, 'body');
  const samples = [
    ['Statistics', '数据统计', ''],
    ['Total kills', '总击杀数', '10292'],
    ['Headshot %', '爆头率', '61.1%'],
    ['Total deaths', '总死亡数', '7438'],
    ['K/D Ratio', '击杀/死亡比', '1.38'],
    ['Damage / Round', '每回合平均伤害', '96.7'],
    ['Grenade dmg / Round', '每回合投掷物伤害', '3.6'],
    ['Maps played', '已打地图数', '512'],
    ['Rounds played', '已打回合数', '11105'],
    ['Kills / round', '每回合击杀数', '0.93'],
    ['Assists / round', '每回合助攻数', '0.22'],
    ['Deaths / round', '每回合死亡数', '0.67'],
    ['Saved by teammate / round', '每回合被队友救下次数', '0.11'],
    ['Saved teammates / round', '每回合救下队友次数', '0.16'],
    ['Impact rating', '影响力评分', '1.62'],
    ['Featured ratings', '对阵强队评分', '']
  ] as const;
  const rows = samples.map(([source, , value]) => {
    const row = new FakeElement(document, 'div');
    const label = new FakeElement(document, 'span');
    label.setAttribute('data-tooltip-id', 'stats-help');
    const text = label.appendChild(document.createTextNode(source));
    row.appendChild(label);
    const number = row.appendChild(document.createTextNode(value));
    body.appendChild(row);
    return { text, number };
  });
  const names = ['donk', 'Danil Kryshkovets', 'Spirit'].map((name) => body.appendChild(document.createTextNode(name)));
  const script = new FakeElement(document, 'script');
  const scriptText = script.appendChild(document.createTextNode('Statistics'));
  body.appendChild(script);
  const editable = new FakeElement(document, 'div');
  editable.setAttribute('contenteditable', 'true');
  const draft = editable.appendChild(document.createTextNode('Total kills'));
  body.appendChild(editable);
  const score = new FakeElement(document, 'span', ['match-team-livescore']);
  const liveValue = score.appendChild(document.createTextNode('13'));
  body.appendChild(score);
  document.addCandidate('body', body);
  const translator = new CountingTranslator();
  const runtime = createContentRuntime({
    document: asDocument(document), translator, fixedUiGlossary: await statsGlossary(),
    observerFactory: (callback) => new FakeObserver(callback) as unknown as MutationObserver
  });
  await runtime.start();
  assert.deepEqual(rows.map(({ text }) => text.data), samples.map(([, target]) => target));
  assert.deepEqual(rows.map(({ number }) => number.data), samples.map(([, , value]) => value));
  assert.deepEqual(names.map((name) => name.data), ['donk', 'Danil Kryshkovets', 'Spirit']);
  assert.deepEqual([scriptText.data, draft.data, liveValue.data], ['Statistics', 'Total kills', '13']);
  assert.deepEqual(translator.contextualCalls, []);
  await runtime.setEnabled(false);
  assert.deepEqual(rows.map(({ text }) => text.data), samples.map(([source]) => source));
  await runtime.setEnabled(true);
  assert.deepEqual(rows.map(({ text }) => text.data), samples.map(([, target]) => target));
  const added = body.appendChild(document.createTextNode('Featured ratings'));
  await runtime.requestScan();
  assert.equal(added.data, '对阵强队评分');
});

test('statistics compound labels keep meaning across separate inline text nodes', async () => {
  const document = new FakeDocument('/stats/players/21167/donk');
  const body = new FakeElement(document, 'body');
  const both = new FakeElement(document, 'button');
  const bothWord = new FakeElement(document, 'strong');
  const bothText = bothWord.appendChild(document.createTextNode('Both'));
  both.appendChild(bothWord);
  const sides = both.appendChild(document.createTextNode(' Sides'));
  body.appendChild(both);
  const ct = body.appendChild(document.createTextNode('CT'));
  const side = body.appendChild(document.createTextNode(' Side'));
  const combined = body.appendChild(document.createTextNode('Kills / round 0.93'));
  const rating = body.appendChild(document.createTextNode('Rating 3.0'));
  document.addCandidate('body', body);
  const translator = new CountingTranslator();
  const runtime = createContentRuntime({
    document: asDocument(document), translator, fixedUiGlossary: await statsGlossary(),
    observerFactory: (callback) => new FakeObserver(callback) as unknown as MutationObserver
  });
  await runtime.start();
  assert.deepEqual([bothText.data, sides.data, ct.data, side.data, combined.data, rating.data], [
    '全部', ' 阵营', '防守方', ' 阵营', '每回合击杀数 0.93', '评分 3.0'
  ]);
  assert.deepEqual(translator.contextualCalls, []);
  await runtime.setEnabled(false);
  assert.deepEqual([both.textContent, ct.data, side.data, combined.data], ['Both Sides', 'CT', ' Side', 'Kills / round 0.93']);
});

test('known statistics hover and accessible labels translate and restore while unknown attributes stay original', async () => {
  const glossary = await statsGlossary();
  for (const pathname of ['/stats/players/21167/donk', '/news/1/example']) {
    const document = new FakeDocument(pathname);
    const help = new FakeElement(document, 'div');
    const original = 'Measures the impact made from multikills, opening kills, and clutches.';
    help.setAttribute('title', original);
    const accessible = new FakeElement(document, 'button');
    accessible.setAttribute('aria-label', 'Eco-adjust stats');
    const identity = new FakeElement(document, 'img');
    identity.setAttribute('title', "Danil 'donk' Kryshkovets");
    document.addCandidate('[title]', help);
    document.addCandidate('[title]', identity);
    document.addCandidate('[aria-label]', accessible);
    const translator = new CountingTranslator();
    let observer: FakeObserver | undefined;
    const runtime = createContentRuntime({
      document: asDocument(document), translator, fixedUiGlossary: glossary,
      observerFactory: (callback) => {
        observer = new FakeObserver(callback);
        return observer as unknown as MutationObserver;
      }
    });
    await runtime.start();
    assert.equal(observer?.options?.attributes, true);
    assert.deepEqual(observer?.options?.attributeFilter, ['placeholder', 'title', 'aria-label']);
    assert.equal(help.getAttribute('title'), pathname.startsWith('/stats/') ? '衡量多杀、首杀和残局带来的影响。' : original);
    assert.equal(accessible.getAttribute('aria-label'), pathname.startsWith('/stats/') ? '按经济差异调整数据' : 'Eco-adjust stats');
    assert.equal(identity.getAttribute('title'), "Danil 'donk' Kryshkovets");
    await runtime.setMode('B');
    assert.equal(help.getAttribute('title'), original);
    await runtime.setMode('A');
    help.setAttribute('title', 'Deaths per round');
    observer?.emit([{ type: 'attributes', target: asNode(help), attributeName: 'title' } as MutationRecord]);
    await flushObserver();
    assert.equal(help.getAttribute('title'), pathname.startsWith('/stats/') ? '每回合死亡数' : 'Deaths per round');
    help.setAttribute('title', 'Unknown new page hint');
    await runtime.requestScan();
    await runtime.setEnabled(false);
    assert.equal(help.getAttribute('title'), 'Unknown new page hint');
    assert.equal(accessible.getAttribute('aria-label'), 'Eco-adjust stats');
    assert.deepEqual(translator.contextualCalls, []);
  }
});

test('statistics attribute labels respect protected elements and ancestor subtrees', async () => {
  const document = new FakeDocument('/stats/players/21167/donk');
  const protectedParents = [
    new FakeElement(document, 'span', ['match-team-livescore']),
    new FakeElement(document, 'div', ['forum']),
    new FakeElement(document, 'div'),
    new FakeElement(document, 'div'),
    new FakeElement(document, 'div'),
    new FakeElement(document, 'div'),
    new FakeElement(document, 'div'),
    new FakeElement(document, 'span')
  ];
  protectedParents[2]?.setAttribute('data-livescore-match', '123');
  protectedParents[3]?.setAttribute('contenteditable', 'true');
  protectedParents[4]?.setAttribute('data-time-format', 'HH:mm');
  protectedParents[4]?.setAttribute('data-unix', '123');
  protectedParents[5]?.setAttribute('data-countdown-target-timestamp', '123');
  protectedParents[6]?.setAttribute('role', 'textbox');
  protectedParents[7]?.setAttribute('data-livescore-server-url', 'https://example.invalid');
  const nested = protectedParents.map((parent) => {
    parent.setAttribute('title', 'CT');
    document.addCandidate('[title]', parent);
    const child = new FakeElement(document, 'span');
    child.setAttribute('aria-label', 'Total kills');
    parent.appendChild(child);
    document.addCandidate('[aria-label]', child);
    return child;
  });
  const translator = new CountingTranslator();
  const runtime = createContentRuntime({
    document: asDocument(document), translator, fixedUiGlossary: await statsGlossary(),
    observerFactory: (callback) => new FakeObserver(callback) as unknown as MutationObserver
  });
  await runtime.start();
  assert.deepEqual(protectedParents.map((element) => element.getAttribute('title')), ['CT', 'CT', 'CT', 'CT', 'CT', 'CT', 'CT', 'CT']);
  assert.deepEqual(nested.map((element) => element.getAttribute('aria-label')), ['Total kills', 'Total kills', 'Total kills', 'Total kills', 'Total kills', 'Total kills', 'Total kills', 'Total kills']);
  const newlyProtected = new FakeElement(document, 'span');
  newlyProtected.setAttribute('title', 'CT');
  document.addCandidate('[title]', newlyProtected);
  await runtime.requestScan();
  assert.equal(newlyProtected.getAttribute('title'), '防守方');
  newlyProtected.setAttribute('contenteditable', 'true');
  await runtime.requestScan();
  assert.equal(newlyProtected.getAttribute('title'), 'CT');
  assert.deepEqual(translator.contextualCalls, []);
});

test('page-level livescore server metadata does not block static statistics help', async () => {
  const document = new FakeDocument('/stats/players/21167/donk');
  const body = new FakeElement(document, 'body');
  body.setAttribute('data-livescore-server-url', 'https://example.invalid');
  const row = new FakeElement(document, 'div', ['stats-row']);
  row.setAttribute('title', 'Data from 2016 and onward only, be wary of your sample size.');
  body.appendChild(row);
  document.addCandidate('[title]', row);
  const translator = new CountingTranslator();
  const runtime = createContentRuntime({
    document: asDocument(document), translator, fixedUiGlossary: await statsGlossary(),
    observerFactory: (callback) => new FakeObserver(callback) as unknown as MutationObserver
  });
  await runtime.start();
  assert.equal(row.getAttribute('title'), '数据仅包含 2016 年及之后的比赛，请注意样本量。');
  await runtime.setEnabled(false);
  assert.equal(row.getAttribute('title'), 'Data from 2016 and onward only, be wary of your sample size.');
  assert.deepEqual(translator.contextualCalls, []);
});

test('observed date hints and transfer statuses translate while selected dates and team identities stay intact', async () => {
  const document = new FakeDocument('/stats/players/21167/donk');
  const body = new FakeElement(document, 'body');
  body.setAttribute('data-livescore-server-url', 'https://example.invalid');
  const hints = ['Start date', 'End date', 'Add to context..'].map((source) => {
    const input = new FakeElement(document, 'input');
    input.setAttribute('placeholder', source);
    input.setAttribute('value', '2026-09-01');
    body.appendChild(input);
    document.addCandidate('input[placeholder]', input);
    return input;
  });
  const texts = ['TOP 30 TRANSFERS', 'BENCH', 'No team', 'G2'].map((source) => body.appendChild(document.createTextNode(source)));
  document.addCandidate('body', body);
  const translator = new CountingTranslator();
  const runtime = createContentRuntime({
    document: asDocument(document), translator, fixedUiGlossary: await statsGlossary(),
    observerFactory: (callback) => new FakeObserver(callback) as unknown as MutationObserver
  });
  await runtime.start();
  assert.deepEqual(hints.map((input) => input.getAttribute('placeholder')), ['开始日期', '结束日期', '添加战队、选手或赛事']);
  assert.deepEqual(hints.map((input) => input.getAttribute('value')), ['2026-09-01', '2026-09-01', '2026-09-01']);
  assert.deepEqual(texts.map((node) => node.data), ['近期前30转会', '替补席', '暂无战队', 'G2']);
  assert.deepEqual(translator.contextualCalls, []);
  await runtime.setEnabled(false);
  assert.deepEqual(hints.map((input) => input.getAttribute('placeholder')), ['Start date', 'End date', 'Add to context..']);
  assert.deepEqual(texts.map((node) => node.data), ['TOP 30 TRANSFERS', 'BENCH', 'No team', 'G2']);
});
