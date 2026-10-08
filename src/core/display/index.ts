import {
  DISPLAY_SELECTORS,
  FIXED_UI_EXCLUSIONS,
  selectorMatchesPath,
  type DisplayPageArea,
  type SelectorDefinition,
  type SelectorId,
  type SelectorMatcher
} from './selectors.ts';
import type { TranslationContext } from '../../shared/translation-context.ts';

export { DISPLAY_SELECTORS, selectorMatchesPath };
export type {
  DisplayPageArea,
  SelectorDefinition,
  SelectorId,
  SelectorMatcher
};

export function getTranslationContextForStrategyId(
  strategyId: string
): TranslationContext {
  switch (strategyId) {
    case 'match-event':
    case 'match-stage':
    case 'match-meta':
    case 'match-time':
    case 'match-teamname':
    case 'match-detail-heading':
    case 'sidebar-widget-heading':
    case 'player-week-category':
    case 'player-week-metric':
    case 'global-signin':
    case 'minigame-heading':
    case 'minigame-play':
    case 'left-ranking-complete-cta':
    case 'left-event-calendar-cta':
    case 'match-list-heading':
    case 'match-filter-heading':
    case 'match-filter-label':
    case 'match-detail-stat-tab':
    case 'events-current-heading':
    case 'events-upcoming-heading':
    case 'team-ranking-region-selector':
    case 'static-page-heading':
    case 'filter-panel-title':
    case 'filter-label':
    case 'fantasy-main-heading':
    case 'fantasy-section-heading':
    case 'live-fullscreen-control':
    case 'live-theater-link':
    case 'global-navigation':
    case 'navigation-dropdown':
    case 'player-archive-filter':
    case 'footer-section-heading':
    case 'footer-cta':
    case 'footer-link':
    case 'footer-responsible-disclaimer':
    case 'stats-fixed-ui':
    case 'page-fixed-ui':
    case 'profile-fixed-ui':
      return 'structured';
    case 'news-title':
    case 'news-index-heading':
    case 'news-body':
    case 'article-body':
    case 'news-article-title':
    case 'footer-section-copy':
    case 'page-prose':
    case 'recent-activity-topic':
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
  translationSource?: 'fixed-ui-glossary' | 'page-prose';
  glossaryCategories?: readonly string[];
  fallbackStrategyId?: string;
  minTextWords?: number;
}

export const FIXED_UI_CHROME_STRATEGY: ElementStrategy = {
  id: 'fixed-ui-chrome',
  translation: 'allowed',
  translationSource: 'fixed-ui-glossary',
  glossaryCategories: ['ui'],
  allowedModes: ['A'],
  priority: 10,
  rationale: 'Known input hints and CSS badge wording are replaced only through the packaged glossary.'
};

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
    id: 'news-title',
    selectorId: 'news-title',
    translation: 'allowed',
    allowedModes: ['A', 'B'],
    priority: 45,
    rationale: 'The inspected archive title has flexible width and supports both display modes.'
  },
  {
    id: 'article-body',
    selectorId: 'article-body',
    translation: 'allowed',
    allowedModes: ['A', 'B'],
    priority: 45,
    rationale: 'The inspected article prose containers have no fixed dimensions or hidden overflow.'
  },
  {
    id: 'article-entity',
    selectorId: 'article-entity',
    translation: 'never',
    allowedModes: [],
    priority: 85,
    rationale: 'Tooltip-linked team and player names in article prose remain identifiers.'
  },
  {
    id: 'comment-body',
    selectorId: 'comment-body',
    translation: 'allowed',
    allowedModes: ['A', 'B'],
    priority: 45,
    rationale: 'Eligible full comments replace the original in Chinese mode or add a sibling in bilingual mode.'
  },
  {
    id: 'news-index-heading',
    selectorId: 'news-index-headings',
    translation: 'allowed',
    allowedModes: ['A', 'B'],
    priority: 45,
    rationale:
      'Captured home and archive news-index headings use flexible text layout and support both display modes.'
  },
  {
    id: 'match-detail-heading',
    selectorId: 'match-detail-headings',
    translation: 'allowed',
    allowedModes: ['A'],
    priority: 45,
    rationale:
      'Only captured static match-detail section labels use replacement; score and live-data areas stay excluded.'
  },
  {
    id: 'global-navigation',
    selectorId: 'global-navigation',
    translation: 'allowed',
    allowedModes: ['A'],
    priority: 45,
    rationale:
      'Static primary navigation labels use replacement to preserve links and avoid clipped mobile menu insertions.'
  },
  {
    id: 'news-article-title',
    selectorId: 'news-article-title',
    translation: 'allowed',
    allowedModes: ['A', 'B'],
    priority: 46,
    rationale:
      'The captured article title is an h1 headline; both modes are supported so bilingual reading keeps the original title with a translated sibling.'
  },
  {
    id: 'sidebar-widget-heading',
    selectorId: 'sidebar-widget-headings',
    translation: 'allowed',
    allowedModes: ['A'],
    priority: 45,
    rationale:
      'Captured sidebar module headings are short labels in narrow columns; replace text without adding a sibling.'
  },
  {
    id: 'player-week-category',
    selectorId: 'player-week-category',
    translation: 'allowed',
    allowedModes: ['A'],
    priority: 46,
    rationale:
      'The captured player-of-the-week category is a short static label; replace it in place without touching the player name or statistics.'
  },
  {
    id: 'player-week-metric',
    selectorId: 'player-week-metric',
    translation: 'allowed',
    allowedModes: ['A'],
    priority: 46,
    rationale:
      'The captured player-of-the-week metric heading is a label; replace it in place and leave the adjacent percentage untouched.'
  },
  {
    id: 'global-signin',
    selectorId: 'global-signin',
    translation: 'allowed',
    allowedModes: ['A'],
    priority: 45,
    rationale: 'The captured top-bar sign-in label is replaced in place.'
  },
  {
    id: 'minigame-heading',
    selectorId: 'minigame-heading',
    translation: 'allowed',
    allowedModes: ['A'],
    priority: 46,
    rationale:
      'Only the MINIGAME heading text node is replaced; its CSS-generated NEW badge remains intact.'
  },
  {
    id: 'minigame-play',
    selectorId: 'minigame-play',
    translation: 'allowed',
    allowedModes: ['A'],
    priority: 45,
    rationale: 'The captured minigame action label is replaced in place.'
  },
  {
    id: 'left-ranking-complete-cta',
    selectorId: 'left-ranking-complete-cta',
    translation: 'allowed',
    allowedModes: ['A'],
    priority: 45,
    rationale:
      'The team-ranking CTA is translated while nested update metadata is separately protected.'
  },
  {
    id: 'left-ranking-update-meta',
    selectorId: 'left-ranking-update-meta',
    translation: 'never',
    allowedModes: [],
    priority: 85,
    rationale:
      'The nested last-updated label and date are time-sensitive metadata and stay untouched.'
  },
  {
    id: 'left-event-calendar-cta',
    selectorId: 'left-event-calendar-cta',
    translation: 'allowed',
    allowedModes: ['A'],
    priority: 45,
    rationale: 'The captured event-calendar link label is replaced without changing its destination.'
  },
  {
    id: 'match-list-heading',
    selectorId: 'match-list-headings',
    translation: 'allowed',
    allowedModes: ['A'],
    priority: 45,
    rationale:
      'The live and upcoming match headings are static labels in compact header rows; use replacement only.'
  },
  {
    id: 'match-filter-heading',
    selectorId: 'match-filter-heading',
    translation: 'allowed',
    allowedModes: ['A'],
    priority: 45,
    rationale:
      'The match-filter panel title is a static short label; replacement avoids shifting the compact sidebar layout.'
  },
  {
    id: 'match-filter-label',
    selectorId: 'match-filter-static-labels',
    translation: 'allowed',
    allowedModes: ['A'],
    priority: 45,
    rationale:
      'Only the captured starred/ranked filter labels are selected; tournament names and region counts are excluded.'
  },
  {
    id: 'match-detail-stat-tab',
    selectorId: 'match-detail-stat-tabs',
    translation: 'allowed',
    allowedModes: ['A'],
    priority: 45,
    rationale:
      'Captured map-stat tab labels are short controls inside a fixed-height tab strip; replacement adds no layout node.'
  },
  {
    id: 'events-current-heading',
    selectorId: 'events-current-heading',
    translation: 'allowed',
    allowedModes: ['A'],
    priority: 45,
    rationale:
      'The ongoing-events section label is replaced in place to preserve the captured heading layout.'
  },
  {
    id: 'events-upcoming-heading',
    selectorId: 'events-upcoming-heading',
    translation: 'allowed',
    allowedModes: ['A'],
    priority: 45,
    rationale:
      'The upcoming-events section label is replaced in place to preserve the captured heading layout.'
  },
  {
    id: 'team-ranking-region-selector',
    selectorId: 'team-ranking-region-selector',
    translation: 'allowed',
    allowedModes: ['A'],
    priority: 45,
    rationale:
      'The regional-ranking selector label is replaced in place so its click target and layout stay intact.'
  },
  {
    id: 'static-page-heading',
    selectorId: 'static-page-heading',
    translation: 'allowed',
    allowedModes: ['A'],
    priority: 50,
    rationale:
      'Confirmed results and player-directory page headings use in-place replacement; the selector is restricted to those routes.'
  },
  {
    id: 'filter-panel-title',
    selectorId: 'filter-panel-title',
    translation: 'allowed',
    allowedModes: ['A'],
    priority: 45,
    rationale:
      'Route-limited filter-panel titles use in-place replacement to preserve the compact control layout.'
  },
  {
    id: 'filter-label',
    selectorId: 'filter-label',
    translation: 'allowed',
    allowedModes: ['A'],
    priority: 45,
    rationale:
      'Route-limited static filter headings use in-place replacement; player and match data are not selected.'
  },
  {
    id: 'fantasy-main-heading',
    selectorId: 'fantasy-main-heading',
    translation: 'allowed',
    allowedModes: ['A'],
    priority: 50,
    rationale:
      'The Fantasy overview headings are translated in place on the exact overview route; individual game and leaderboard routes are excluded.'
  },
  {
    id: 'fantasy-section-heading',
    selectorId: 'fantasy-section-heading',
    translation: 'allowed',
    allowedModes: ['A'],
    priority: 45,
    rationale:
      'Static Fantasy overview section headings use in-place replacement and are limited to the exact overview route.'
  },
  {
    id: 'live-fullscreen-control',
    selectorId: 'live-fullscreen-control',
    translation: 'allowed',
    allowedModes: ['A'],
    priority: 45,
    rationale:
      'The live-page fullscreen button is translated in place on the exact route so the control and click behavior remain intact.'
  },
  {
    id: 'live-theater-link',
    selectorId: 'live-theater-link',
    translation: 'allowed',
    allowedModes: ['A'],
    priority: 45,
    rationale:
      'The live-page Theater link is selected by its fullscreen destination and translated in place on the exact route.'
  },
  {
    id: 'footer-section-heading',
    selectorId: 'footer-section-header',
    translation: 'allowed',
    allowedModes: ['A'],
    priority: 45,
    rationale:
      'Shared footer section headings are replaced in place to avoid changing the footer layout.'
  },
  {
    id: 'footer-section-copy',
    selectorId: 'footer-section-subtext',
    translation: 'allowed',
    allowedModes: ['A'],
    priority: 45,
    rationale:
      'Shared footer promotional copy is replaced in place inside inline-block text.'
  },
  {
    id: 'footer-cta',
    selectorId: 'footer-cta',
    translation: 'allowed',
    allowedModes: ['A'],
    priority: 45,
    rationale:
      'Footer call-to-action labels are replaced without changing their link destination.'
  },
  {
    id: 'footer-link',
    selectorId: 'footer-links',
    translation: 'allowed',
    allowedModes: ['A'],
    priority: 45,
    rationale:
      'Footer navigation labels are replaced in place to preserve the link and compact row layout.'
  },
  {
    id: 'footer-responsible-disclaimer',
    selectorId: 'footer-responsible-disclaimer',
    translation: 'allowed',
    allowedModes: ['A'],
    priority: 45,
    rationale:
      'The responsible-gaming warning is replaced in place while preserving its adjacent brand logos.'
  },
  {
    id: 'stats-fixed-ui',
    selectorId: 'stats-fixed-ui',
    translation: 'allowed',
    translationSource: 'fixed-ui-glossary',
    glossaryCategories: ['ui', 'ui-stats'],
    fallbackStrategyId: 'page-prose',
    allowedModes: ['A'],
    priority: 15,
    rationale:
      'Only fully glossary-covered interface labels qualify on stats routes. Unknown text is never sent to a provider by this fallback.'
  },
  {
    id: 'page-fixed-ui',
    selectorId: 'page-fixed-ui',
    translation: 'allowed',
    translationSource: 'fixed-ui-glossary',
    glossaryCategories: ['ui', 'ui-match'],
    fallbackStrategyId: 'page-prose',
    allowedModes: ['A'],
    priority: 10,
    rationale:
      'Shared fixed labels qualify by complete glossary coverage. Other text can only use the separately admitted public-page prose fallback.'
  },
  {
    id: 'profile-fixed-ui',
    selectorId: 'profile-fixed-ui',
    translation: 'allowed',
    translationSource: 'fixed-ui-glossary',
    glossaryCategories: ['ui', 'ui-profile'],
    fallbackStrategyId: 'page-prose',
    allowedModes: ['A'],
    priority: 15,
    rationale: 'Observed player/team interface labels qualify by complete glossary coverage on those routes; names and values are preserved.'
  },
  {
    id: 'page-prose',
    selectorId: 'page-prose',
    translation: 'allowed',
    translationSource: 'page-prose',
    minTextWords: 4,
    allowedModes: ['A'],
    priority: 5,
    rationale: 'Readable multi-word prose on public routes can use the configured provider. Short identities, values, editable fields, forums, and dynamic writers are excluded from the root fallback.'
  },
  {
    id: 'recent-activity-topic',
    selectorId: 'recent-activity-topic',
    translation: 'allowed',
    allowedModes: ['A'],
    priority: 60,
    rationale: 'Captured activity title spans are translated separately from their adjacent comment counts.'
  },
  {
    id: 'navigation-dropdown',
    selectorId: 'navigation-dropdown',
    translation: 'allowed',
    translationSource: 'fixed-ui-glossary',
    glossaryCategories: ['ui', 'ui-navigation'],
    allowedModes: ['A'],
    priority: 60,
    rationale: 'Captured static menu links use complete local glossary coverage and replacement to preserve destinations, badges, and fixed-height menus.'
  },
  {
    id: 'player-archive-filter',
    selectorId: 'player-archive-filter',
    translation: 'allowed',
    translationSource: 'fixed-ui-glossary',
    glossaryCategories: ['ui', 'ui-navigation'],
    allowedModes: ['A'],
    priority: 60,
    rationale: 'The observed archive alphabet controls admit known filter wording locally; letters and numeric filters remain unchanged.'
  },
  {
    id: 'default-no-translation',
    translation: 'never',
    allowedModes: [],
    priority: 0,
    rationale: 'Unknown elements are conservative by default.'
  }
];

