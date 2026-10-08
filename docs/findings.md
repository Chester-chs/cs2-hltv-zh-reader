# Gate 3 Findings

Status: reconnaissance outputs recorded for the current Chrome and Edge scope. The page and script evidence is sufficient to classify the sampled page types as server-rendered HTML with native JavaScript and no observed framework-owned virtual DOM. P0-3 is resolved for `/matches` and the news/article CSS checks below. Only selected match-detail heading rules were inspected; the full `.match-page`/score-area layout remains `Unable to confirm`. Evidence-based implementation coverage is tracked in `PROGRESS.md` and `src/core/display/selectors.ts`.

Access date: 2026-09-20. Capture requests used `curl.exe` with a full Chrome-style browser user agent and `Accept-Language: en-US`, sequentially with at least two seconds between requests. No Puppeteer, Playwright, parallel request, or retry loop was used.

## 1. Capture set and provenance

The `/matches` HTML and primary stylesheet were re-fetched locally on 2026-09-20 under the explicit P0-3 authorization. The HTML request and stylesheet request were sequential and separated by at least two seconds; both returned HTTP 200. The other page captures remain the single, previously recorded curl captures.

| Page kind | Exact URL | Status / body size | Evidence reference |
|---|---|---:|---|
| Match list | `https://www.hltv.org/matches` | HTTP 200 / 1,247,718 local bytes | Local re-fetch: `raw-capture/gate3/matches.html` and `matches.headers.txt`; supplied scripts remain the script-scan source |
| Match-list stylesheet | `https://resources.hltv.org/hltv-everything.css/fdddc7f98fef6cb157c3efd609bb3360.css` | HTTP 200 / 2,524,977 local bytes | Local re-fetch: `raw-capture/gate3/matches-style.css` and `matches-style.headers.txt` |
| Home page | `https://www.hltv.org/` | HTTP 200 / 298,628 local bytes | `raw-capture/gate3/home.html` and `home.headers.txt` |
| News list | `https://www.hltv.org/news/archive/2026/september` | HTTP 200 / 354,590 local bytes | `raw-capture/gate3/news-list.html` and `news-list.headers.txt` |
| News article | `https://www.hltv.org/news/45557/50000-winline-cis-lan-season-9-announced` | HTTP 200 / 214,043 local bytes | `raw-capture/gate3/news-article.html` and `news-article.headers.txt` |
| Match detail | `https://www.hltv.org/matches/2398108/aurora-vs-vitality-starladder-starseries-fall-2026` | HTTP 200 / 586,917 local bytes | `raw-capture/gate3/match-detail.html` and `match-detail.headers.txt` |
| Terms page (shared chrome only) | `https://www.hltv.org/terms` | HTTP 200 / 188,117 local bytes | `raw-capture/gate3/terms.html` and `terms.headers.txt`; contractual text is excluded |

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

### Home page news sections

The local home-page capture contains 30 `.newsline.article .newstext` titles under `.index`; the existing `.index .newsline.article .newstext` selector and flexible `.index .newstext` rule cover those news cards. The page also contains three `h2.newsheader` section headings: “Today's news,” “Yesterday's news,” and “Previous news.”

The `newsheader` class is also used by two mobile news tabs and a “Recent Activity” link in this capture. The selector `.index h2.newsheader` selects the three home section headings and, in the separately captured news archive, the “News from September, 2026” heading. It excludes the two tab controls and recent-activity link. The shared stylesheet rule `.index .newsheader` sets color, 13px font size, font weight, margin, and padding; no fixed width, fixed height, or hidden overflow was found for those headings. The layout evidence applies only to these captured `.index` structures.

### News article

The article contains `newsitem standard-box`, `news-block`, `article-info`, `newstext-con`, and article/event/team content. It loads `hltv-news-item-js.js`. The script contains a POST path for article poll voting and ad-impression requests, but no `EventSource`, native `WebSocket`, DOM child-position expression, or article-body replacement loop was found in the inspected source.

### Match detail

The match-detail page contains a `match-page`, team/event sections, a `data-livescore-server-url="https://scorebot-lb.hltv.org"` body attribute, and `data-livescore-*` nodes. It preloads `livescore-_VRQttOJ.js`, `Main-DqFx6WGj.js`, and the shared runtime. `current-map-score` occurs in the captured page, and the score nodes are selected by data attributes rather than by child position. `hltv-match-js.js` contains live-odds fetching and repeated scheduling, but the scoreboard path is in the separate livescore module described below.

