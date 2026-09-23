import {
  createDisplayRecordTable,
  decideRenderIntent,
  DISPLAY_SELECTORS,
  getTranslationContextForStrategyId,
  resolveElementStrategy,
  type DisplayMode,
  type DisplayNodeInfo,
  type DisplayRecordTable
} from '../core/display/index.ts';
import type { TranslationService } from '../core/translate/index.ts';
import type { TranslationContext, TranslationPurpose } from '../core/translate/index.ts';

export type ContentTranslator = Pick<
  TranslationService,
  'translate' | 'translateEventNames'
> & {
  translateWithContext?: (
    texts: string[],
    context: TranslationContext,
    purpose: TranslationPurpose
  ) => Promise<string[]>;
  clearSessionCache?: () => void;
};

export interface ContentScanOptions {
  retryFailedTranslations?: boolean;
  refreshTranslations?: boolean;
  reapplyRecords?: boolean;
}

export interface ContentRuntimeSetterOptions {
  rescan?: boolean;
}

export type ContentDiagnosticCode =
  | 'register-rejected'
  | 'missing-text-node'
  | 'original-mismatch'
  | 'rendered-text-changed'
  | 'invalid-translation'
  | 'translation-error'
  | 'observer-error';

export interface ContentDiagnostic {
  code: ContentDiagnosticCode;
  key?: string;
  message: string;
}

export interface ContentRuntimeStats {
  processedNodes: number;
  skippedNodes: number;
  mode: DisplayMode;
  enabled: boolean;
}

export interface ContentRuntimeOptions {
  document: Document;
  translator: ContentTranslator;
  initialMode?: DisplayMode;
  initialEnabled?: boolean;
  observerFactory?: (callback: MutationCallback) => MutationObserver;
  onDiagnostic?: (diagnostic: ContentDiagnostic) => void;
}

export interface ContentRuntime {
  start(): Promise<void>;
  setEnabled(
    enabled: boolean,
    options?: ContentRuntimeSetterOptions
  ): Promise<void>;
  setMode(
    mode: DisplayMode,
    options?: ContentRuntimeSetterOptions
  ): Promise<void>;
  requestScan(options?: ContentScanOptions): Promise<void>;
  stats(): ContentRuntimeStats;
}

type RenderedState =
  | {
      kind: 'replace-text';
      textNode: Text;
      translatedText: string;
    }
  | {
      kind: 'append-sibling';
      textNode: Text;
      sibling: Element;
    };

interface PendingRecord {
  key: string;
  strategyId: string;
  original: string;
  context: TranslationContext;
}

const observerOptions: MutationObserverInit = {
  subtree: true,
  childList: true,
  characterData: true
};

function elementInfo(element: Element): DisplayNodeInfo['parent'] {
  const attributes: Record<string, string> = {};
  for (const attribute of Array.from(element.attributes)) {
    attributes[attribute.name] = attribute.value;
  }

  return {
    tagName: element.tagName,
    classes: Array.from(element.classList),
    attributes
  };
}

function isMarkedElement(element: Element): boolean {
  return element.getAttribute('data-hltv-zh') === '1';
}

function isInMarkedSubtree(node: Node): boolean {
  if (node.nodeType === 1 && isMarkedElement(node as Element)) {
    return true;
  }

  let parent = node.parentElement;
  while (parent !== null) {
    if (isMarkedElement(parent)) {
      return true;
    }
    parent = parent.parentElement;
  }
  return false;
}

function collectTextNodes(
  element: Element,
  candidateElements: ReadonlySet<Element>
): Text[] {
  const result: Text[] = [];

  function visit(node: Node): void {
    if (node.nodeType === 3) {
      result.push(node as Text);
      return;
    }

    if (node.nodeType !== 1 || isMarkedElement(node as Element)) {
      return;
    }

    // A nested selector owns its subtree; the outer candidate must not
    // assign the inner text to the outer element's strategy.
    if (candidateElements.has(node as Element)) {
      return;
    }

    for (const child of Array.from(node.childNodes)) {
      visit(child);
    }
  }

  for (const child of Array.from(element.childNodes)) {
    visit(child);
  }
  return result;
}

function findMarkedSibling(textNode: Text): Element | undefined {
  const sibling = textNode.nextSibling;
  if (sibling !== null && sibling.nodeType === 1 && isMarkedElement(sibling as Element)) {
    return sibling as Element;
  }
  return undefined;
}

