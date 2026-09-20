# Display Strategy Proposal

Status: Gate 4 owner-confirmed strategy, recorded for later implementation. This document does not authorize display implementation. The `/matches` and news/article parent-selector checks are complete for the documented containers; fixed dimensions make `match-stage`, `match-meta`, and `newstc` unsuitable for insertion. CSS for the match-detail `.match-page`/score area remains `Unable to confirm`.

## Rules applied to every row

- The original string remains authoritative in the in-memory record table; the DOM is not the source of truth.
- If translation equals the original, or the value is pure numeric, pure date, or pure symbol text, write nothing. Mode A does not replace it and Mode B does not insert anything.
- IDs, URLs, attributes, data values, canonical team/player names, scores, and live values are protected unless an owner-approved glossary later says otherwise.
- For `/matches` and the inspected news/article containers, use the element-level CSS boundary below: `match-event`, `match-time`, `newstext`, and `news-block` are bilingual-feasible candidates; `match-teamname` is never translated; fixed-dimension `match-stage`, `match-meta`, and `newstc` are not insertion targets. Do not transfer these results to the uninspected match-detail `.match-page`/score area.
- `data-countdown-target-timestamp` content is currently prohibited from translation because HLTV overwrites its child text every second.
- Global time-field rule: any element carrying both `data-time-format` and `data-unix` is prohibited from translation and sibling insertion. Confirmed evidence covers match-list `.match-time`, comment `span.time`, article `div.date`, and match-detail time fields.

## Gate 4 implementation agreements

- Provider boundary: use an interchangeable LLM provider interface around the OpenAI-compatible `/chat/completions` protocol. DeepSeek, OpenAI, and a local model must be selectable by changing only `baseURL` and model name; no provider is selected or hard-coded at this gate, and DeepL is not used.
- Partial event translation: `glossary.json` entries with `keep_as_is` define the protected brand fragments. The prompt must list those fragments as immutable for each request. The response must be validated for byte-for-byte retention of every protected fragment; on failure, discard the result, render nothing, and fall back to the original. Reordering such as `Fall 2026` → `2026 秋季赛` requires structural validation and may not rely on unconstrained model output alone.
- Comment translation: translate a comment only when it is classified as English. A low-confidence result, a failed classification, or a comment containing Chinese characters keeps the entire original comment. Comments are translated as a whole and never use the partial-translation path. Failed or uncertain comment classifications must be recordable for later review.
- P0-LANG: when language confidence is low, preserve the original rather than making a destructive translation decision.

## Glossary asset contract

The repository-root `glossary.json` is the authoring asset with this schema:

```json
{
  "version": 1,
  "entries": [
    {
      "term": "StarLadder StarSeries",
      "target": "StarLadder StarSeries",
      "keep_as_is": true,
      "category": "event",
      "note": "品牌名，保留英文"
    }
  ]
}
```

Every entry must provide `term`, `target`, `keep_as_is`, and `category`. A loader must reject an entry and report a diagnostic when `keep_as_is` is `true` but `target` differs from `term`; it must not silently normalize the contradiction. The `version` field reserves room for future schema evolution.

Vite copies the root asset to the built extension as `dist/glossary.json`. Runtime code must read the packaged extension resource (for example through the extension runtime URL), never the repository file path; the root file is not available to an installed extension. The build output is the runtime source of truth.

## Element strategy table