#### Static module headings inspected for limited coverage

The local match-detail snapshot contains these selected labels:

- `.match-page .betting-section .headline`: `Betting`
- `.match-page .lineups > .headline`: `Lineups`
- `.match-page .past-matches-header > .headline`: `Matches, past 3 months`
- `.match-page .matchpage-analytics-section > .headline`: `Head to head`, `VRS forecast`

The shared stylesheet sets `.match-page .headline` to 14px, bold text, with no fixed dimensions in that rule. The past-match heading sits in a grid with an `auto 100px` column definition; analytics headings use flex layout. The implementation therefore replaces these five text labels in Mode A only and does not append bilingual siblings.

The selector deliberately excludes `Maps`, `Map stats`, and `Watch(143k)`, as well as all team, player, score, map, odds, and statistical values. No rendered-browser or mutation check was performed for these headings. The full `.match-page`/score-area parent layout and runtime behavior remain `Unable to confirm`.

### Global primary navigation

The five content-page captures (home, matches, match detail, news list, and news article) contain the same primary navigation under `.navbar .navcon`, with 15 `a.nav-link` entries. The separately captured Terms page has the same shared shell. A `.navbar-smartphone` quick navigation repeats four links; it is outside the primary navigation container. The approved selector `.navbar .navcon a.nav-link` therefore targets the primary menu, including its mobile slide-out entries, while excluding the separate quick-navigation bar. The `Media` entry has an empty `href`; the extension changes only its visible label and preserves the original attribute.

Some primary navigation entries contain inline SVG chevrons. The content layer updates text nodes in place, so it preserves those SVG nodes and each anchor's navigation attributes. In the captured `/matches` stylesheet, the narrow-screen `.navbar .nav-item` rule sets a 40px height and `overflow:hidden`; bilingual sibling insertion could be clipped. The navigation strategy is consequently Mode A only. Dropdown contents and the separate smartphone quick-navigation links are not selected. The evidence is limited to the five local captures and shared stylesheet; rendered-browser verification remains `Unable to confirm`.

### Match list

The local re-fetch reports 207 `match-teamname`, 1,573 `match-event`, 452 `match-stage`, 457 `match-meta`, 442 `match-time`, 20 `current-map-score`, and 5 `match-team-livescore` elements. The supplied target-class script search reported `match-teamname=0`, `match-event=0`, `match-meta=0`, `match-stage=0`, `match-team=0`, `match-wrapper=2`, `current-map-score=3`, and `match-time=1` in script bodies. Team/event/stage/meta output is static in the inspected scripts; current time and score fields are dynamic targets. The supplied ten-script scan covered 1,236,708 bytes and found `children[0]=0`, `firstElementChild=0`, `lastElementChild=0`, `childNodes[=1`, `.children[=1`, and `nth-child=2`; the one `childNodes[0]` hit belonged to htmx fragment handling, the one `.children[` hit belonged to gtag traversal, and neither targeted match containers.

### Additional captured labels for page coverage

This subsection records static labels selected from the five local Gate 3 HTML captures. It does not extend evidence to uncaptured routes.

- **News article title:** `raw-capture/gate3/news-article.html` contains `<article class="newsitem standard-box"><h1 class="headline">…</h1>`. The shared stylesheet sets `.newsitem .headline` to 36px with `line-height:1.2em`. Chinese mode replaces this title; bilingual mode keeps the original and appends a marked translated sibling. The article text itself remains covered by the separately documented `.newsdsl .newstext-con` strategy.
- **Shared sidebar headings:** the captures contain static `h1` module labels including `RANKING`, `EVENTS`, `FPL RANKING`, `GALLERIES`, `TODAY'S MATCHES`, `RESULTS`, `RECENT ACTIVITY`, and `TOP 30 TRANSFERS`. The centralized selector only targets the documented sidebar `h1` positions. It excludes `#playerOfTheWeekTitle`, whose heading is a dynamic statistic, and `.minigame-label-new`, whose “New” badge is rendered by a CSS pseudo-element. The shared `.leftCol h1`, `.rightCol h1`, and `.right2Col h1` rules use 10px text and do not set a fixed heading height. Static labels are Mode A replacements.
- **Match-list headings and filters:** `raw-capture/gate3/matches.html` contains the live/upcoming `.upcoming-headline` labels, the `Match filters` panel heading, and static `Starred matches only`, `Ranked`, and `Unranked` labels. These compact controls use Mode A replacement. Region labels with live counts and tournament names are not selected.
- **Match-detail map-stat tabs:** the capture contains `Win %`, `Pick %`, and `Ban %` buttons under `.match-page .map-stats-infobox .map-stats-infobox-tabs`. The tab strip is 34px high. Only the button labels are selected for Mode A; the map-stat section heading, map names, scores, and statistic values are outside the selector.

