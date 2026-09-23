import { DISPLAY_SELECTORS, type SelectorDefinition, type SelectorId, type SelectorMatcher } from './selectors.ts';
import type { TranslationContext } from '../../shared/translation-context.ts';

export { DISPLAY_SELECTORS };
export type { SelectorDefinition, SelectorId, SelectorMatcher };

export function getTranslationContextForStrategyId(
  strategyId: string
): TranslationContext {
  switch (strategyId) {
    case 'match-event':
    case 'match-stage':
    case 'match-meta':
    case 'match-time':
    case 'match-teamname':
      return 'structured';
    case 'news-title':
    case 'news-body':
    case 'article-body':
      return 'prose';
    case 'comment':
    case 'comment-body':
    case 'forum-comment':
    default:
      return 'comment';
  }
}

export type DisplayMode = 'A' | 'B';

export type DisplayNodeKey = string;

export interface DisplayElementInfo {
  tagName: string;
  classes: readonly string[];
  attributes: Readonly<Record<string, string>>;
}

export interface DisplayNodeInfo {
  key: DisplayNodeKey;
  parent: DisplayElementInfo;
}

export type TranslationPolicy = 'never' | 'allowed';

export interface ElementStrategy {
  id: string;
  selectorId?: SelectorId;
  translation: TranslationPolicy;
  allowedModes: readonly DisplayMode[];
  priority: number;
  rationale: string;
}

export const ELEMENT_STRATEGIES: readonly ElementStrategy[] = [
  {
    id: 'time-format-unix',
    selectorId: 'time-format-unix',
    translation: 'never',
    allowedModes: [],
    priority: 100,
    rationale:
      'Global dynamic time rule: data-time-format and data-unix values are rewritten by the page.'
  },
  {
    id: 'countdown-target',
    selectorId: 'countdown-target',
    translation: 'never',
    allowedModes: [],
    priority: 95,
    rationale:
      'Countdown content is overwritten by the page timer and must not be translated.'
  },
  {
    id: 'current-map-score',
    selectorId: 'current-map-score',
    translation: 'never',
    allowedModes: [],
    priority: 90,
    rationale: 'Socket.IO live score updates make translated values stale.'
  },
  {
    id: 'match-team-livescore',
    selectorId: 'match-team-livescore',
    translation: 'never',
    allowedModes: [],
    priority: 90,
    rationale: 'Live score values are page-written and must remain untouched.'
  },
  {
    id: 'match-stage',
    selectorId: 'match-stage',
    translation: 'allowed',
    allowedModes: ['A'],
    priority: 70,
    rationale: 'Fixed dimensions make sibling insertion unsafe; replacement is allowed.'
  },
  {
    id: 'match-meta',
    selectorId: 'match-meta',
    translation: 'allowed',
    allowedModes: ['A'],
    priority: 70,
    rationale: 'Fixed width makes sibling insertion unsafe; replacement is allowed.'
  },
  {
    id: 'match-time',
    selectorId: 'match-time',
    translation: 'never',
    allowedModes: [],
    priority: 65,
    rationale:
      'Match-time is treated as a whole as never-translate; this is equivalent to applying the global dynamic-value guard per element and is harder to miss.'
  },
  {
    id: 'match-teamname',
    selectorId: 'match-teamname',
    translation: 'never',
    allowedModes: [],
    priority: 60,
    rationale: 'Canonical team names remain unchanged.'
  },
  {
    id: 'match-event',
    selectorId: 'match-event',
    translation: 'allowed',
    allowedModes: ['A', 'B'],
    priority: 50,
    rationale: 'The inspected match-event layout has no fixed width or height constraint.'
  },
  {
    id: 'default-no-translation',
    translation: 'never',
    allowedModes: [],
    priority: 0,
    rationale: 'Unknown elements are conservative by default.'
  }
];

const selectorById = new Map<SelectorId, SelectorDefinition>(
  DISPLAY_SELECTORS.map((definition) => [definition.id, definition])
);

function hasAttribute(
  element: DisplayElementInfo,
  name: string
): boolean {
  return Object.prototype.hasOwnProperty.call(element.attributes, name);
}

function matchesSelector(
  element: DisplayElementInfo,
  matcher: SelectorMatcher
): boolean {
  if (matcher.kind === 'class') {
    return element.classes.includes(matcher.value);
  }

  return matcher.names.every((name) => hasAttribute(element, name));
}

export function resolveElementStrategy(
  element: DisplayElementInfo
): ElementStrategy {
  const matched = ELEMENT_STRATEGIES.filter((strategy) => {
    if (strategy.selectorId === undefined) {
      return false;
    }

    const selector = selectorById.get(strategy.selectorId);
    return selector !== undefined && matchesSelector(element, selector.matcher);
  }).sort((left, right) => right.priority - left.priority);

  return matched[0] ?? ELEMENT_STRATEGIES[ELEMENT_STRATEGIES.length - 1];
}

