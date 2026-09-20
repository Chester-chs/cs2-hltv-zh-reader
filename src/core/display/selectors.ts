export type SelectorId =
  | 'match-teamname'
  | 'match-event'
  | 'match-stage'
  | 'match-meta'
  | 'match-time'
  | 'current-map-score'
  | 'match-team-livescore'
  | 'time-format-unix'
  | 'countdown-target';

export type SelectorMatcher =
  | {
      kind: 'class';
      value: string;
    }
  | {
      kind: 'attributes';
      names: readonly string[];
    };

export interface SelectorDefinition {
  id: SelectorId;
  selector: string;
  matcher: SelectorMatcher;
  pageArea: 'matches';
  verifiedOn: '2026-09-20';
  evidence: readonly string[];
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
    pageArea: 'matches',
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
    pageArea: 'matches',
    verifiedOn: '2026-09-20',
    evidence: ['docs/findings.md §6 P0-3']
  }
];