### Shared footer

The five content-page captures contain the same footer structure, which is also present in the Terms capture. The footer promotional blocks contain `HLTV merchandise`, `HLTV Community t-shirt and sweatshirt available now`, `Buy HLTV merch`, `Download the HLTV app`, and `Optimized to keep you up to date on the go`. The `.footerlinks` row contains text links such as `Jobs`, `Contact`, `About`, `Terms`, `Privacy policy`, `Cookie policy`, `Disclosures`, `RSS`, `Skins`, and `Cologne Major`. The responsible-gaming row contains the visible text `18+ Bet Responsibly |` next to two logo links.

The selectors are scoped to `.footer .footer-content` blocks, `.footer .footerlinks a.footerlink`, and `.footer .footer-responsible-container .footer-generic-responible-container`. This latter class spelling matches the captured markup. The responsible-gaming strategy changes text nodes only; linked logos and their destinations remain intact. All footer targets use Mode A replacement.

The shared stylesheet gives section headings 14px bold text and subtext 12px text; neither rule sets fixed dimensions. The CTA has a fixed 32px height inside a 40px CTA row, so it uses in-place replacement only. The footer link row has a 73px height and wraps below 500px; no sibling is added. The responsible-gaming container is a flex row, and no fixed width or height is set on the text container. Exact rendered fit at narrow viewport sizes remains `Unable to confirm` because no live browser rendering was performed.

### Terms page boundary

The local capture `raw-capture/gate3/terms.html` is `https://www.hltv.org/terms` (HTTP 200, 188,117 bytes, captured 2026-09-20; headers are in `terms.headers.txt`). It contains the same primary navigation, sidebar heading positions, and shared footer structure as the other captured page templates. The new global navigation/sidebar/footer selectors can therefore cover this shared shell.

The Terms of Service heading and legal paragraphs remain in English and are not translation targets. The captured page's section 10.2 states that the English text controls if a translation conflicts; this is also recorded in `docs/compliance.md`. The extension therefore does not replace or append machine translations to contractual text. This is an intentional page-content exclusion, not evidence that the full terms page is translated.

### Route checks blocked by Cloudflare; rendered-page follow-up

On 2026-09-26, three sequential route requests were made with `curl.exe`, `Accept-Language: en-US`, and responses saved under ignored `raw-capture/gate4/`. The requests were not concurrent and there was at least two seconds between them:

| URL | Result | Local evidence |
|---|---|---|
| `https://www.hltv.org/events` | HTTP 403, 3,125-byte body | `raw-capture/gate4/events/events.headers.txt` and `events.html` |
| `https://www.hltv.org/results` | HTTP 403, 3,131-byte body | `raw-capture/gate4/routes/results.headers.txt` and `results.html` |
| `https://www.hltv.org/ranking/teams` | HTTP 403, 3,139-byte body | `raw-capture/gate4/routes/team-ranking.headers.txt` and `team-ranking.html` |

Each response included `Cf-Mitigated: challenge` and `Server: cloudflare`. The challenge bodies are not page evidence and were not analyzed for selectors. Later on 2026-09-26, the three routes were opened in the user's normal Chrome browser and rendered successfully. The visible accessibility tree confirmed the following page content:

- `/events`: `Ongoing events` and `Upcoming events`, plus static filters for event type, prize pool, attending teams/player, and Valve ranking. Tournament names, dates, and team names are page data.
- `/results`: page heading `Results`, a paginated results list, date groups, and filter labels for stars, time, match type, map, event, player, team, game, and Valve ranking. Team names and match scores are dynamic results data.
- `/ranking/teams`: the route normalized to `/ranking/teams/2026/september/21`. The page showed a `Regional rankings` control, global Valve-ranking links, a dated ranking heading, team entries, and ranking-calculation explanations. Team names, player nicknames, point totals, positions, and movement values are ranking data.

