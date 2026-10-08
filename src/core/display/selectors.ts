export type SelectorId =
  | 'match-teamname'
  | 'match-event'
  | 'match-stage'
  | 'match-meta'
  | 'match-time'
  | 'current-map-score'
  | 'match-team-livescore'
  | 'time-format-unix'
  | 'countdown-target'
  | 'news-title'
  | 'article-body'
  | 'article-entity'
  | 'comment-body'
  | 'news-index-headings'
  | 'match-detail-headings'
  | 'global-navigation'
  | 'news-article-title'
  | 'sidebar-widget-headings'
  | 'player-week-category'
  | 'player-week-metric'
  | 'global-signin'
  | 'minigame-heading'
  | 'minigame-play'
  | 'left-ranking-complete-cta'
  | 'left-ranking-update-meta'
  | 'left-event-calendar-cta'
  | 'match-list-headings'
  | 'match-filter-heading'
  | 'match-filter-static-labels'
  | 'match-detail-stat-tabs'
  | 'events-current-heading'
  | 'events-upcoming-heading'
  | 'team-ranking-region-selector'
  | 'static-page-heading'
  | 'filter-panel-title'
  | 'filter-label'
  | 'fantasy-main-heading'
  | 'fantasy-section-heading'
  | 'live-fullscreen-control'
  | 'live-theater-link'
  | 'footer-section-header'
  | 'footer-section-subtext'
  | 'footer-cta'
  | 'footer-links'
  | 'footer-responsible-disclaimer'
  | 'stats-fixed-ui'
  | 'page-fixed-ui'
  | 'page-prose'
  | 'recent-activity-topic'
  | 'profile-fixed-ui'
  | 'navigation-dropdown'
  | 'player-archive-filter';

export type DisplayPageArea =
  | 'matches'
  | 'global'
  | 'news-list'
  | 'article'
  | 'match-comments'
  | 'news-index'
  | 'match-detail'
  | 'events'
  | 'team-ranking'
  | 'page-headings'
  | 'route-filters'
  | 'fantasy'
  | 'live'
  | 'global-navigation'
  | 'global-widgets'
  | 'global-footer'
  | 'stats';

export type SelectorMatcher =
  | {
      kind: 'class';
      value: string;
    }
  | {
      kind: 'attributes';
      names: readonly string[];
    }
  | {
      kind: 'tag-name';
      value: string;
    }
  | {
      kind: 'tag-name-and-class';
      tagName: string;
      className: string;
    }
  | {
      kind: 'tag-name-class-and-attribute';
      tagName: string;
      className: string;
      attributeName: string;
      attributeValue: string;
    };

export interface SelectorDefinition {
  id: SelectorId;
  selector: string;
  matcher: SelectorMatcher;
  pageArea: DisplayPageArea;
  verifiedOn: '2026-09-20' | '2026-09-26' | '2026-09-30';
  evidence: readonly string[];
  pathPrefixes?: readonly string[];
  exactPaths?: readonly string[];
}

export function selectorMatchesPath(
  definition: Pick<SelectorDefinition, 'pathPrefixes' | 'exactPaths'>,
  pathname: string
): boolean {
  return (
    (definition.pathPrefixes === undefined && definition.exactPaths === undefined) ||
    definition.exactPaths?.includes(pathname) === true ||
    (definition.pathPrefixes?.some((prefix) =>
      pathname === prefix || pathname.startsWith(`${prefix}/`)
    ) ?? false)
  );
}

