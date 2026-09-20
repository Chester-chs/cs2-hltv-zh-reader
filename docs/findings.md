# Gate 3 Findings

Status: reconnaissance outputs recorded for the current Chrome and Edge scope. The page and script evidence is sufficient to classify the three sampled page types as server-rendered HTML with native JavaScript and no observed framework-owned virtual DOM. P0-3 remains `Unable to confirm`, so the display architecture is not cleared for implementation.

Access date: 2026-09-20. Capture requests used `curl.exe` with a full Chrome-style browser user agent and `Accept-Language: en-US`, sequentially with at least two seconds between requests. No Puppeteer, Playwright, parallel request, or retry loop was used.

## 1. Capture set and provenance

The project owner's `/matches` facts below are adopted without re-fetching that page. The owner-reported raw files were not present in the current working tree, so no new conclusion is derived from an absent local copy.

| Page kind | Exact URL | Status / body size | Evidence reference |
|---|---|---:|---|
| Match list | `https://www.hltv.org/matches` | HTTP 200 / 1,243,948 bytes | Owner-supplied `raw-capture/gate3/matches.html` and `scripts/s1..s10.js`; not re-fetched |
| News list | `https://www.hltv.org/news/archive/2026/september` | HTTP 200 / 354,590 local bytes | `raw-capture/gate3/news-list.html` and `news-list.headers.txt` |
| News article | `https://www.hltv.org/news/45557/50000-winline-cis-lan-season-9-announced` | HTTP 200 / 214,043 local bytes | `raw-capture/gate3/news-article.html` and `news-article.headers.txt` |
| Match detail | `https://www.hltv.org/matches/2398108/aurora-vs-vitality-starladder-starseries-fall-2026` | HTTP 200 / 586,917 local bytes | `raw-capture/gate3/match-detail.html` and `match-detail.headers.txt` |

The news-list URL was resolved without guessing a stale article URL. `https://www.hltv.org/sitemap_index.xml` returned HTTP 200 and listed `https://www.hltv.org/news-sitemap.xml`; that sitemap returned HTTP 200 and listed real article URLs. The separately captured home page contained the navigation link `/news/archive/2026/september`, which was then captured once as the news-list sample.

Supporting captures are local-only under `raw-capture/gate3/` and are ignored by Git.

## 2. Interception and server-rendering checks

### Match list: owner-supplied facts

- HTTP 200, 1,243,948 bytes, title `Counter-Strike Matches & livescore | HLTV.org`.
- Headers contained `CF-Ray`, `CF-Cache-Status: DYNAMIC`, and `Server: cloudflare`, but no `cf-mitigated` header.
- No challenge/interstitial title or body signature was present.
- The complete 1.24 MB HTML contained zero occurrences of the recorded React, Next, Nuxt, Vue, Svelte, Angular, and Alpine markers.
- `https://resources.hltv.org/hltv-bundle/hltv-CL7PLUBn.js` was loaded; the owner scan identified it as htmx (123,885 bytes and 187 htmx identifiers, including `htmx.config.responseHandling`). However, `hx-get`, `hx-post`, `hx-trigger`, `hx-target`, and `hx-swap` were all zero in the page HTML.

### New captures

All three new page responses were normal HTML responses: HTTP 200, `Content-Type: text/html;charset=utf-8`, with Cloudflare delivery headers (`CF-Ray`, `CF-Cache-Status: DYNAMIC`, and `Server: cloudflare`). No `cf-mitigated` header or challenge phrase was found in the local headers/body scan.

| Page | Title | Framework markers | htmx attributes |
|---|---|---:|---:|
| News list | `HLTV.org - News Archive September, 2026 \| HLTV.org` | all zero | all zero |
| News article | `$50,000 WINLINE CIS LAN Season 9 announced \| HLTV.org` | all zero | all zero |
| Match detail | `Aurora vs. Vitality at StarLadder StarSeries Fall 2026 \| HLTV.org` | all zero | all zero |

The framework scan covered `__REACT_DEVTOOLS_GLOBAL_HOOK__`, `data-reactroot`, `__NEXT_DATA__`, `__NUXT__`, `data-v-`, `svelte`, `angular`, `alpine`, and Alpine directives `x-data`, `x-init`, `x-show`, `x-text`, and `@click`. The htmx scan covered `hx-get`, `hx-post`, `hx-trigger`, `hx-target`, and `hx-swap`.