The rendered accessibility tree is not a saved HTML capture. A `view-source:` browser navigation was attempted but rejected by the browser URL policy; no workaround was used. Therefore the exact DOM class binding for the two event-section headings remains **Unable to confirm**. The event CSS class names in `raw-capture/gate3/matches-style.css` provide a narrow implementation candidate, but the selector effect has not been verified in a rendered extension session. The ranking control's accessible container name included `ranking-open-region-selector`, which is the class used by its new selector. A later route follow-up added a route-limited H1 candidate for `/results` and `/players/archive`, plus `/results`-only filter-class candidates; see below. Their live extension rendering and the exact filter-class binding remain unverified. No page-wide translation claim is made for these routes.

### Additional browser-visible route follow-up (2026-09-26)

Normal Chrome opened `/players`; HLTV normalized it to `/players/archive/active`. The accessibility tree showed the `Counter-Strike Players` level-1 heading and a player directory. The extension now targets the heading only on `/players/archive` routes, excluding the known player-of-the-week and minigame labels. Individual player profiles are outside that route prefix, so player names remain protected. The filter-class selectors are not enabled on this route because their presence there could not be confirmed.

The `/results` accessibility tree showed the `Results` level-1 heading and static filters for stars, time, match type, map, event, player, team, game, and Valve ranking. The local shared stylesheet contains `.header-filters-title` and `.filter-headline`, so those two classes are used as `/results`-only candidate selectors. The rendered page did not expose class-to-label bindings. That association is **Unable to confirm**, and the candidate selector has not been exercised in an installed extension.

Opening `/stats` in normal Chrome displayed Cloudflare's security-verification page. Its content and selectors are **Unable to confirm**; no challenge was solved, and no alternate source-inspection method was used. The earlier `view-source:` navigation restriction remains in force.

Normal Chrome also opened the Fantasy, Live, Major, and Forum top-level pages:

- `/fantasy` exposed the season and Partner Games as level-1 headings and PRIZES, ABOUT FALL SEASON 2026, and POINTS SYSTEM as level-2 headings. Its leaderboard contains user names and game/point values. Exact HTML tags were not available from the accessibility view. The implementation adds `h1`/`h2` candidates only on the exact `/fantasy` overview path; game-detail paths, player names, and points remain outside the selectors.
- `/live` exposed a Fullscreen button and a Theater link to `/live?fullscreen=1`. Its main panel contains tournament labels, team names, and live score fields, which remain outside the two exact-path controls. The control candidates use their accessible roles and the Theater destination; the exact DOM tag binding and installed-extension result are **Unable to confirm**.
- `/major` displayed a coverage hub with stage controls, a current Major name, match sections, historical winners, and prose. The page mixes event names, team identities, scores, and article text, while the accessibility view does not expose stable element selectors. It remains without page-specific selectors.
- `/forums` displayed the House Rules document, forum-category links, and user-generated sidebar content. No page-specific body selectors were added; existing shared chrome and comment rules remain bounded to their documented structures.

These observations are normal-browser accessibility evidence, not saved HTML. No source-markup workaround was attempted. They do not confirm rendered behavior with the extension installed.

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

## 3B. Targeted news and article CSS reconnaissance

Evidence basis for this subsection: owner-supplied curl captures from 2026-09-20, with at least two seconds between requests:

- News archive: `https://www.hltv.org/news/archive/2026/september`, HTTP 200, 355,372 bytes, title `HLTV.org - News Archive September, 2026 | HLTV.org`.
- News article: `https://www.hltv.org/news/45553/aurora-punish-limp-vitality-offense-to-reach-first-final-with-new-roster`, HTTP 200, 320,875 bytes.
- Primary stylesheet: `https://resources.hltv.org/hltv-everything.css/fdddc7f98fef6cb157c3efd609bb3360.css`, 2,524,977 bytes.

1. Both HTML responses are SSR and contain no framework or htmx activation markers: `data-reactroot`, `__NEXT_DATA__`, `data-v-`, `hx-get`, `hx-swap`, and `x-data` each occurred zero times.
2. The archive list uses this structure:

