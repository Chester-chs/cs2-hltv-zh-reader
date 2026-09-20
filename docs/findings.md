# Gate 3 Findings

Status: reconnaissance outputs recorded for the current Chrome and Edge scope. The page and script evidence is sufficient to classify the three sampled page types as server-rendered HTML with native JavaScript and no observed framework-owned virtual DOM. P0-3 is resolved for `/matches`, while the page-specific CSS checks for news and match-detail containers remain `Unable to confirm`. Gate 4 decisions are recorded below; implementation remains outside this documentation step.

Access date: 2026-09-20. Capture requests used `curl.exe` with a full Chrome-style browser user agent and `Accept-Language: en-US`, sequentially with at least two seconds between requests. No Puppeteer, Playwright, parallel request, or retry loop was used.

## 1. Capture set and provenance

The `/matches` HTML and primary stylesheet were re-fetched locally on 2026-09-20 under the explicit P0-3 authorization. The HTML request and stylesheet request were sequential and separated by at least two seconds; both returned HTTP 200. The other page captures remain the single, previously recorded curl captures.

| Page kind | Exact URL | Status / body size | Evidence reference |
|---|---|---:|---|
| Match list | `https://www.hltv.org/matches` | HTTP 200 / 1,247,718 local bytes | Local re-fetch: `raw-capture/gate3/matches.html` and `matches.headers.txt`; supplied scripts remain the script-scan source |
| Match-list stylesheet | `https://resources.hltv.org/hltv-everything.css/fdddc7f98fef6cb157c3efd609bb3360.css` | HTTP 200 / 2,524,977 local bytes | Local re-fetch: `raw-capture/gate3/matches-style.css` and `matches-style.headers.txt` |
| News list | `https://www.hltv.org/news/archive/2026/september` | HTTP 200 / 354,590 local bytes | `raw-capture/gate3/news-list.html` and `news-list.headers.txt` |
| News article | `https://www.hltv.org/news/45557/50000-winline-cis-lan-season-9-announced` | HTTP 200 / 214,043 local bytes | `raw-capture/gate3/news-article.html` and `news-article.headers.txt` |
| Match detail | `https://www.hltv.org/matches/2398108/aurora-vs-vitality-starladder-starseries-fall-2026` | HTTP 200 / 586,917 local bytes | `raw-capture/gate3/match-detail.html` and `match-detail.headers.txt` |

The news-list URL was resolved without guessing a stale article URL. `https://www.hltv.org/sitemap_index.xml` returned HTTP 200 and listed `https://www.hltv.org/news-sitemap.xml`; that sitemap returned HTTP 200 and listed real article URLs. The separately captured home page contained the navigation link `/news/archive/2026/september`, which was then captured once as the news-list sample.

Supporting captures are local-only under `raw-capture/gate3/` and are ignored by Git.

The local re-fetch differs from the handoff byte counts: the handoff reported 1,243,948 bytes for the HTML and 2,524,946 bytes for the stylesheet; the local files are 1,247,718 bytes (+3,770) and 2,524,977 bytes (+31), respectively. The cause of the byte-size difference was not established. The P0-3 conclusion below follows the local re-fetch and records the supplied facts only where they remain applicable.

## 2. Interception and server-rendering checks

### Match list: local targeted re-fetch

- HTTP 200, 1,247,718 local bytes, title `Counter-Strike Matches & livescore | HLTV.org`.
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

The three new response headers contained no `Content-Security-Policy` or `Content-Security-Policy-Report-Only` header. The local `/matches` response headers and stylesheet headers also contained no CSP header.

Conclusion for the sampled pages: the initial view is SSR HTML, with native JavaScript enhancing selected behavior. No React/Vue/Svelte-style virtual-DOM ownership was found. This conclusion is limited to the three captured page types and the supplied `/matches` scan; it is not a claim about every HLTV route.

## 3. Page-type comparison

### News list

The archive page is a concrete list view and contains `newsline article`, `newsheader`, `newstext`, and `newstc` containers. It contains no `match-teamname`, `match-event`, or other match-card target class from the supplied `/matches` inventory. Its first-party page script is `hltv-base-js.js`; no DOM child-position expression was found in the captured first-party script set.