Each new page referenced the same `hltv-CL7PLUBn.js` bundle, but none contained an `hx-*` activation attribute. The htmx identification and byte/identifier count above come from the supplied `/matches` bundle inspection and are applied to the same immutable asset URL.

The three new response headers contained no `Content-Security-Policy` or `Content-Security-Policy-Report-Only` header. CSP for the owner-supplied `/matches` response is `Unable to confirm` because its raw header file was not available in this workspace and the page was not re-fetched.

Conclusion for the sampled pages: the initial view is SSR HTML, with native JavaScript enhancing selected behavior. No React/Vue/Svelte-style virtual-DOM ownership was found. This conclusion is limited to the three captured page types and the supplied `/matches` scan; it is not a claim about every HLTV route.

## 3. Page-type comparison

### News list

The archive page is a concrete list view and contains `newsline article`, `newsheader`, `newstext`, and `newstc` containers. It contains no `match-teamname`, `match-event`, or other match-card target class from the supplied `/matches` inventory. Its first-party page script is `hltv-base-js.js`; no DOM child-position expression was found in the captured first-party script set.

### News article

The article contains `newsitem standard-box`, `news-block`, `article-info`, `newstext-con`, and article/event/team content. It loads `hltv-news-item-js.js`. The script contains a POST path for article poll voting and ad-impression requests, but no `EventSource`, native `WebSocket`, DOM child-position expression, or article-body replacement loop was found in the inspected source.

### Match detail

The match-detail page contains a `match-page`, team/event sections, a `data-livescore-server-url="https://scorebot-lb.hltv.org"` body attribute, and `data-livescore-*` nodes. It preloads `livescore-_VRQttOJ.js`, `Main-DqFx6WGj.js`, and the shared runtime. `current-map-score` occurs in the captured page, and the score nodes are selected by data attributes rather than by child position. `hltv-match-js.js` contains live-odds fetching and repeated scheduling, but the scoreboard path is in the separate livescore module described below.

### Match list

The supplied inventory reports 207 `match-teamname`, 1,573 `match-event`, 452 `match-stage`, 457 `match-meta`, 442 `match-time`, 20 `current-map-score`, and 5 `match-team-livescore` elements. The supplied target-class script search reported `match-teamname=0`, `match-event=0`, `match-meta=0`, `match-stage=0`, `match-team=0`, `match-wrapper=2`, `current-map-score=3`, and `match-time=1` in script bodies. Team/event/stage/meta output is static in the inspected scripts; current time and score fields are dynamic targets. The supplied ten-script scan covered 1,236,708 bytes and found `children[0]=0`, `firstElementChild=0`, `lastElementChild=0`, `childNodes[=1`, `.children[=1`, and `nth-child=2`; the one `childNodes[0]` hit belonged to htmx fragment handling, the one `.children[` hit belonged to gtag traversal, and neither targeted match containers.

## 4. P0-1: page-type consistency

Result: confirmed for the three sampled page types plus the supplied match-list evidence, with the following boundary:

- All four page samples are SSR-first and contain no framework markers.
- htmx is present as a shared loaded bundle, but all five `hx-*` attributes were zero in all four page HTML samples. No htmx swap was observed in the captured documents.
- The first-party scripts captured for the news list, article, and match detail contained zero occurrences of `children[`, `firstElementChild`, `lastElementChild`, `childNodes[`, and `nth-child`.
- The supplied `/matches` ten-script scan found only the unrelated htmx/gtag positional accesses described above.

This is enough to make a framework-driven virtual-DOM rewrite unlikely on the sampled routes. It does not prove that an uninspected route or a future script cannot swap a container. In particular, no browser runtime session or MutationObserver trace was performed here, so SPA navigation and live DOM mutation timing remain `Unable to confirm`.

## 5. P0-2: live-score update mechanism

The previously unexamined module-preload path resolves the mechanism:

1. Each captured page includes `data-livescore-server-url="https://scorebot-lb.hltv.org"` and preloads `livescore-_VRQttOJ.js` and `Main-DqFx6WGj.js`.
2. `livescore-_VRQttOJ.js` finds `[data-livescore-server-url] [data-livescore-match]`, creates a `LiveScoreManager`, and starts it.
3. `Main-DqFx6WGj.js` constructs a `SocketIO` client through the imported `io` factory, opens it, sends `readyForScores`, listens for the `score` event, and passes received scores to `MatchScoreReceiver`.
4. The livescore module writes score, map, live-state, and maps-won values through `textContent` on `data-livescore-*` nodes.

Therefore the current evidence identifies server-pushed Socket.IO score updates, not page reloads, htmx swaps, SSE, or a score-specific `fetch` polling loop. The owner-supplied `/matches` scan had no `EventSource`, no native `WebSocket`, and no score polling fetch; the newly captured source uses the Socket.IO `io` abstraction instead. The `fetch` calls in `hltv-match-js.js` are labelled and structured as live-odds requests, not score updates.

The one-second `data-countdown-target-timestamp` writer in `https://resources.hltv.org/scripts/hltv-matches-js.js/6df88f98b7d23388b8424869dc2feefc.js` is a separate local countdown mechanism. It reads `getAttribute("data-countdown-target-timestamp")` and repeatedly assigns `textContent` (including `"00"` at expiry) to countdown children, so it can overwrite extension text every second.

The runtime handshake, reconnect behavior, and observed message interval are `Unable to confirm` because this run used static curl/source evidence rather than a live browser Network trace. The update transport itself is confirmed by the loaded module source and endpoint/data-attribute wiring.

## 6. P0-3: sibling insertion and CSS position dependence

The new news-list, news-article, and match-detail HTML files contain zero occurrences of `:nth-child`, `:first-child`, or `:last-child`. The captured `hltv-csstheme.js` file also contains zero occurrences of those selectors and contains only theme/class initialization code, not target-container CSS rules.

For the actual `/matches` targets, the required parent-level check is `Unable to confirm`. The owner-supplied facts give target counts and script-scan results but do not include the parent-selector result, and the referenced `raw-capture/gate3/matches.html` was not available locally. The page was not re-fetched because the handoff explicitly says to adopt its confirmed facts and not repeat that capture.

Consequences:

- The low script-level positional risk is evidence against one class of breakage, not proof that a sibling insertion is safe.
- Mode B must remain withheld for any element whose parent-level CSS/DOM dependency has not been inspected.
- No architecture decision may rely on the absence of `:nth-child` in the unrelated pages as proof for match-list containers.

## 7. Layout and runtime limits

No normal/narrow viewport visual measurement, browser reload comparison, or MutationObserver trace was performed in this curl-only pass. Wrapping, overflow, column shift, row-height changes, and selector stability across reloads are therefore `Unable to confirm`. These are recorded as limits rather than inferred from class names.

## 8. robots.txt and route-resolution evidence

The owner-supplied `https://www.hltv.org/robots.txt` capture was 1,646 bytes. Its key recorded rule is `Disallow: /matches?*`; other conservative query-parameter patterns cover `/stats` and `/results`, and the sitemap declaration points to `sitemap_index.xml`. This is analyzed separately from browser-extension behavior in `docs/compliance.md`.

The captured sitemap index listed `https://www.hltv.org/news-sitemap.xml`. That sitemap supplied current article URLs, while the captured home page supplied `/news/archive/2026/september` as the current news-list navigation target.

## 9. Gate 3 conclusion and next allowed action

- Gate 3A: page capture, SSR/framework comparison, sitemap resolution, and static script inspection are recorded.
- Gate 3B/P0-1: no framework or target-container positional update was found in the supplied/inspected evidence, subject to the scope limits above.
- P0-2: live scores are wired through the Socket.IO livescore module and `score` events; runtime interval remains unmeasured.
- Gate 3B/P0-3: `Unable to confirm` for the match-list parent CSS/DOM dependency.

The P0-3 evidence gap keeps the display architecture decision blocked. The next allowed action is to inspect the owner-supplied match-list HTML/CSS evidence or perform the specifically approved read-only parent-selector check. No display implementation, translation API, DOM insertion, or network interception is authorized by these findings.