```html
<h2>September 2026</h2>
<div class="standard-box standard-list">
  <a href="/news/45557/50000-winline-cis-lan-season-9-announced"
     class="newsline article">
    <img class="newsflag flag" title="Russia">
    <div class="newstext">$50,000 WINLINE CIS LAN Season 9 announced </div>
    <div class="newstc">
      <div class="newsrecent">2026-09-20</div>
      <div>35 comments</div>
    </div>
  </a>
</div>
```

The title container is `.newstext`. Date and comment-count metadata are inside `.newstc`.
3. The archive title is Mode B-feasible in the inspected scope:

```css
.index .newstext{color:var(--a-color);flex:1 1 auto;font-size:14px;
                 font-weight:700;line-height:20px;text-decoration:none}
.index .newstext{font-size:13px;line-height:18px}
```

`flex:1 1 auto` makes `.newstext` a flexible item with no fixed width and no `overflow:hidden` in the supplied rule set.
3b. The selector is scope-dependent. The archive HTML contains an enclosing `<div class="index">`, so the `.index .newstext` rule applies to this sample. This evidence must not be reused for a `.newstext` outside an `.index` ancestor without a separate check.
4. `.newstc` is not an insertion target:

```css
.index .newstc{color:var(--news-time-color);font-size:11px;font-weight:400;
               line-height:11px;margin:-1px 0;min-width:80px;text-align:right}
```

The `min-width:80px` and right alignment are hard compact-layout constraints. Keep this metadata unchanged and do not append translation nodes.
5. The article body uses:

```html
<div class="newsdsl">
  <div class="newstext-con">
    <p class="headertext" itemprop="description">...</p>
    <p class="news-block"><a href="/team/11861/aurora">Aurora</a> are through to ...</p>
    <p class="news-block">It is the first final for
      <a href="/player/19677/kyxsan">...</a>
    </p>
  </div>
</div>
```

The prose targets are `p.news-block` inside `.newsdsl > .newstext-con`. Embedded team/player links carry identifiers and remain protected.
The local article capture also shows tooltip-linked entity anchors with `data-tooltip-id` in the prose container. The implemented nested selector preserves the full linked entity text while allowing surrounding prose to be considered separately; this is limited to those marked entity elements.
6. Article prose is Mode B-feasible in this inspected scope:

```css
.newsdsl .newstext-con{font-size:16px;line-height:28px;position:relative}
.newsdsl .newstext-con{font-size:15px;line-height:24.75px}
.newsdsl .newstext-con ul li .news-block{margin:4px 0}
```

`.news-block` itself has margin rules only; no fixed width, fixed height, or `overflow:hidden` was found.
7. Position-selector risk was not found at these news targets. For `.news-block`, `.newsline`, `.newstext`, and `.article`, `:nth-child`, `:first-child`, and `:last-child` queries were all zero.
8. Article dates are dynamic fields:

```html
<div class="date" data-time-format="d-M-yyyy HH:mm"
     data-unix="1789842660000">19-9-2026 20:31</div>
```

The date is covered by the same dynamic rewrite logic recorded for comment times.
9. The no-translation rule for an element carrying both `data-time-format` and `data-unix` is therefore global across the inspected evidence: match-list `.match-time`, comment `span.time`, article `div.date`, and match-detail time fields. Such nodes must not be translated or receive an appended translation sibling.

Resolution: the previous `Unable to confirm` status for the news `newsline`/`newstext` parent CSS is resolved for the inspected archive `.index` structure and article `.newsdsl .newstext-con`/`.news-block` structure. The match-detail `.match-page`/score-area parent CSS remains `Unable to confirm` and is not covered by these news conclusions.

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

Evidence boundary: the match-list CSS conclusion covers `/matches` only; the news/article CSS conclusion covers the inspected `.index` archive and `.newsdsl .newstext-con` article structure. Parent-level CSS for the match-detail `.match-page`/score area was not checked and remains `Unable to confirm`. No `/matches`, news, or article conclusion is transferred to that container.

## 7. Layout and runtime limits

No normal/narrow viewport visual measurement, browser reload comparison, or MutationObserver trace was performed in this curl-only pass. The static `/matches` and news/article CSS establishes the documented fixed-dimension and flexible-container constraints, but exact rendered clipping, overflow, or scroll-position changes under a future Mode B implementation remain `Unable to confirm`. Runtime behavior and the uninspected match-detail score-area layout remain limits rather than inferences from class names.