export function isFixedUiElementProtected(
  element: DisplayElementInfo,
  pathname: string
): boolean {
  const policy = resolveElementStrategy(element, pathname);
  return (
    (policy.translation === 'never' && FIXED_UI_EXCLUSIONS.protectedStrategies.some((id) => id === policy.id)) ||
    FIXED_UI_EXCLUSIONS.tags.some((tag) => tag === element.tagName.toLowerCase()) ||
    FIXED_UI_EXCLUSIONS.classes.some((name) => element.classes.includes(name)) ||
    FIXED_UI_EXCLUSIONS.attributes.some((name) => hasAttribute(element, name)) ||
    Object.keys(element.attributes).some((name) =>
      !FIXED_UI_EXCLUSIONS.attributePrefixExceptions.some((exception) => name === exception.name && element.tagName.toLowerCase() === exception.tagName) &&
      FIXED_UI_EXCLUSIONS.attributePrefixes.some((prefix) => name.startsWith(prefix))) ||
    FIXED_UI_EXCLUSIONS.roles.some((role) => role === element.attributes.role)
  );
}

const selectorById = new Map<SelectorId, SelectorDefinition>(
  DISPLAY_SELECTORS.map((definition) => [definition.id, definition])
);

export function resolveFallbackStrategy(strategy: ElementStrategy, pathname: string): ElementStrategy | undefined {
  const fallback = ELEMENT_STRATEGIES.find((entry) => entry.id === strategy.fallbackStrategyId);
  const selector = fallback?.selectorId === undefined ? undefined : selectorById.get(fallback.selectorId);
  return selector !== undefined && selectorMatchesPath(selector, pathname) ? fallback : undefined;
}

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

  if (matcher.kind === 'tag-name') {
    return element.tagName.toLowerCase() === matcher.value.toLowerCase();
  }

  if (matcher.kind === 'tag-name-and-class') {
    return (
      element.tagName.toLowerCase() === matcher.tagName.toLowerCase() &&
      element.classes.includes(matcher.className)
    );
  }

  if (matcher.kind === 'tag-name-class-and-attribute') {
    return (
      element.tagName.toLowerCase() === matcher.tagName.toLowerCase() &&
      element.classes.includes(matcher.className) &&
      element.attributes[matcher.attributeName] === matcher.attributeValue
    );
  }

  return matcher.names.every((name) => hasAttribute(element, name));
}

export function resolveElementStrategy(
  element: DisplayElementInfo,
  pathname?: string
): ElementStrategy {
  const matched = ELEMENT_STRATEGIES.filter((strategy) => {
    if (strategy.selectorId === undefined) {
      return false;
    }

    const selector = selectorById.get(strategy.selectorId);
    return (
      selector !== undefined &&
      (selector.pathPrefixes === undefined && selector.exactPaths === undefined ||
        (pathname !== undefined && selectorMatchesPath(selector, pathname))) &&
      matchesSelector(element, selector.matcher)
    );
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

  if (translated === undefined || translated.trim().length === 0) {
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
    allowedModes: [...strategy.allowedModes],
    ...(strategy.glossaryCategories === undefined ? {} : { glossaryCategories: [...strategy.glossaryCategories] })
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