class ContentRuntimeImpl implements ContentRuntime {
  private readonly document: Document;
  private readonly translator: ContentTranslator;
  private readonly records: DisplayRecordTable = createDisplayRecordTable();
  private readonly textNodes = new Map<string, Text>();
  private readonly rendered = new Map<string, RenderedState>();
  // Text nodes cannot carry element attributes, so this WeakSet is their DOM-safe processed marker.
  private markedTextNodes = new WeakSet<Text>();
  private nodeKeys = new WeakMap<Text, string>();
  private readonly onDiagnostic?: (diagnostic: ContentDiagnostic) => void;
  private readonly observerFactory: (callback: MutationCallback) => MutationObserver;
  private observer: MutationObserver | undefined;
  private scanChain: Promise<void> = Promise.resolve();
  private nextNodeId = 1;
  private skippedNodes = new Set<string>();
  private mode: DisplayMode;
  private enabled: boolean;
  private started = false;

  constructor(options: ContentRuntimeOptions) {
    this.document = options.document;
    this.translator = options.translator;
    this.mode = options.initialMode ?? 'A';
    this.enabled = options.initialEnabled ?? true;
    this.onDiagnostic = options.onDiagnostic;
    this.observerFactory =
      options.observerFactory ?? ((callback) => new MutationObserver(callback));
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    this.started = true;
    this.observer = this.observerFactory((records) => {
      this.handleMutations(records);
    });

    if (this.enabled) {
      this.observe();
      await this.requestScan();
    }
  }

  async setEnabled(
    enabled: boolean,
    options: ContentRuntimeSetterOptions = {}
  ): Promise<void> {
    if (this.enabled === enabled && this.started) {
      return;
    }

    this.enabled = enabled;
    if (!this.started) {
      return;
    }

    if (!enabled) {
      this.observer?.disconnect();
      for (const key of Array.from(this.rendered.keys())) {
        this.clearRendered(key);
      }
      this.records.clear();
      this.textNodes.clear();
      this.rendered.clear();
      this.markedTextNodes = new WeakSet<Text>();
      this.nodeKeys = new WeakMap<Text, string>();
      this.skippedNodes.clear();
      return;
    }

    this.observe();
    if (options.rescan !== false) {
      await this.requestScan({ retryFailedTranslations: true });
    }
  }

  async setMode(
    mode: DisplayMode,
    options: ContentRuntimeSetterOptions = {}
  ): Promise<void> {
    const changed = this.mode !== mode;
    this.mode = mode;
    if (!this.started || !this.enabled || options.rescan === false) {
      return;
    }

    await this.requestScan({
      retryFailedTranslations: true,
      reapplyRecords: changed
    });
  }

  stats(): ContentRuntimeStats {
    return {
      processedNodes: this.records.size(),
      skippedNodes: this.skippedNodes.size,
      mode: this.mode,
      enabled: this.enabled
    };
  }

  private observe(): void {
    this.observer?.observe(this.document, observerOptions);
  }

  private report(diagnostic: ContentDiagnostic): void {
    if (diagnostic.key !== undefined) {
      this.skippedNodes.add(diagnostic.key);
    }
    this.onDiagnostic?.(diagnostic);
  }

  private keyFor(textNode: Text): string {
    const existing = this.nodeKeys.get(textNode);
    if (existing !== undefined) {
      return existing;
    }

    const key = `content-text-${this.nextNodeId}`;
    this.nextNodeId += 1;
    this.nodeKeys.set(textNode, key);
    return key;
  }

  async requestScan(options: ContentScanOptions = {}): Promise<void> {
    if (!this.started || !this.enabled) {
      if (options.refreshTranslations) {
        this.translator.clearSessionCache?.();
      }
      return;
    }

    this.scanChain = this.scanChain
      .then(async () => {
        if (!this.enabled) {
          return;
        }

        if (options.refreshTranslations) {
          this.translator.clearSessionCache?.();
        }
        if (options.refreshTranslations || options.retryFailedTranslations) {
          for (const record of this.records.entries()) {
            if (
              record.strategy.translation === 'allowed' &&
              (options.refreshTranslations || record.translated === record.original)
            ) {
              this.records.updateTranslation(record.node.key, undefined);
            }
          }
        }
        if (options.reapplyRecords) {
          for (const record of this.records.entries()) {
            await this.applyRecord(record.node.key);
          }
        }
        await this.scan();
      })
      .catch((error: unknown) => {
        this.report({
          code: 'observer-error',
          message: error instanceof Error ? error.message : String(error)
        });
      });
    await this.scanChain;
  }