## 8. robots.txt and route-resolution evidence

The owner-supplied `https://www.hltv.org/robots.txt` capture was 1,646 bytes. Its key recorded rule is `Disallow: /matches?*`; other conservative query-parameter patterns cover `/stats` and `/results`, and the sitemap declaration points to `sitemap_index.xml`. This is analyzed separately from browser-extension behavior in `docs/compliance.md`.

The captured sitemap index listed `https://www.hltv.org/news-sitemap.xml`. That sitemap supplied current article URLs, while the captured home page supplied `/news/archive/2026/september` as the current news-list navigation target.

## 9. Gate 3 conclusion and next allowed action

- Gate 3A: page capture, SSR/framework comparison, sitemap resolution, and static script inspection are recorded.
- Gate 3B/P0-1: no framework or target-container positional update was found in the supplied/inspected evidence, subject to the scope limits above.
- P0-2: live scores are wired through the Socket.IO livescore module and `score` events; runtime interval remains unmeasured.
- Gate 3B/P0-3: resolved for `/matches`. The local CSS scan found no target-parent positional selector; the observed `:nth-child` rules are on `.match-time-wrapper`, while fixed dimensions constrain `match-stage` and `match-meta`.
- P0-3 remains page-scoped: match-detail `.match-page`/score CSS is `Unable to confirm` because it was not checked; news/article parent CSS is resolved only for the documented `.index` and `.newsdsl .newstext-con` structures.

The `/matches` P0-3 evidence gap is closed and Gate 4 decisions are recorded in `docs/display-strategy.md`. The uninspected page-specific CSS boundaries remain explicit and no display implementation, translation API, DOM insertion, or network interception is authorized by these findings in this documentation step.

## 10. Normal-browser profile-page audit (2026-09-26)

Two pages were inspected through their normal rendered Chrome accessibility views, without source or DOM inspection:

- Player overview: `https://www.hltv.org/player/8528/hobbit`. Visible static interface text includes `Player`, the profile tabs (`Info`, `Teams`, `Matches`, `Achievements`, `Trophies`, `News`, `FACEIT`), `Upcoming & recent matches`, and `Complete statistics for HObbit`. Other headings and fields include player-specific text such as `HObbit statistics (Past 3 months • 15 maps)`, `HObbit's inventory`, and `Stickers: PGL CS2 Major Copenhagen 2024`.
- Team overview: `https://www.hltv.org/team/12467/parivision`. Visible interface text includes the tabs (`Info`, `Roster`, `Matches`, `Events`, `Achievements`, `News`, `Stats`), `Valve ranking`, `World ranking`, `Weeks in top30 for core`, `Average player age`, `Coach`, and `World ranking development for core`. FAQ questions embed the current team name. Ranking positions, time-at-peak, player/team names, ages, prices, and roster entries are dynamic or identity data.

The accessibility views establish visible wording and data boundaries only. They do not establish selector-to-label bindings. Profile markup was not captured locally; `view-source:` had already been rejected by browser policy, and no alternate automated source/DOM inspection was used. Therefore the profile-page CSS bindings and safe page-specific selector boundaries are **Unable to confirm**. No guessed profile selectors were added. Shared navigation, sidebar, and footer coverage still applies through the existing shared selectors, but the player and team profile bodies remain uncovered.

## 11. Article screenshot static chrome follow-up (2026-09-30)

The user-provided news-article screenshot showed the primary navigation, article content, a player-of-the-week card, left-column ranking/event links, a minigame widget, and a sign-in label. No new request to hltv.org was made for this pass. The existing local `raw-capture/gate3/news-article.html` contains matching static source and class bindings:

- `.navsignin` contains the `Sign in` label.
- `.playerOfTheWeekCategory` and `.playerOfTheWeekTitle` contain the card category and metric label. The player name and percentage are separate elements and remain excluded; `KAST` is retained as a metric abbreviation.
- `.right2Col > aside > h1.minigame-label-new` contains `MINIGAME`; the `NEW` marker is CSS-generated. `.sidebar-minigames-playnow-btn` contains `Play`, and the game name `Timeline` remains unchanged.
- The `/ranking/teams` link contains `Complete ranking` plus two `.normal-weight` update metadata spans. The exact link selector only translates its own label, while nested metadata is protected. The `/events` link contains the static `Event calendar` label.

