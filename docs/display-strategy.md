# Display Strategy Proposal

Status: proposal for Gate 4 owner review. This document does not authorize display implementation. The match-list parent-selector check is still `Unable to confirm`, so Mode B remains conservative for compact match containers.

## Rules applied to every row

- The original string remains authoritative in the in-memory record table; the DOM is not the source of truth.
- If translation equals the original, or the value is pure numeric, pure date, or pure symbol text, write nothing. Mode A does not replace it and Mode B does not insert anything.
- IDs, URLs, attributes, data values, canonical team/player names, scores, and live values are protected unless an owner-approved glossary later says otherwise.
- Position-sensitive or compact table/grid content is Mode A only. Mode B is not proposed for those elements until parent-level CSS and runtime mutation evidence is complete.
- `data-countdown-target-timestamp` content is currently prohibited from translation because HLTV overwrites its child text every second.

## Element strategy table

| Element type | Evidence / selector | Translate or keep | Suggested mode | Reason and risk |
|---|---|---|---|---|
| Team name | `match-teamname` (207 supplied match-list occurrences); match-detail team containers are different classes | Keep canonical name | Mode A no-op; Mode B withheld | Team names are proper nouns and may be glossary-protected. The supplied script scan found no client writer, but the parent CSS/child-position check is still unresolved. |
| Player ID | Player links/IDs and identifier-like text | Keep | Mode A no-op | IDs are not prose and must not be sent to translation or rewritten. |
| Map name | Match map labels and map identifiers | Keep canonical name | Mode A no-op unless later glossary approval changes this | Map names are stable game identifiers. Translating them without an approved terminology authority risks ambiguity. |
| Event/tournament name | `match-event` (1,573 supplied match-list occurrences); `event`, `eventname`, and article event blocks in other captures | Translate only clearly eligible user-facing prose; protect official names when required | Mode A only for compact match cards; Mode B deferred there | Static output has no observed writer, but compact-card width and parent CSS dependencies are not fully confirmed. |
| Match stage / format | `match-stage` (452 supplied occurrences), stage/BO labels | Translate eligible labels | Mode A only | Compact match cards make extra sibling nodes a layout and child-count risk. |
| Match metadata | `match-meta` (457 supplied occurrences), mixed date/stat/format text | Keep protected values; translate only a clearly separable prose segment | Mode A only | Mixed content must be segmented conservatively; dates, numbers, and abbreviations must remain byte-for-byte. |
| Statistics table header | Table/grid header text, selector stability not yet confirmed | Translate eligible English headers | Mode A only | Headers are compact and may participate in table layout or position assumptions. Mode B could shift columns. |
| Numbers and time | `match-time` (442 supplied occurrences), dates, scores, statistics | Keep | No-op | Pure numeric/date/symbol values are covered by the no-noise rule. Do not translate timezone-adjusted timestamps as prose. |
| Countdown target | Elements carrying `data-countdown-target-timestamp` | Keep; prohibited from translation | Neither A nor B | `hltv-matches-js.js` reads the target timestamp and writes countdown child `textContent` every second. Any extension text would be overwritten on the next tick. |
| News title | News archive rows and article title; article sample title is server-rendered | Translate eligible English prose | Mode B candidate; Mode A fallback for compact rows | Bilingual presentation preserves the headline and is useful for reading. Wrapping/height impact in the archive list was not measured, so Mode B requires owner review. |
| Article body | `newsitem`, `news-block`, `newstext-con` in the article sample | Translate eligible prose | Mode B candidate | Article paragraphs are the strongest bilingual candidate and have no observed framework or htmx swap. Runtime insertion behavior and layout still require review before implementation. |
| Score / live data | `current-map-score` (20 supplied match-list occurrences); `match-team-livescore` (5); `data-livescore-*` on match detail | Keep | Neither A nor B | Socket.IO `score` events update these nodes via `textContent`. Translation would be stale or would interfere with a live writer. |
| Live odds | `data-live-odds-*` elements on match pages | Keep | Neither A nor B | The match script fetches and updates odds independently; values are numeric and dynamic. |

## Current approval boundary

The table is intentionally conservative. Gate 4 must approve each row, especially the Mode B candidates and the match-list parent CSS dependency. Until that review and the missing P0-3 evidence are resolved, no DOM replacement, sibling insertion, observer reconciliation, translation request, or glossary implementation should begin.
