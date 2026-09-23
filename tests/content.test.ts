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
import type { TranslationContext, TranslationPurpose } from '../src/core/translate/index.ts';

type FakeNode = FakeElement | FakeText;

class FakeDocument {
  private readonly candidates = new Map<string, FakeElement[]>();

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
  disconnectCount = 0;
  private readonly callback: MutationCallback;

  constructor(callback: MutationCallback) {
    this.callback = callback;
  }

  observe(_target: Node, _options: MutationObserverInit): void {
    this.observed = true;
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

test('an original-text mismatch is recorded and never falls back to container assignment', async () => {
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
  assert.equal(event.childNodes.length, 1);
  assert.equal(
    diagnostics.some((diagnostic) => diagnostic.code === 'original-mismatch'),
    true
  );
});

test('the wiring stub returns a conspicuous translation without network access', async () => {
  const translator = createStubTranslationService();

  assert.deepEqual(await translator.translate(['Aurora']), ['【译】Aurora']);
  assert.deepEqual(
    await translator.translateEventNames(['StarLadder StarSeries']),
    ['【译】StarLadder StarSeries']
  );
});