These structures now have centralized selectors, Mode A in-place strategies, and glossary entries. This evidence applies to the captured shared article template only. The top-bar `Search...` placeholder is an input attribute rather than a text node and remains outside the current renderer; no attribute value is read or rewritten. Arbitrary article titles and prose still depend on a working configured translation provider.

## 12. Statistics screenshot and complete-Chinese follow-up (2026-09-30)

The user's NiKo statistics screenshot confirms partial extension activity: the right sidebar headings and Play button are Chinese while the main statistics interface is English. The user also confirms their configured translation service passes its connection test. Therefore the missing statistics strategy and omitted text/attribute targets are the current coverage causes; an absent API key is not established as the cause.

- Screenshot wording supplies 58 label/value samples: filters, navigation, profile action, ratings/quality labels, metric abbreviations, age/map/round units, side/round controls, and performance categories. These are translated through the scoped `ui-stats` glossary, including a numeric age suffix while preserving a preceding identity. No statistics class names are inferred.
- One sequential `curl.exe` request to `/stats/players/3741/niko` returned HTTP 403 (5,429 bytes), stored at ignored `raw-capture/stats-player.html`. This is challenge evidence, not statistics DOM source. Exact statistics selector-to-DOM binding and rendered behavior are **Unable to confirm**.
- A standard `body` candidate is admitted by glossary coverage. Shared labels use `ui`; `/stats` additionally uses `ui-stats`; `/player` and `/team` additionally use the `ui-profile` words observed in §10. This changes how eligible text is selected without asserting unobserved class bindings. Unmatched elements still default to `never`, and an unknown short body string receives no translation record.
- Known public routes additionally admit prose with at least four Latin-script words and the existing prose classifier. It uses the already configured provider. This generic text fallback is not evidence of exhaustive page coverage and is excluded from terms/account routes by its positive route list. It skips scripts, style, templates, editable content, forums/activity containers, and live writers; nested specific candidates retain ownership. SVG text remains eligible. A tooltip attribute alone does not identify a player entity outside the captured article scope.
- The existing article capture binds activity titles to `.right2Col .activitylist > a.activity > span.topic`; adjacent comment counts are text siblings of that span. Titles use the provider as prose. The captured `.forum .post .forum-middle` template now supports replacement in Chinese mode as requested, while bilingual mode and conservative comment-language classification remain available.
- The article source binds `Search...`, `Username`, `Password`, `Username or email`, and `Search team...` to input placeholders. Only known placeholder wording is rewritten; entered input values are never read or changed. Original hints are stored in the display record table.
- The captured stylesheet explicitly supplies `.minigame-label-new:after{...content:"New"...}`. A removable local CSS overlay supplies the glossary translation. Switching off or to bilingual mode removes it and restores recorded input hints. No additional permission is required.

The new build needs a Chrome extension reload and HLTV refresh. Browser Use previously rejected `chrome://extensions` under its HTTP(S)-only security policy; no alternative internal-URL, profile, CDP, or extension-management bypass is authorized or attempted. Installed-browser reload and rendering remain **Unable to confirm**.

## 13. Lower statistics table and normal Chrome audit (2026-09-30)

The newest user screenshot shows the statistics table's 16 English labels beside unchanged numerical values, while `Rating 3.0` is already Chinese. All 16 missing labels were absent from the glossary. The short-label fallback explains why most were skipped; the longer `Saved by teammate / round` could reach the provider, so its original screenshot failure is not attributed to word count alone.

The existing Chrome tab at `https://www.hltv.org/stats/players/21167/donk?csVersion=CS2` was read through its normal accessibility view. It confirms partial Chinese navigation, filters, ratings, prose explanations and activity titles. It additionally establishes English wording in the statistics table, filter menus/sidebar options, average hints, opponent summaries, teammate/form sections, transfer/streaming widgets and privacy action. No extra navigation, network scraping, source inspection or class-name inference was used.