| Element type | Evidence / selector | Translate or keep | Suggested mode | Reason and risk |
|---|---|---|---|---|
| Team name | `match-teamname` (207 local `/matches` occurrences); match-detail team containers are different classes | Keep canonical name; never translate | Mode A no-op; no Mode B | `Aurora` remains `Aurora`. The name is a protected proper noun by owner decision; the `/matches` CSS evidence is not a reason to enter Mode B. Match-detail team CSS is a separate, uninspected boundary. |
| Player ID | Player links/IDs and identifier-like text | Keep | Mode A no-op | IDs are not prose and must not be sent to translation or rewritten. |
| Map name | Match map labels and map identifiers | Keep canonical name | Mode A no-op unless later glossary approval changes this | Map names are stable game identifiers. Translating them without an approved terminology authority risks ambiguity. |
| Event/tournament name | `match-event` (1,573 local `/matches` occurrences); `event`, `eventname`, and article event blocks in other captures | Partially translate; preserve glossary-protected brand fragments | Mode B on `/matches`; page-specific mode remains unapproved elsewhere | Example: `StarLadder StarSeries Fall 2026` → `StarLadder StarSeries 2026 秋季赛`. `.matches-v4 .match-event` is `display:flex; flex:1` with no fixed width/height rule found in this scan. CSS evidence: `raw-capture/gate3/matches-style.css` (`.matches-v4 .match-event`). The partial-translation validation contract is above; it does not cover event containers on news or match-detail pages. |
| Match stage / format | `match-stage` (452 local occurrences), stage/BO labels | Translate eligible labels | Mode A only | `.matches-v4 .match-stage` fixes height/line-height at 14px and its playoff variants fix widths at 62px, 51px, 45px, and 65px. Sibling insertion can be clipped or overflow. CSS evidence: `raw-capture/gate3/matches-style.css` (`.matches-v4 .match-stage` and its `.match-grand-final`, `.match-semifinal`, `.match-other-playoff`, and `.match-quarterfinal` rules). |
| Match metadata | `match-meta` (457 local occurrences), mixed date/stat/format text | Keep protected values; translate only a clearly separable prose segment | Mode A only | `.matches-v4 .match-meta` fixes width at 28px, with a narrow-media width of 22px. Sibling insertion can be clipped or overflow; dates, numbers, and abbreviations must remain byte-for-byte. CSS evidence: `raw-capture/gate3/matches-style.css` (`.matches-v4 .match-meta`). |
| Statistics table header | Table/grid header text, selector stability not yet confirmed | Translate eligible English headers | Mode A only | Headers are compact and may participate in table layout or position assumptions. Mode B could shift columns. |
| Numbers and time | `match-time`, comment `.time`, article `.date`, match-detail time fields, dates, scores, statistics | Keep pure values; all `data-time-format`/`data-unix` fields are prohibited from translation | No-op for pure values; no insertion into dynamic time fields | Pure numeric/date/symbol values are covered by the no-noise rule. `hltv-csstheme.js` rewrites every element carrying both data attributes. Evidence spans match-list `.match-time`, comment `span.time`, article `div.date`, and match-detail time fields; the rule is global. |
| Countdown target | Elements carrying `data-countdown-target-timestamp` | Keep; prohibited from translation | Neither A nor B | `hltv-matches-js.js` reads the target timestamp and writes countdown child `textContent` every second. Any extension text would be overwritten on the next tick. The `/matches` static-CSS scan does not override this dynamic-writer prohibition. |
| News title | `.newsline.article .newstext`; archive sample is server-rendered | Translate eligible English prose | Mode B feasible | The inspected archive page has an enclosing `.index`, so `.index .newstext` applies: `flex:1 1 auto` with no fixed width or `overflow:hidden`. CSS evidence: the supplied 2,524,977-byte `hltv-everything.css`. This conclusion is scoped to the inspected `.index` list structure. |
| News metadata | `.newstc` containing date and comment count | Keep; prohibit translation and node insertion | Neither A nor B | `.index .newstc` has `min-width:80px` and `text-align:right`. Inserting a sibling or translating the compact metadata risks layout changes; this field is not an approved target. |
| Article body | `.newsdsl .newstext-con` and `p.news-block` in the article sample | Translate eligible prose | Mode B feasible | `.newsdsl .newstext-con` has font-size/line-height/position rules only, and `.news-block` has margin rules without fixed width/height or `overflow:hidden`. CSS evidence: the supplied 2,524,977-byte `hltv-everything.css`. Inline team/player links remain protected identifiers and are not translated by this row. |
| Comment | `.match-comments > .forum .post .forum-middle`; 195 server-rendered `post` elements | Translate only comments classified as English; keep all other comments unchanged | Mode B | The comment body has no fixed width/height and no `overflow:hidden`: `.forum .forum-middle,.fragments-overlay .forum-middle` uses `font-size:13px; white-space:pre-line` and `overflow-x:auto; padding:6px 9px`. CSS evidence: the supplied 2,524,977-byte `hltv-everything.css`. `:nth-child`/`:first-child` scans for `post`/`children`/`threading`/`forum-middle` were zero. `content-visibility:auto` may change intrinsic scroll estimates, so small scroll-position shifts must be observed later. Comment times are excluded, and comments never use partial translation. |
| Score / live data | `current-map-score` (20 local `/matches` occurrences); `match-team-livescore` (5); `data-livescore-*` on match detail | Keep; prohibited from translation | Neither A nor B | Socket.IO `score` events update these nodes via `textContent`. Translation would be stale or interfere with a live writer. The match-detail `.match-page`/score-area parent CSS was not checked and remains `Unable to confirm`; `/matches` CSS evidence does not transfer. |
| Live odds | `data-live-odds-*` elements on match pages | Keep | Neither A nor B | The match script fetches and updates odds independently; values are numeric and dynamic. |