### News article

The article contains `newsitem standard-box`, `news-block`, `article-info`, `newstext-con`, and article/event/team content. It loads `hltv-news-item-js.js`. The script contains a POST path for article poll voting and ad-impression requests, but no `EventSource`, native `WebSocket`, DOM child-position expression, or article-body replacement loop was found in the inspected source.

### Match detail

The match-detail page contains a `match-page`, team/event sections, a `data-livescore-server-url="https://scorebot-lb.hltv.org"` body attribute, and `data-livescore-*` nodes. It preloads `livescore-_VRQttOJ.js`, `Main-DqFx6WGj.js`, and the shared runtime. `current-map-score` occurs in the captured page, and the score nodes are selected by data attributes rather than by child position. `hltv-match-js.js` contains live-odds fetching and repeated scheduling, but the scoreboard path is in the separate livescore module described below.

### Match list

The local re-fetch reports 207 `match-teamname`, 1,573 `match-event`, 452 `match-stage`, 457 `match-meta`, 442 `match-time`, 20 `current-map-score`, and 5 `match-team-livescore` elements. The supplied target-class script search reported `match-teamname=0`, `match-event=0`, `match-meta=0`, `match-stage=0`, `match-team=0`, `match-wrapper=2`, `current-map-score=3`, and `match-time=1` in script bodies. Team/event/stage/meta output is static in the inspected scripts; current time and score fields are dynamic targets. The supplied ten-script scan covered 1,236,708 bytes and found `children[0]=0`, `firstElementChild=0`, `lastElementChild=0`, `childNodes[=1`, `.children[=1`, and `nth-child=2`; the one `childNodes[0]` hit belonged to htmx fragment handling, the one `.children[` hit belonged to gtag traversal, and neither targeted match containers.

## 3A. Targeted comment-area reconnaissance

Evidence basis for this subsection: the owner-supplied Gate 4 capture of `https://www.hltv.org/matches/2398108/aurora-vs-vitality-starladder-starseries-fall-2026` (HTTP 200, 717,697 bytes) and the primary stylesheet `https://resources.hltv.org/hltv-everything.css/fdddc7f98fef6cb157c3efd609bb3360.css` (2,524,977 bytes). These facts were adopted directly for Gate 4; no additional request was made. The earlier local Gate 3 match-detail capture is not used for the comment counts below.

### Comment rendering and DOM structure

1. Comments are server-rendered. The initial HTML contains 195 `class="post"` elements, and all sampled comment bodies are present in that response. The earlier suggestion that comments might be client-loaded was incorrect: the keyword search failed because the comment block classes do not contain the word `comment`. The outer `class="match-comments"` container occurs once.
2. The relevant structure is:

```html
<div class="match-comments" data-original-overlay-location="...">
  <div class="forum no-promode" data-forum-thread-id="3180197">
    <div class="post" id="r69926602">
      <div class="standard-box">
        <div class="forum-topbar" data-topbar-post="r69926602">
          <a class="replyNum">#1</a>
          <div class="fan-con">...</div>
          <img class="flag" title="Russia"><a class="authorAnchor">H3LG3</a>
        </div>
        <div class="forum-middle">Congratulations mouz</div>
        <div class="forum-bottombar">...</div>
      </div>
      <div class="children">
        <div class="threading" data-threading-reply-parent="r69926602">
          <div class="post" id="r69927038">...</div>
        </div>
      </div>
    </div>
  </div>
</div>
```

The comment body is `.forum-middle`. Nested replies are under `.children > .threading`. The supplied count is 195 `post` elements, 122 `children` elements, and 73 `threading` elements.

### Comment layout, position, and rendering behavior

3. The comment body is structurally suitable for Mode B. The stylesheet has:

```css
.forum .forum-middle,.fragments-overlay .forum-middle{font-size:13px;white-space:pre-line}
.forum .forum-middle,.fragments-overlay .forum-middle{overflow-x:auto;padding:6px 9px}
```