Observed statistics help explains saves as killing a damaging opponent within one second of the last attack, and impact as multikills, opening kills and clutches. The exact observed descriptions are glossary entries; no formula or additional statistical claim was invented. Generic standard `title` and `aria-label` attribute targets admit only glossary-covered text on `/stats`, retain originals in the memory table and restore them in disabled/bilingual modes. The accessibility view establishes wording; the exact attribute producing each help description remains **Unable to confirm**.

The visible `全部 Sides`, `CT 阵营` and `T 阵营` illustrate partially translated compound controls. Glossary fragment and complete-phrase tests cover separate inline nodes without container replacement. These tests do not establish every actual DOM split. Values, dates, names and unknown fragments remain protected.

Map/player/team/brand identities, some image lettering and unobserved UI wording remain coverage boundaries. The 0.0.4 source/build verification and packaging results are recorded in `PROGRESS.md`; installed rendering after reloading that new build remains **Unable to confirm**. Browser extension management is still blocked by Browser Use policy and was not accessed through a workaround.

## 14. Reloaded 0.0.4 live audit and follow-up (2026-09-30)

The owner confirms reloading the extension and refreshing donk's page. A normal screenshot and rendered DOM accessibility snapshot confirm all 16 lower-table labels, filter options, ratings, opponent summaries, teammate/form headings and shared streaming labels are Chinese with the original numerical values. This is actual installed-page evidence for this page, not an all-route conclusion.

The same audit still shows English date/context input hints, transfer statuses and hover descriptions. A focused read-only inspection of the UI-grounded damage row confirms its parent `.stats-row` owns the standard `title` description; its ancestor BODY owns `data-livescore-server-url`. The new ancestor guard was treating this page-wide server configuration as a live writer and blocking all attributes. Centralized data now exempts that exact attribute on BODY only; non-BODY cases, actual live writer fields and editable BODY remain protected. See ignored `raw-capture/stats-live-bindings-2026-09-30.json` for the bounded binding record. This inspection reads the already open tab and makes no automated page fetch.

The graph visible in the screenshot draws English month abbreviations on Canvas. A focused read of the observed graph confirms its parent `.graph` exposes `data-chartjs-config` with labels and numeric dataset points, plus `data-chartjs-init`. This configuration is page data, never executable instructions or a replacement for the memory original-text table. No chart renderer was implemented. The owner has been asked to confirm a Chinese SVG alternative using the same data, restoring the native chart on disable; that new display contract remains pending.

Version 0.0.5 fixes the metadata guard and the observed date/context hints, transfer states and statistics-search explanation. Official names and map labels remain original; Canvas drawing remains outside text-node translation. Whole-site Chinese rendering is not claimed.

## 15. Navigation dropdown audit (2026-09-30)

The owner's player-directory screenshot shows translated primary navigation but English dropdown options. All six local Gate 3 HTML captures have seven dropdown groups with `.navbar .navcon .dropdown-menu > li > a.dropdown-link > .text-ellipsis`. Primary links use `nav-link`, so their strategy does not select dropdown siblings. Missing glossary coverage and the four-word body prose threshold explain the short-label omissions.

A focused read-only inspection of the existing normal Chrome player-directory tab confirms the current hierarchy, 36 fixed links and one dynamic Fantasy event link. It also confirms new items `Player explorer` (`/players/explore`) and `Betting Canada`, separate `.new-box` spans, and the `All` anchor `.players-archive-tab` directly within `.players-archive-navigation`, under `.players-archive`. Bounded bindings are stored in ignored `raw-capture/navigation-live-bindings-2026-09-30.json`. No automated HLTV fetch was performed.

The centralized fixed-menu selector excludes `/fantasy/` and `/events/` detail links, with an explicit `/events/archive` exception, preserving the existing body/event-name admission for changing tournament titles. Static wording uses `ui` plus scoped `ui-navigation` glossary entries; archive alphabet controls use the same category only on `/players/archive`. Scoped terms never participate in provider glossary enforcement. Text-node replacement preserves links and badge elements and is Mode A only because captured CSS has fixed-height, narrow dropdowns. Unknown options receive no intent.

The six saved scripts contain no dropdown-selector or literal-label dependency. Uncaptured imported modules and actual post-update interaction/layout remain **Unable to confirm**. A later browser connection attempt lost its Chrome binding, then returned `Debugger unattached` after inventory and re-binding. No extension-management workaround was attempted. Version 0.0.6 needs a manual extension reload and page refresh before installed rendering can be checked.