  private collectCandidates(): Element[] {
    const candidates: Element[] = [];
    const seen = new Set<Element>();

    for (const definition of DISPLAY_SELECTORS) {
      for (const element of Array.from(
        this.document.querySelectorAll(definition.selector)
      )) {
        if (!seen.has(element)) {
          seen.add(element);
          candidates.push(element);
        }
      }
    }

    return candidates;
  }

  private async scan(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const pending: PendingRecord[] = [];
    const candidates = this.collectCandidates();
    const candidateElements = new Set(candidates);

    for (const candidate of candidates) {
      if (isMarkedElement(candidate)) {
        continue;
      }

      const strategy = resolveElementStrategy(elementInfo(candidate));
      for (const textNode of collectTextNodes(candidate, candidateElements)) {
        if (textNode.data.trim().length === 0 || isInMarkedSubtree(textNode)) {
          continue;
        }

        const key = this.keyFor(textNode);
        const existing = this.records.get(key);
        if (existing !== undefined) {
          if (textNode.data !== existing.original && !this.markedTextNodes.has(textNode)) {
            this.report({
              code: 'original-mismatch',
              key,
              message: 'The page changed the original text; this node was not retranslated.'
            });
          }
          if (
            existing.translated === undefined &&
            existing.strategy.translation === 'allowed' &&
            (textNode.data === existing.original || this.markedTextNodes.has(textNode))
          ) {
            pending.push({
              key,
              strategyId: existing.strategy.id,
              original: existing.original,
              context: getTranslationContextForStrategyId(existing.strategy.id)
            });
          }
          continue;
        }

        const node: DisplayNodeInfo = {
          key,
          parent: elementInfo(textNode.parentElement ?? candidate)
        };
        if (!this.records.register(node, textNode.data, strategy)) {
          this.report({
            code: 'register-rejected',
            key,
            message: 'The display record was not registered; the node was skipped.'
          });
          continue;
        }

        this.textNodes.set(key, textNode);
        pending.push({
          key,
          strategyId: strategy.id,
          original: textNode.data,
          context: getTranslationContextForStrategyId(strategy.id)
        });
      }
    }

    const groups = new Map<
      string,
      { context: TranslationContext; purpose: TranslationPurpose; records: PendingRecord[] }
    >();
    for (const record of pending) {
      const current = this.records.get(record.key);
      if (current?.strategy.translation !== 'allowed') {
        continue;
      }
      const purpose: TranslationPurpose =
        record.strategyId === 'match-event' ? 'event-name' : 'plain';
      const groupKey = `${record.context}\u0000${purpose}`;
      const group = groups.get(groupKey) ?? {
        context: record.context,
        purpose,
        records: []
      };
      group.records.push(record);
      groups.set(groupKey, group);
    }

    const translationsByKey = new Map<string, string>();
    await Promise.all(
      Array.from(groups.values(), async (group) => {
        const translations = await this.translate(
          group.records.map((record) => record.original),
          group.purpose,
          group.context
        );
        group.records.forEach((record, index) => {
          translationsByKey.set(record.key, translations[index] ?? record.original);
        });
      })
    );

    for (const record of pending) {
      const current = this.records.get(record.key);
      if (current === undefined) {
        continue;
      }

      if (current.strategy.translation === 'allowed') {
        this.records.updateTranslation(
          record.key,
          translationsByKey.get(record.key) ?? record.original
        );
      }
      await this.applyRecord(record.key);
    }
  }

  private async translate(
    texts: string[],
    purpose: TranslationPurpose,
    context: TranslationContext
  ): Promise<string[]> {
    if (texts.length === 0) {
      return [];
    }

    try {
      const translations = this.translator.translateWithContext !== undefined
        ? await this.translator.translateWithContext(texts, context, purpose)
        : purpose === 'event-name'
          ? await this.translator.translateEventNames(texts)
          : await this.translator.translate(texts);
      if (
        translations.length !== texts.length ||
        translations.some((translation) => typeof translation !== 'string')
      ) {
        this.report({
          code: 'invalid-translation',
          message: 'The injected translator returned an invalid result; originals were retained.'
        });
        return [...texts];
      }
      return translations;
    } catch (error) {
      this.report({
        code: 'translation-error',
        message: error instanceof Error ? error.message : String(error)
      });
      return [...texts];
    }
  }