export const DISPLAY_SELECTORS: readonly SelectorDefinition[] = [
  {
    id: 'match-teamname',
    selector: '.match-teamname',
    matcher: { kind: 'class', value: 'match-teamname' },
    pageArea: 'matches',
    verifiedOn: '2026-09-20',
    evidence: ['docs/findings.md §6 P0-3']
  },
  {
    id: 'match-event',
    selector: '.match-event',
    matcher: { kind: 'class', value: 'match-event' },
    pageArea: 'matches',
    verifiedOn: '2026-09-20',
    evidence: ['docs/findings.md §6 P0-3']
  },
  {
    id: 'match-stage',
    selector: '.match-stage',
    matcher: { kind: 'class', value: 'match-stage' },
    pageArea: 'matches',
    verifiedOn: '2026-09-20',
    evidence: ['docs/findings.md §6 P0-3']
  },
  {
    id: 'match-meta',
    selector: '.match-meta',
    matcher: { kind: 'class', value: 'match-meta' },
    pageArea: 'matches',
    verifiedOn: '2026-09-20',
    evidence: ['docs/findings.md §6 P0-3']
  },
  {
    id: 'match-time',
    selector: '.match-time',
    matcher: { kind: 'class', value: 'match-time' },
    pageArea: 'matches',
    verifiedOn: '2026-09-20',
    evidence: ['docs/findings.md §6 P0-3']
  },
  {
    id: 'current-map-score',
    selector: '.current-map-score',
    matcher: { kind: 'class', value: 'current-map-score' },
    pageArea: 'matches',
    verifiedOn: '2026-09-20',
    evidence: ['docs/findings.md §6 P0-3']
  },
  {
    id: 'match-team-livescore',
    selector: '.match-team-livescore',
    matcher: { kind: 'class', value: 'match-team-livescore' },
    pageArea: 'matches',
    verifiedOn: '2026-09-20',
    evidence: ['docs/findings.md §6 P0-3']
  },
  {
    id: 'time-format-unix',
    selector: '[data-time-format][data-unix]',
    matcher: {
      kind: 'attributes',
      names: ['data-time-format', 'data-unix']
    },
    pageArea: 'global',
    verifiedOn: '2026-09-20',
    evidence: [
      'docs/findings.md §6 P0-3',
      'docs/findings.md 新闻与文章页侦察小节'
    ]
  },
  {
    id: 'countdown-target',
    selector: '[data-countdown-target-timestamp]',
    matcher: {
      kind: 'attributes',
      names: ['data-countdown-target-timestamp']
    },
    pageArea: 'global',
    verifiedOn: '2026-09-20',
    evidence: ['docs/findings.md §6 P0-3']
  },
  {
    id: 'news-title',
    selector: '.index .newsline.article .newstext',
    matcher: { kind: 'class', value: 'newstext' },
    pageArea: 'news-list',
    verifiedOn: '2026-09-20',
    evidence: ['docs/findings.md §3B news archive', 'docs/display-strategy.md 新闻标题']
  },
  {
    id: 'article-body',
    selector: '.newsdsl .newstext-con',
    matcher: { kind: 'class', value: 'newstext-con' },
    pageArea: 'article',
    verifiedOn: '2026-09-20',
    evidence: ['docs/findings.md §3B article prose', 'docs/display-strategy.md 正文']
  },
  {
    id: 'article-entity',
    selector: '.newsdsl .newstext-con [data-tooltip-id]',
    matcher: { kind: 'attributes', names: ['data-tooltip-id'] },
    pageArea: 'article',
    verifiedOn: '2026-09-20',
    evidence: [
      'raw-capture/gate3/news-article.html article body team links',
      'docs/display-strategy.md 正文'
    ]
  },
  {
    id: 'comment-body',
    selector: '.forum .post .forum-middle',
    matcher: { kind: 'class', value: 'forum-middle' },
    pageArea: 'match-comments',
    verifiedOn: '2026-09-20',
    evidence: ['docs/findings.md §3A captured forum/post/forum-middle comment structure and CSS; §12 full Chinese mode']
  },
  {
    id: 'news-index-headings',
    selector: '.index h2.newsheader',
    matcher: { kind: 'class', value: 'newsheader' },
    pageArea: 'news-index',
    verifiedOn: '2026-09-20',
    evidence: [
      'docs/findings.md §3C home news headings',
      'raw-capture/gate3/news-list.html archive heading'
    ]
  },
  {
    id: 'match-detail-headings',
    selector:
      '.match-page .betting-section .headline, .match-page .lineups > .headline, .match-page .past-matches-header > .headline, .match-page .matchpage-analytics-section > .headline',
    matcher: { kind: 'class', value: 'headline' },
    pageArea: 'match-detail',
    verifiedOn: '2026-09-20',
    evidence: ['docs/findings.md §3D match-detail module headings']
  },
  {
    id: 'global-navigation',
    selector: '.navbar .navcon a.nav-link',
    matcher: { kind: 'class', value: 'nav-link' },
    pageArea: 'global-navigation',
    verifiedOn: '2026-09-20',
    evidence: [
      'raw-capture/gate3/home.html primary navigation',
      'raw-capture/gate3/matches.html primary navigation',
      'raw-capture/gate3/match-detail.html primary navigation',
      'raw-capture/gate3/news-list.html primary navigation',
      'raw-capture/gate3/news-article.html primary navigation',
      'raw-capture/gate3/terms.html shared primary navigation'
    ]
  },
  {
    id: 'news-article-title',
    selector: '.newsitem.standard-box > h1.headline',
    matcher: {
      kind: 'tag-name-and-class',
      tagName: 'h1',
      className: 'headline'
    },
    pageArea: 'article',
    verifiedOn: '2026-09-20',
    evidence: ['raw-capture/gate3/news-article.html article title']
  },
  {
    id: 'sidebar-widget-headings',
    selector:
      '.leftCol > aside > h1:not(#playerOfTheWeekTitle), .leftCol > aside > .presented-by-row > h1, .rightCol > aside > h1, .right2Col > aside > .recent-activity > h1, .right2Col > aside > h1:not(.minigame-label-new)',
    matcher: { kind: 'tag-name', value: 'h1' },
    pageArea: 'global-widgets',
    verifiedOn: '2026-09-20',
    evidence: [
      'raw-capture/gate3/home.html sidebar module headings',
      'raw-capture/gate3/matches.html sidebar module headings',
      'raw-capture/gate3/match-detail.html sidebar module headings',
      'raw-capture/gate3/news-list.html sidebar module headings',
      'raw-capture/gate3/news-article.html sidebar module headings',
      'raw-capture/gate3/terms.html shared sidebar module headings'
    ]
  },
  {
    id: 'match-list-headings',
    selector: '.matches-v4 .new-standardPageGrid .upcoming-headline',
    matcher: { kind: 'class', value: 'upcoming-headline' },
    pageArea: 'matches',
    verifiedOn: '2026-09-20',
    evidence: ['raw-capture/gate3/matches.html live and upcoming headings']
  },
  {
    id: 'match-filter-heading',
    selector: '.matches-v4 .matches-sidebar-filter-wrapper .sidebar-title > h3',
    matcher: { kind: 'tag-name', value: 'h3' },
    pageArea: 'matches',
    verifiedOn: '2026-09-20',
    evidence: ['raw-capture/gate3/matches.html filter panel heading']
  },
  {
    id: 'match-filter-static-labels',
    selector:
      '.matches-v4 .matches-sidebar-filter-wrapper .matches-filter-star-section .matches-filter-name-text, .matches-v4 .matches-sidebar-filter-wrapper .matches-filter-ranked-section .matches-filter-name-text',
    matcher: { kind: 'class', value: 'matches-filter-name-text' },
    pageArea: 'matches',
    verifiedOn: '2026-09-20',
    evidence: ['raw-capture/gate3/matches.html static match filter labels']
  },
  {
    id: 'match-detail-stat-tabs',
    selector:
      '.match-page .map-stats-infobox .map-stats-infobox-tabs > button.map-stats-infobox-tab',
    matcher: { kind: 'class', value: 'map-stats-infobox-tab' },
    pageArea: 'match-detail',
    verifiedOn: '2026-09-20',
    evidence: ['raw-capture/gate3/match-detail.html map-stat tabs']
  },
  {
    id: 'events-current-heading',
    selector: '.event-status-headline',
    matcher: { kind: 'class', value: 'event-status-headline' },
    pageArea: 'events',
    verifiedOn: '2026-09-26',
    evidence: [
      'Chrome accessibility tree for https://www.hltv.org/events: Ongoing events',
      'raw-capture/gate3/matches-style.css .event-status-headline'
    ]
  },
  {
    id: 'events-upcoming-heading',
    selector: '.event-status-upcoming-headline',
    matcher: { kind: 'class', value: 'event-status-upcoming-headline' },
    pageArea: 'events',
    verifiedOn: '2026-09-26',
    evidence: [
      'Chrome accessibility tree for https://www.hltv.org/events: Upcoming events',
      'raw-capture/gate3/matches-style.css .event-status-upcoming-headline'
    ]
  },
  {
    id: 'team-ranking-region-selector',
    selector: '.ranking-open-region-selector',
    matcher: { kind: 'class', value: 'ranking-open-region-selector' },
    pageArea: 'team-ranking',
    verifiedOn: '2026-09-26',
    evidence: [
      'Chrome accessibility tree for https://www.hltv.org/ranking/teams: ranking-open-region-selector'
    ]
  },
  {
    id: 'static-page-heading',
    selector: 'h1:not(#playerOfTheWeekTitle):not(.minigame-label-new)',
    matcher: { kind: 'tag-name', value: 'h1' },
    pageArea: 'page-headings',
    verifiedOn: '2026-09-26',
    evidence: [
      'Chrome accessibility tree for https://www.hltv.org/results: level 1 heading Results',
      'Chrome accessibility tree for https://www.hltv.org/players/archive/active: level 1 heading Counter-Strike Players'
    ],
    pathPrefixes: ['/results', '/players/archive']
  },
  {
    id: 'filter-panel-title',
    selector: '.header-filters-title',
    matcher: { kind: 'class', value: 'header-filters-title' },
    pageArea: 'route-filters',
    verifiedOn: '2026-09-26',
    evidence: ['raw-capture/gate3/matches-style.css .header-filters-title'],
    pathPrefixes: ['/results']
  },
  {
    id: 'filter-label',
    selector: '.filter-headline',
    matcher: { kind: 'class', value: 'filter-headline' },
    pageArea: 'route-filters',
    verifiedOn: '2026-09-26',
    evidence: ['raw-capture/gate3/matches-style.css .filter-headline'],
    pathPrefixes: ['/results']
  },
  {
    id: 'fantasy-main-heading',
    selector: 'h1',
    matcher: { kind: 'tag-name', value: 'h1' },
    pageArea: 'fantasy',
    verifiedOn: '2026-09-26',
    evidence: [
      'Chrome accessibility tree for https://www.hltv.org/fantasy: level 1 headings Fantasy Fall season 2026 and Partner Games'
    ],
    exactPaths: ['/fantasy']
  },
  {
    id: 'fantasy-section-heading',
    selector: 'h2',
    matcher: { kind: 'tag-name', value: 'h2' },
    pageArea: 'fantasy',
    verifiedOn: '2026-09-26',
    evidence: [
      'Chrome accessibility tree for https://www.hltv.org/fantasy: level 2 section headings PRIZES, ABOUT FALL SEASON 2026, and POINTS SYSTEM'
    ],
    exactPaths: ['/fantasy']
  },
  {
    id: 'live-fullscreen-control',
    selector: 'button',
    matcher: { kind: 'tag-name', value: 'button' },
    pageArea: 'live',
    verifiedOn: '2026-09-26',
    evidence: [
      'Chrome accessibility tree for https://www.hltv.org/live: button Fullscreen'
    ],
    exactPaths: ['/live']
  },
  {
    id: 'live-theater-link',
    selector: 'a[href*="fullscreen=1"]',
    matcher: { kind: 'attributes', names: ['href'] },
    pageArea: 'live',
    verifiedOn: '2026-09-26',
    evidence: [
      'Chrome accessibility tree for https://www.hltv.org/live: Theater link to /live?fullscreen=1'
    ],
    exactPaths: ['/live']
  },
  {
    id: 'footer-section-header',
    selector: '.footer .footer-content .footer-section-header',
    matcher: { kind: 'class', value: 'footer-section-header' },
    pageArea: 'global-footer',
    verifiedOn: '2026-09-20',
    evidence: [
      'raw-capture/gate3/home.html shared footer',
      'raw-capture/gate3/matches.html shared footer',
      'raw-capture/gate3/match-detail.html shared footer',
      'raw-capture/gate3/news-list.html shared footer',
      'raw-capture/gate3/news-article.html shared footer',
      'raw-capture/gate3/terms.html shared footer'
    ]
  },
  {
    id: 'footer-section-subtext',
    selector: '.footer .footer-content .footer-section-subtext',
    matcher: { kind: 'class', value: 'footer-section-subtext' },
    pageArea: 'global-footer',
    verifiedOn: '2026-09-20',
    evidence: [
      'raw-capture/gate3/home.html shared footer copy',
      'raw-capture/gate3/terms.html shared footer copy'
    ]
  },
  {
    id: 'footer-cta',
    selector: '.footer .footer-content .footer-cta-button',
    matcher: { kind: 'class', value: 'footer-cta-button' },
    pageArea: 'global-footer',
    verifiedOn: '2026-09-20',
    evidence: [
      'raw-capture/gate3/home.html shared footer CTA',
      'raw-capture/gate3/terms.html shared footer CTA'
    ]
  },
  {
    id: 'footer-links',
    selector: '.footer .footerlinks a.footerlink',
    matcher: { kind: 'class', value: 'footerlink' },
    pageArea: 'global-footer',
    verifiedOn: '2026-09-20',
    evidence: [
      'raw-capture/gate3/home.html shared footer links',
      'raw-capture/gate3/matches.html shared footer links',
      'raw-capture/gate3/match-detail.html shared footer links',
      'raw-capture/gate3/news-list.html shared footer links',
      'raw-capture/gate3/news-article.html shared footer links',
      'raw-capture/gate3/terms.html shared footer links'
    ]
  },
  {
    id: 'footer-responsible-disclaimer',
    selector:
      '.footer .footer-responsible-container .footer-generic-responible-container',
    matcher: { kind: 'class', value: 'footer-generic-responible-container' },
    pageArea: 'global-footer',
    verifiedOn: '2026-09-20',
    evidence: [
      'raw-capture/gate3/home.html responsible-gaming footer',
      'raw-capture/gate3/terms.html responsible-gaming footer'
    ]
  },
  {
    id: 'player-week-category',
    selector: '.playerOfTheWeekCategory',
    matcher: { kind: 'class', value: 'playerOfTheWeekCategory' },
    pageArea: 'global-widgets',
    verifiedOn: '2026-09-20',
    evidence: ['raw-capture/gate3/news-article.html player-of-the-week card label']
  },
  {
    id: 'player-week-metric',
    selector: '.playerOfTheWeekTitle',
    matcher: { kind: 'class', value: 'playerOfTheWeekTitle' },
    pageArea: 'global-widgets',
    verifiedOn: '2026-09-20',
    evidence: ['raw-capture/gate3/news-article.html player-of-the-week metric label']
  },
  {
    id: 'global-signin',
    selector: '.navsignin',
    matcher: { kind: 'class', value: 'navsignin' },
    pageArea: 'global-navigation',
    verifiedOn: '2026-09-20',
    evidence: ['raw-capture/gate3/news-article.html top-bar sign-in label']
  },
  {
    id: 'minigame-heading',
    selector: '.right2Col > aside > h1.minigame-label-new',
    matcher: {
      kind: 'tag-name-and-class',
      tagName: 'h1',
      className: 'minigame-label-new'
    },
    pageArea: 'global-widgets',
    verifiedOn: '2026-09-20',
    evidence: ['raw-capture/gate3/news-article.html minigame heading; NEW is a CSS badge']
  },
  {
    id: 'minigame-play',
    selector: '.right2Col .sidebar-minigames-playnow-btn',
    matcher: { kind: 'class', value: 'sidebar-minigames-playnow-btn' },
    pageArea: 'global-widgets',
    verifiedOn: '2026-09-20',
    evidence: ['raw-capture/gate3/news-article.html minigame play control']
  },
  {
    id: 'left-ranking-complete-cta',
    selector: '.leftCol > aside > a.block.button.text-center[href="/ranking/teams"]',
    matcher: {
      kind: 'tag-name-class-and-attribute',
      tagName: 'a',
      className: 'button',
      attributeName: 'href',
      attributeValue: '/ranking/teams'
    },
    pageArea: 'global-widgets',
    verifiedOn: '2026-09-20',
    evidence: ['raw-capture/gate3/news-article.html team-ranking CTA and update metadata']
  },
  {
    id: 'left-ranking-update-meta',
    selector: '.leftCol > aside > a.block.button.text-center[href="/ranking/teams"] > span.normal-weight',
    matcher: { kind: 'class', value: 'normal-weight' },
    pageArea: 'global-widgets',
    verifiedOn: '2026-09-20',
    evidence: ['raw-capture/gate3/news-article.html dynamic team-ranking update metadata']
  },
  {
    id: 'left-event-calendar-cta',
    selector: '.leftCol > aside > a.block.button.text-center[href="/events"]',
    matcher: {
      kind: 'tag-name-class-and-attribute',
      tagName: 'a',
      className: 'leftCol',
      attributeName: 'href',
      attributeValue: '/events'
    },
    pageArea: 'global-widgets',
    verifiedOn: '2026-09-20',
    evidence: ['raw-capture/gate3/news-article.html event-calendar CTA']
  },
  {
    id: 'stats-fixed-ui',
    selector: 'body',
    matcher: { kind: 'tag-name', value: 'body' },
    pageArea: 'stats',
    verifiedOn: '2026-09-30',
    evidence: ['docs/findings.md §12 user-supplied stats screenshot; full-label glossary admission only'],
    pathPrefixes: ['/stats']
  },
  {
    id: 'page-fixed-ui',
    selector: 'body',
    matcher: { kind: 'tag-name', value: 'body' },
    pageArea: 'global',
    verifiedOn: '2026-09-30',
    evidence: ['docs/findings.md §12 shared-label glossary admission; no inferred template class bindings']
  },
  {
    id: 'page-prose',
    selector: 'body',
    matcher: { kind: 'tag-name', value: 'body' },
    pageArea: 'global',
    verifiedOn: '2026-09-30',
    evidence: ['docs/findings.md §12 route-gated readable-text fallback; no inferred template class bindings'],
    exactPaths: ['/'],
    pathPrefixes: ['/news', '/stats', '/player', '/players', '/team', '/matches', '/results', '/events', '/ranking', '/major', '/fantasy', '/live', '/forums']
  },
  {
    id: 'recent-activity-topic',
    selector: '.right2Col .activitylist > a.activity > span.topic',
    matcher: { kind: 'tag-name-and-class', tagName: 'span', className: 'topic' },
    pageArea: 'global-widgets',
    verifiedOn: '2026-09-30',
    evidence: ['raw-capture/gate3/news-article.html .activitylist title spans separate from numeric counts']
  },
  {
    id: 'profile-fixed-ui',
    selector: 'body',
    matcher: { kind: 'tag-name', value: 'body' },
    pageArea: 'global',
    verifiedOn: '2026-09-30',
    evidence: ['docs/findings.md §10 observed profile wording; §12 full-label glossary admission without inferred profile classes'],
    pathPrefixes: ['/player', '/team']
  },
  {
    id: 'navigation-dropdown',
    // Dynamic event links keep the existing body/event translation admission.
    selector: '.navbar .navcon .dropdown-menu > li > a.dropdown-link:not([href^="/events/"]):not([href^="/fantasy/"]), .navbar .navcon .dropdown-menu > li > a.dropdown-link[href="/events/archive"]',
    matcher: { kind: 'tag-name-and-class', tagName: 'a', className: 'dropdown-link' },
    pageArea: 'global-navigation',
    verifiedOn: '2026-09-30',
    evidence: ['docs/findings.md §15 local shared shell and live dropdown DOM bindings']
  },
  {
    id: 'player-archive-filter',
    selector: '.players-archive .players-archive-navigation > a.players-archive-tab',
    matcher: { kind: 'tag-name-and-class', tagName: 'a', className: 'players-archive-tab' },
    pageArea: 'global-navigation',
    verifiedOn: '2026-09-30',
    evidence: ['docs/findings.md §15 live player archive alphabet controls'],
    pathPrefixes: ['/players/archive']
  }
];