export type NoopReason =
  | 'policy-never'
  | 'mode-not-allowed'
  | 'same-text'
  | 'empty-original'
  | 'empty-translation';

export type RenderIntent =
  | {
      kind: 'noop';
      nodeKey: DisplayNodeKey;
      originalText: string;
      strategyId: string;
      reason: NoopReason;
    }
  | {
      kind: 'replace-text';
      nodeKey: DisplayNodeKey;
      originalText: string;
      translatedText: string;
      strategyId: string;
    }
  | {
      kind: 'append-sibling';
      nodeKey: DisplayNodeKey;
      originalText: string;
      translatedText: string;
      strategyId: string;
      attributes: {
        readonly 'data-hltv-zh': '1';
        readonly translate: 'no';
      };
    };

export function decideRenderIntent(
  node: DisplayNodeInfo,
  original: string,
  translated: string | undefined,
  mode: DisplayMode,
  strategy: ElementStrategy
): RenderIntent {
  if (strategy.translation === 'never') {
    return {
      kind: 'noop',
      nodeKey: node.key,
      originalText: original,
      strategyId: strategy.id,
      reason: 'policy-never'
    };
  }

  if (original.length === 0) {
    return {
      kind: 'noop',
      nodeKey: node.key,
      originalText: original,
      strategyId: strategy.id,
      reason: 'empty-original'
    };
  }

  if (translated === undefined || translated.length === 0) {
    return {
      kind: 'noop',
      nodeKey: node.key,
      originalText: original,
      strategyId: strategy.id,
      reason: 'empty-translation'
    };
  }

  if (translated === original) {
    return {
      kind: 'noop',
      nodeKey: node.key,
      originalText: original,
      strategyId: strategy.id,
      reason: 'same-text'
    };
  }

  if (!strategy.allowedModes.includes(mode)) {
    return {
      kind: 'noop',
      nodeKey: node.key,
      originalText: original,
      strategyId: strategy.id,
      reason: 'mode-not-allowed'
    };
  }

  if (mode === 'A') {
    return {
      kind: 'replace-text',
      nodeKey: node.key,
      originalText: original,
      translatedText: translated,
      strategyId: strategy.id
    };
  }

  return {
    kind: 'append-sibling',
    nodeKey: node.key,
    originalText: original,
    translatedText: translated,
    strategyId: strategy.id,
    attributes: {
      'data-hltv-zh': '1',
      translate: 'no'
    }
  };
}

export interface DisplayRecord {
  node: DisplayNodeInfo;
  original: string;
  translated?: string;
  strategy: ElementStrategy;
}

export interface DisplayRecordTable {
  register(
    node: DisplayNodeInfo,
    original: string,
    strategy: ElementStrategy
  ): boolean;
  get(key: DisplayNodeKey): DisplayRecord | undefined;
  updateTranslation(key: DisplayNodeKey, translated: string | undefined): boolean;
  remove(key: DisplayNodeKey): boolean;
  clear(): void;
  size(): number;
  entries(): readonly DisplayRecord[];
  decideAll(mode: DisplayMode): RenderIntent[];
}

function cloneNode(node: DisplayNodeInfo): DisplayNodeInfo {
  return {
    key: node.key,
    parent: {
      tagName: node.parent.tagName,
      classes: [...node.parent.classes],
      attributes: { ...node.parent.attributes }
    }
  };
}

function cloneStrategy(strategy: ElementStrategy): ElementStrategy {
  return {
    ...strategy,
    allowedModes: [...strategy.allowedModes]
  };
}

function cloneRecord(record: DisplayRecord): DisplayRecord {
  return {
    node: cloneNode(record.node),
    original: record.original,
    translated: record.translated,
    strategy: cloneStrategy(record.strategy)
  };
}

export function createDisplayRecordTable(): DisplayRecordTable {
  const records = new Map<DisplayNodeKey, DisplayRecord>();

  return {
    register(node, original, strategy) {
      if (node.key.length === 0 || records.has(node.key)) {
        return false;
      }

      records.set(node.key, {
        node: cloneNode(node),
        original,
        strategy: cloneStrategy(strategy)
      });
      return true;
    },

    get(key) {
      const record = records.get(key);
      return record === undefined ? undefined : cloneRecord(record);
    },

    updateTranslation(key, translated) {
      const record = records.get(key);
      if (record === undefined) {
        return false;
      }

      records.set(key, {
        ...record,
        translated
      });
      return true;
    },

    remove(key) {
      return records.delete(key);
    },

    clear() {
      records.clear();
    },

    size() {
      return records.size;
    },

    entries() {
      return Array.from(records.values(), cloneRecord);
    },

    decideAll(mode) {
      return Array.from(records.values(), (record) =>
        decideRenderIntent(
          record.node,
          record.original,
          record.translated,
          mode,
          record.strategy
        )
      );
    }
  };
}