  private async applyRecord(key: string): Promise<void> {
    const record = this.records.get(key);
    if (record === undefined) {
      return;
    }

    this.clearRendered(key);
    const intent = decideRenderIntent(
      record.node,
      record.original,
      record.translated,
      this.mode,
      record.strategy
    );

    if (intent.kind === 'noop') {
      this.skippedNodes.add(key);
      return;
    }

    const textNode = this.textNodes.get(key);
    if (textNode === undefined) {
      this.report({
        code: 'missing-text-node',
        key,
        message: 'The original text node could not be located; no container fallback was used.'
      });
      return;
    }

    if (textNode.data !== intent.originalText) {
      this.report({
        code: 'original-mismatch',
        key,
        message: 'The located text node no longer contains the recorded original; no DOM fallback was used.'
      });
      return;
    }

    if (intent.kind === 'replace-text') {
      this.withObserverSuspended(() => {
        textNode.data = intent.translatedText;
      });
      this.markedTextNodes.add(textNode);
      this.rendered.set(key, {
        kind: 'replace-text',
        textNode,
        translatedText: intent.translatedText
      });
      this.skippedNodes.delete(key);
      return;
    }

    const existingSibling = findMarkedSibling(textNode);
    if (existingSibling !== undefined) {
      this.rendered.set(key, {
        kind: 'append-sibling',
        textNode,
        sibling: existingSibling
      });
      this.skippedNodes.delete(key);
      return;
    }

    const parent = textNode.parentElement;
    if (parent === null) {
      this.report({
        code: 'missing-text-node',
        key,
        message: 'The original text node has no parent; no sibling was created.'
      });
      return;
    }

    const sibling = this.document.createElement('span');
    this.withObserverSuspended(() => {
      sibling.setAttribute('data-hltv-zh', '1');
      sibling.setAttribute('translate', 'no');
      sibling.appendChild(this.document.createTextNode(intent.translatedText));
      parent.insertBefore(sibling, textNode.nextSibling);
    });

    this.rendered.set(key, {
      kind: 'append-sibling',
      textNode,
      sibling
    });
    this.skippedNodes.delete(key);
  }

  private clearRendered(key: string): void {
    const state = this.rendered.get(key);
    if (state === undefined) {
      return;
    }

    if (state.kind === 'replace-text') {
      if (state.textNode.data === state.translatedText) {
        const record = this.records.get(key);
        if (record !== undefined) {
          this.withObserverSuspended(() => {
            state.textNode.data = record.original;
          });
        }
      } else {
        this.report({
          code: 'rendered-text-changed',
          key,
          message: 'The page changed text rendered by the extension; it was not overwritten.'
        });
      }
      this.rendered.delete(key);
      return;
    }

    const parent = state.sibling.parentElement;
    if (parent !== null && isMarkedElement(state.sibling)) {
      this.withObserverSuspended(() => {
        parent.removeChild(state.sibling);
      });
    }
    this.rendered.delete(key);
  }

  private withObserverSuspended(action: () => void): void {
    const observer = this.observer;
    if (observer === undefined) {
      action();
      return;
    }

    observer.disconnect();
    try {
      action();
    } finally {
      observer.takeRecords();
      if (this.enabled) {
        this.observe();
      }
    }
  }

  private handleMutations(records: MutationRecord[]): void {
    if (!this.enabled) {
      return;
    }

    let shouldScan = false;
    for (const record of records) {
      if (record.type === 'characterData') {
        const textNode = record.target as Text;
        if (this.markedTextNodes.has(textNode) || isInMarkedSubtree(textNode)) {
          continue;
        }
        shouldScan = true;
        continue;
      }

      if (record.type === 'childList') {
        if (isInMarkedSubtree(record.target)) {
          continue;
        }

        const addedNodes = Array.from(record.addedNodes);
        if (addedNodes.length > 0 && addedNodes.every((node) => isInMarkedSubtree(node))) {
          continue;
        }
        shouldScan = true;
      }
    }

    if (shouldScan) {
      void this.requestScan();
    }
  }
}

export function createContentRuntime(options: ContentRuntimeOptions): ContentRuntime {
  return new ContentRuntimeImpl(options);
}