// Fixed-label fallback must not visit executable, editable, or user-authored subtrees.
// Existing page-specific candidates still own their subtrees and retain their policies.
export const FIXED_UI_EXCLUSIONS = {
  tags: ['script', 'style', 'noscript', 'template', 'textarea', 'input', 'canvas'],
  classes: ['forum', 'recent-activity'],
  attributes: ['contenteditable'],
  attributePrefixes: ['data-livescore-', 'data-live-odds-'],
  // Observed BODY connection metadata is not a live value writer.
  attributePrefixExceptions: [{ name: 'data-livescore-server-url', tagName: 'body' }],
  protectedStrategies: ['time-format-unix', 'countdown-target', 'current-map-score', 'match-team-livescore', 'match-time', 'left-ranking-update-meta', 'match-teamname'],
  roles: ['textbox']
} as const;

export interface FixedUiAttributeTarget {
  selector: string;
  attribute: string;
  evidence: string;
  glossaryCategories: readonly string[];
  protectSubtrees: boolean;
  pathPrefixes?: readonly string[];
  exactPaths?: readonly string[];
}

export const FIXED_UI_ATTRIBUTE_TARGETS: readonly FixedUiAttributeTarget[] = [
  { selector: 'input[placeholder]', attribute: 'placeholder', glossaryCategories: ['ui'], protectSubtrees: false, evidence: 'raw-capture/gate3/news-article.html input hints' },
  { selector: '[title]', attribute: 'title', glossaryCategories: ['ui', 'ui-stats'], protectSubtrees: true, pathPrefixes: ['/stats'], evidence: 'docs/findings.md §13 observed statistics help wording; standard attribute admission only' },
  { selector: '[aria-label]', attribute: 'aria-label', glossaryCategories: ['ui', 'ui-stats'], protectSubtrees: true, pathPrefixes: ['/stats'], evidence: 'docs/findings.md §13 observed accessible control wording; standard attribute admission only' }
];

export const FIXED_UI_DECORATIONS = [
  { selector: '.minigame-label-new::after', term: 'New', evidence: 'raw-capture/gate3/matches-style.css minigame-label-new:after' }
] as const;