No fixed width, fixed height, or `overflow:hidden` was found for the comment body. This is materially looser than the fixed-dimension `match-stage` and `match-meta` containers.
4. Position-selector risk was not found at the comment targets. `.children` has only `.threading` as its child, so `.threading:last-child` is invariant. The targeted `:nth-child` and `:first-child` scans for `post`, `children`, `threading`, and `forum-middle` were all zero. Appending a sibling inside `.forum-middle` does not change `.threading`'s index inside `.children`.
5. HLTV uses content-visibility as a performance optimization:

```css
.forum .post,.fragments-overlay .post{margin-bottom:10px}
.forum .post{contain-intrinsic-size:auto 100px;content-visibility:auto;
              margin:-3px -3px 7px;padding:3px}
```

`content-visibility:auto` can skip rendering for off-screen comments while keeping them in the DOM; an inserted translation should become visible when the comment is scrolled into view. The inserted node may change the intrinsic-size estimate and cause a small scroll-position jump. The magnitude of that jump is `Unable to confirm` until an actual rendered check.

### Dynamic comment fields and language evidence

6. Comment timestamps are dynamic and prohibited from translation. The time nodes use `data-time-format` and `data-unix`, and `hltv-csstheme.js` contains the confirmed rewrite:

```js
document.querySelectorAll(`[data-time-format][data-unix]`).forEach(t=>{
  t.textContent = formatJavaPattern(
    parseInt(t.dataset.unix,10), t.dataset.timeFormat, e
  )
})
```

The extension must not translate or append to these comment-time nodes because the timezone rewrite can replace their text.
7. The sampled comment language is highly mixed: `Congratulations mouz`, `Thank you <3`, `bot [emoji]`, `lol 4`, `aurora will 2-0 mouz in semis #jimisrevenge #jimfapisback`, `ez for aurora 3-1, we are looking so good right now mashallah`, `Ez 4 GOON BOSS CEM FUAT`, and `1v9?? gl`. Short text, slang, abbreviations, emoji, hashtags, and mixed English/Russian/Portuguese make language classification high-risk.

Conclusion: comments are SSR content, and Mode B is approved only for a whole `.forum-middle` body that is confidently classified as English. Other languages, low-confidence classifications, failed classifications, and comments containing Chinese characters remain unchanged. Comment translation never uses the event-name partial-translation path. The CSS conclusion is limited to this comment area; it is not evidence about news `newsline` or match-detail `.match-page`/score containers.

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

Capture evidence for this section (2026-09-20):

- HTML: `https://www.hltv.org/matches`, HTTP 200, 1,247,718 local bytes, `raw-capture/gate3/matches.html`.
- Stylesheet: `https://resources.hltv.org/hltv-everything.css/fdddc7f98fef6cb157c3efd609bb3360.css`, HTTP 200, 2,524,977 local bytes, `raw-capture/gate3/matches-style.css`.
- Both requests used `curl.exe` with the full Chrome-style user agent and `Accept-Language: en-US`. They were sequential, with at least two seconds between them, and no retry loop was used.

The local HTML contains the target structure:

```html
<div class="match-team">
  <div class="match-team-logo-container"><img ...></div>
  <div class="match-teamname text-ellipsis">Aurora</div>
</div>
```

The 2,524,977-byte stylesheet scan found zero occurrences for each target-parent pattern: `.match-team:nth`, `.match-team:first`, `.match-team:last`, `.match-teams:nth`, `.match-teams:first`, `.match-teams:last`, `.match-teamname:nth`, `.match-teamname:first`, `.match-teamname:last`, `.match-info:nth`, and `.match-info:last`. The actual positional selectors found in the relevant match-list CSS were:

- `.matches-v4 .matches-chronologically .match-time-wrapper:nth-child(2)`
- `.matches-v4 .matches-chronologically .match-time-wrapper:last-child`

`.match-time-wrapper` is the card-list layer, not the parent of `.match-teamname`. Appending a sibling inside `.match-team` therefore does not change `.match-time-wrapper`'s index in its parent. Position-shift risk on the target parent was not found in this scan. This is a scoped static-CSS result, not proof about other routes or future styles.