## Current approval boundary

The Gate 4 decisions and evidence boundaries are:

- Never translate team names: `match-teamname` is Mode A no-op and excluded from Mode B by owner decision.
- Partially translate event names on `/matches`: `match-event` is structurally bilingual-feasible because the target rule is flex-based with no fixed width/height rule found. Evidence: `raw-capture/gate3/matches-style.css` (2,524,977 local bytes), `.matches-v4 .match-event`. Protected brand fragments follow the partial-translation contract above.
- `match-time` is treated as `never` in B1. Although no fixed width rule was found, match-time is a dynamic/pure value and is covered by the global `data-time-format` + `data-unix` prohibition. Encoding the whole element as no-op is behaviorally equivalent to checking the attributes one by one and is less likely to miss a dynamic value. Evidence: the same stylesheet's `.matches-v4 .match-time` plus the global time-field evidence.
- Mode A only because of fixed dimensions that can clip or overflow inserted content: `match-stage` and `match-meta`. Evidence: the same stylesheet's `.matches-v4 .match-stage` 14px height/line-height and 62px/51px/45px/65px variant widths, plus `.matches-v4 .match-meta` 28px/22px widths.
- Comments use Mode B only for confidently English full-comment bodies. Evidence: the supplied stylesheet's `.forum .forum-middle` rules have no fixed width/height or `overflow:hidden`; `content-visibility:auto` is a recorded scroll-layout risk. Comment language and fallback rules are above.
- News title and article body use Mode B with the inspected `.index .newstext` and `.newsdsl .newstext-con`/`.news-block` CSS evidence. The conclusion is scoped to those structures; no news result is transferred to the uninspected match-detail `.match-page`/score area.
- News metadata `.newstc` is prohibited from translation and insertion because of `min-width:80px` and right alignment.
- The global `data-time-format` + `data-unix` prohibition covers match-list, comment, article, and match-detail time fields.
- Translation forbidden: elements carrying `data-countdown-target-timestamp` and `data-livescore-*`. Evidence: `hltv-matches-js.js` rewrites countdown child text every second, and the Socket.IO livescore module writes live values through `textContent`; these dynamic-writer facts take precedence over static layout.

The `/matches`, news/article, and comment CSS evidence is route-scoped. Parent CSS for the match-detail `.match-page`/score area has not been checked and remains `Unable to confirm`. Gate 4 decisions do not authorize implementation; any later implementation must preserve these boundaries and the owner-approved fallback rules.