The real constraint found in the same stylesheet is dimension-related:

- Bilingual insertion is structurally feasible for `match-teamname`, `match-event`, and `match-time` on `/matches`. `.text-ellipsis` has overflow/ellipsis/nowrap but no fixed width; `.matches-v4 .match-event` is flex-based with `flex:1`; `.matches-v4 .match-teamname` has font-size rules but no width rule; and `.matches-v4 .match-time` has font-size, weight, and line-height rules but no fixed width rule. The surrounding `.match-team` row is a flex row, and `.match-teams` is a flex column.
- `match-stage` is dimension-constrained: `.matches-v4 .match-stage` has height and line-height 14px, with fixed widths of 62px, 51px, 45px, and 65px for the grand-final, semifinal, other-playoff, and quarterfinal variants. Extra sibling content can be clipped or overflow, so it is Mode A only.
- `match-meta` is dimension-constrained: the base rule fixes width at 28px and the narrow-media rule fixes it at 22px. Extra sibling content can be clipped or overflow, so it is Mode A only.

Conclusion: the /matches scan found no target-parent position dependency; the primary Mode B risk is fixed width/height clipping or overflow on `match-stage` and `match-meta`, not positional misalignment. Structurally, `match-teamname`, `match-event`, and `match-time` have no target fixed-width rule found in this scan; Gate 4 nevertheless excludes `match-teamname` from translation by owner decision. `match-event` and `match-time` remain bilingual-feasible candidates, while `match-stage` and `match-meta` are Mode A only.

Evidence boundary: these CSS conclusions cover `/matches` only. Parent-level CSS for match-detail `.match-page`/score areas and for news `newsline`/`newstext` was not checked in this pass and remains `Unable to confirm`. No `/matches` conclusion is transferred to those containers. The absence of positional selectors in the previously captured news and match-detail sources is not a substitute for that page-specific parent-CSS check.

## 7. Layout and runtime limits

No normal/narrow viewport visual measurement, browser reload comparison, or MutationObserver trace was performed in this curl-only pass. The static `/matches` CSS establishes the fixed-dimension constraints above, but the exact rendered clipping or overflow under a future Mode B implementation remains `Unable to confirm`. Runtime behavior and all page-specific layout behavior outside `/matches` remain limits rather than inferences from class names.

## 8. robots.txt and route-resolution evidence

The owner-supplied `https://www.hltv.org/robots.txt` capture was 1,646 bytes. Its key recorded rule is `Disallow: /matches?*`; other conservative query-parameter patterns cover `/stats` and `/results`, and the sitemap declaration points to `sitemap_index.xml`. This is analyzed separately from browser-extension behavior in `docs/compliance.md`.

The captured sitemap index listed `https://www.hltv.org/news-sitemap.xml`. That sitemap supplied current article URLs, while the captured home page supplied `/news/archive/2026/september` as the current news-list navigation target.

## 9. Gate 3 conclusion and next allowed action

- Gate 3A: page capture, SSR/framework comparison, sitemap resolution, and static script inspection are recorded.
- Gate 3B/P0-1: no framework or target-container positional update was found in the supplied/inspected evidence, subject to the scope limits above.
- P0-2: live scores are wired through the Socket.IO livescore module and `score` events; runtime interval remains unmeasured.
- Gate 3B/P0-3: resolved for `/matches`. The local CSS scan found no target-parent positional selector; the observed `:nth-child` rules are on `.match-time-wrapper`, while fixed dimensions constrain `match-stage` and `match-meta`.
- P0-3 remains page-scoped: match-detail `.match-page`/score CSS and news `newsline`/`newstext` parent CSS are `Unable to confirm` because they were not checked.

The `/matches` P0-3 evidence gap is closed and Gate 4 decisions are recorded in `docs/display-strategy.md`. The uninspected page-specific CSS boundaries remain explicit and no display implementation, translation API, DOM insertion, or network interception is authorized by these findings in this documentation step.
