# CS2 HLTV Chinese Reader — Project Plan

Status: reconnaissance and planning only. No translation logic, DOM rewriting, glossary, or browser-extension implementation is included in this step.

## 1. Purpose and decision boundary

The first implementation milestone is split into two gates:

1. Establish a browser-compatible, log-only Manifest V3 scaffold and verify it independently in Chrome, Edge, and Firefox.
2. Use that verified scaffold plus human-controlled inspection to produce evidence about HLTV's rendering model, DOM mutation safety, layout risk, and compliance constraints.

The extension architecture will not be finalized until the P0 questions in the reconnaissance report are answered with evidence. In particular, the report must establish:

- whether adding a sibling after a text node can interfere with any position-index-sensitive page update;
- whether a framework re-render can overwrite an extension change and, if so, whether the original text can be reconstructed solely from extension memory;
- how to distinguish text that is already Chinese or otherwise does not need translation from text that is eligible for translation.

This plan does not authorize choosing a network-interception architecture or implementing either display mode. The later architecture decision remains with the project owner.

## 2. Reconnaissance method

### 2.1 Select and record three real pages

After the scaffold is verified, I will use this exact three-URL capture set:

1. Match list: https://www.hltv.org/matches
2. Match detail: the exact absolute match link manually selected from the loaded match-list page, in the form https://www.hltv.org/matches/<match-id>/<slug>.
3. News/article: the exact absolute article link manually selected from the loaded https://www.hltv.org/news page, in the form https://www.hltv.org/news/<article-id>/<slug>.

The detail and article IDs/slugs will not be invented or hard-coded in advance. They will be copied from real links visible in the manually loaded pages, checked by opening them, and then written verbatim in docs/findings.md. This keeps the capture set concrete while avoiding a stale URL being presented as evidence. If a page is blocked, redirects, or no longer exists, that fact and the exact URL will be recorded rather than substituted with an unverified page.

### 2.2 Capture server responses with curl

For each of the three URLs above, I will use one manually started curl.exe request, sequentially and with at least one second between requests. Every request will set the same language header:

    Accept-Language: en-US

The command shape will be:

~~~text
curl.exe -L --compressed -H "Accept-Language: en-US" --dump-header <headers-file> --output <html-file> <exact-url>
~~~

The response files will be saved in these page-specific local paths:

~~~text
raw-capture/match-list/response.headers.txt
raw-capture/match-list/response.html
raw-capture/match-detail/response.headers.txt
raw-capture/match-detail/response.html
raw-capture/news-article/response.headers.txt
raw-capture/news-article/response.html
~~~

The captures will be checked for:

- response status, redirects, content type, and CSP;
- server-rendered text and recognizable page selectors in the initial HTML;
- JSON state blobs, hydration markers, script URLs, and data attributes;
- links or scripts that identify update endpoints.

#### Interception/challenge detection

Before treating a curl response as evidence, I will check the headers and body for all of these interception indicators:

- a cf-mitigated or equivalent challenge-related response header;
- HTTP 403;
- an unusually short response body. For this capture set, a body at or below 16 KiB is an initial alert threshold and must be manually inspected; the threshold is a flag, not a conclusion;
- a title or body resembling Just a moment..., Attention Required, Checking your browser, or another challenge/interstitial page;
- the absence of the expected page content together with any of the indicators above.

If any challenge indicator is present, the report will state exactly: curl 被拦截. The challenge page will not be used as SSR, DOM, or CSP evidence, and I will not add an automated retry loop or parallel requests.

The replacement evidence path is a manual DevTools export by the project owner:

1. Open the exact URL in a normal browser tab.
2. In DevTools → Network, select the document request.
3. Use Save response or Copy response and save the HTML snapshot as raw-capture/<page-kind>/devtools-response.html. If the browser only exposes the rendered document, use the browser's manual page-source/HTML-save action and record that it is a snapshot rather than the raw HTTP response.
4. Preserve the request URL, status, response headers visible in DevTools, and the browser/version used.

The report will label this as a DevTools HTML snapshot, not a curl response. Raw HTML and raw headers remain local-only and will not be committed.

### 2.3 Observe requests in browser DevTools

In a normal, manually controlled browser tab, on each of the same three exact URLs, I will:

1. open DevTools → Network, preserve the log, and reload the page;
2. filter by Fetch/XHR, inspect request URL, method, initiator, response content type, and response preview;
3. interact with a match/news page only as needed to trigger navigation, score updates, tabs, or pagination;
4. record timestamps for repeated score/live-data requests to calculate observed intervals;
5. compare a navigation that changes the URL with the document/request lifecycle to detect SPA-style routing.

If a batch DOM inventory is needed, I will give the project owner a read-only snippet to paste into DevTools Console on each of the same three exact URLs. The snippet will print location.href, document title, element/tag/class summaries, table/grid candidates, framework-marker presence, and selected text-node/container information. It will not mutate the page, insert nodes, write attributes, or send data elsewhere. Only summarized evidence and short excerpts will enter docs/findings.md.

The planned diagnostic snippet shape is:

~~~js
(() => {
  const candidates = [...document.querySelectorAll(
    'table, [role="table"], [role="grid"], [class*="table"], [class*="grid"]'
  )].map((el, index) => ({
    index,
    tag: el.tagName,
    id: el.id,
    className: el.className,
    childCount: el.children.length,
    textSample: (el.textContent || '').trim().slice(0, 160)
  }));
  return {
    href: location.href,
    title: document.title,
    htmlLength: document.documentElement.outerHTML.length,
    frameworkMarkers: {
      reactHook: Boolean(window.__REACT_DEVTOOLS_GLOBAL_HOOK__),
      reactRoot: Boolean(document.querySelector('[data-reactroot]')),
      vue: Boolean(window.__VUE__ || document.querySelector('[data-v-]')),
      svelte: Boolean(document.querySelector('[class*="svelte-"]'))
    },
    candidates
  };
})()
~~~

This is an inspection aid only. It is not extension code and will not be run automatically by the project.

### 2.4 Inspect framework and DOM-update evidence — Gate 3B / blocking question 6

For each page, I will inspect the DOM and loaded scripts for concrete evidence such as:

- __REACT_DEVTOOLS_GLOBAL_HOOK__, React root markers, Vue/Svelte markers, hydration attributes, or framework bundles;
- inline scripts and source maps that contain children[0], firstElementChild, nth-child, childNodes[i], keyed-list code, or equivalent positional assumptions;
- the initiator and response of live-data requests;
- MutationObserver-visible changes while navigating, switching tabs, or waiting for live updates.

For each positional access found, docs/findings.md will record the exact source URL or DevTools source location, the selector/container, the position expression, and the content being updated. If no such access is found in the inspected evidence, the report will say where the search was performed and what it cannot prove. If the evidence is insufficient, it will explicitly say Unable to confirm.

This is Gate 3B because position-index safety and framework ownership are runtime/page facts that require the real loaded DOM, its loaded scripts, and live update behavior. They cannot be established from the empty scaffold or from a guessed selector. It is a P0 sub-gate: if this evidence is inconclusive, the architecture decision stops here.

### 2.5 Assess layout and element suitability — Gate 3C / blocking question 7

I will inventory compact tables/grids and classify candidate text by semantic role. For each candidate I will record:

- selector, or an explicit note that the selector is not stable;
- whether the value is an identifier/URL/attribute or user-facing prose;
- whether it appears in a position-sensitive container;
- whether bilingual insertion plausibly adds 40–60% text width;
- observed wrapping, overflow, column shift, or row-height changes at normal and narrow viewport widths.

This is Gate 3C, immediately after the P0 mutation/framework check in Gate 3B, because layout risk depends on the real containers and the approved safe insertion behavior. It must not be inferred from a semantic class name or a generic CSS convention. The observer marker rule (data-hltv-zh="1" and translate="no") will also be checked against the page scan and browser translation behavior, then documented as a constraint rather than silently assumed.

### 2.6 Assumptions before real evidence

I will make no assumption about HLTV's page structure before Gate 3. In particular, these are unknown and will not be used as conclusions:

- SSR versus client-side JSON rendering;
- React, Vue, Svelte, or another framework;
- SPA routing;
- polling, streaming, or AJAX update intervals;
- positional child access or keyed-list assumptions;
- CSP contents or whether a page script is needed/permitted;
- selector stability or bilingual insertion safety;
- whether any given text node is Chinese, English, mixed, or protected.

The only pre-evidence assumptions are operational and are explicitly provisional:

- https://www.hltv.org/matches and https://www.hltv.org/news can be opened manually at Gate 3, and each yields a real detail/article link. This is an access assumption, not a page-structure assumption; it will be verified before any capture.
- curl.exe and browser DevTools are available on the inspection machine. If either fails, the failure and attempted command/inspection will be recorded as Unable to confirm; I will not replace it with automated crawling.
- raw-capture/ is a local evidence workspace. Its ignore rule and directory are created and verified in Gate 0.5, before the first Git commit; no ignore-rule creation is deferred to Gate 3.

### 2.7 Check compliance sources

I will retrieve the current https://www.hltv.org/robots.txt and the current Terms/usage page reached from an official HLTV link, preserving the exact URLs and access date. docs/compliance.md will quote only the relevant short passages, identify whether automated fetching or redistribution is restricted, and flag uncertainty or access limitations rather than inventing a conclusion.

### 2.8 Firefox log-location verification status

The requested real Firefox check was attempted before this plan revision:

- the available browser-control inventory exposed Edge only and did not expose Firefox;
- a read-only local installation check found no Firefox executable at C:\Program Files\Mozilla Firefox\firefox.exe, C:\Program Files (x86)\Mozilla Firefox\firefox.exe, or the user's local Mozilla Firefox path, and firefox.exe was not on PATH.

Therefore the actual Firefox UI location could not be tested in this environment. The result is Unable to confirm, not a claim that Firefox has no place to view the log. Gate 2 remains blocked until the owner or a later available Firefox environment performs the test.

The current Mozilla documentation gives two concrete places to test in that later run:

- Add-on Toolbox: about:debugging → This Firefox → the temporary extension → Inspect → Console. Mozilla documents this as the place for extension background-script logs: https://extensionworkshop.com/documentation/develop/debugging/
- Browser Console fallback: Ctrl+Shift+J, filtering for the extension ID or the known log prefix. Mozilla documents Browser Console for background logging and also documents web-ext run --bc: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Modify_a_web_page

Mozilla's manifest documentation also states that Firefox uses background.scripts as an event page and does not support background.service_worker, while the dual scripts/service_worker fallback is intended for cross-browser Manifest V3: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background

The Firefox Gate 2 test will therefore try Add-on Toolbox first, then Browser Console. Content-script output will be checked in the target tab's own DevTools Console. If neither Firefox console path displays the background log in the actual browser/version under test, Gate 2 fails and work stops; it is not recorded as a non-blocking known limitation.

## 3. Planned modules and dependency direction

The names below are planned boundaries, not files to be implemented in the current step. The minimal scaffold will initially contain only the two log-only entry points and the single manifest/build configuration.

~~~text
                    manifest.json
                  /       |        \
                 /        |         \
        background.js  content.js  (future UI entry points)
             |             |
      browser adapter   content orchestrator
             |        /       |        \
             |  page observer  display  translation
             |        |          |          |
             |      DOM read   record      client/cache
             |                   store        |
             |                     |       glossary.json
             |                   renderer
             |                     |
             |                 one CSS file
             |
       extension messages / settings / lifecycle
~~~

Planned dependency rules:

- content orchestrates page observation, record ownership, translation requests, and rendering; it does not own provider details;
- display owns the node → { original, translation } record table and the single render(node, mode) contract;
- display treats the DOM as a rebuildable view and never recovers the authoritative original from DOM attributes;
- translation accepts and returns string[], shares cache/results across both display modes, reads glossary.json as the only terminology authority, and has timeout plus original-text fallback;
- translation never performs DOM operations or branches on display mode;
- page observer discovers eligible text nodes and framework-driven changes while skipping extension-created nodes; it does not translate or decide display mode;
- background is limited to extension lifecycle, browser messaging, and the transport boundary approved after reconnaissance;
- no provider/API key is hard-coded; user configuration is external to source and only .env.example may contain placeholders;
- browser-facing code uses browser.* through webextension-polyfill; direct chrome.* calls are prohibited;
- shared types and pure utilities may be imported downward by feature modules, but DOM code, browser APIs, and provider/network code must not be imported by the pure translation contract;
- any final network route must have an explicitly documented Firefox equivalent. If it requires a second browser-specific code path, that cost will be shown before implementation.

The scaffold and later source must also preserve these repository-level constraints:

- one root manifest.json only;
- background.scripts and background.service_worker both point to the same background.js output;
- no background.type: module;
- Vite builds background.js as one IIFE-compatible file;
- browser_specific_settings.gecko.id is present;
- declarativeNetRequest is not used.

### 3.1 How both display modes share one translation layer

The future implementation will have one mode-independent translation pipeline:

~~~text
eligible text nodes
        |
        v
display record table: Map<Node, { original, translation }>
        |                         ^
        | original string[]        | translation string[] in input order
        v                         |
translation layer ----> shared cache/glossary/provider boundary
        |
        v
render(node, mode)
~~~

The translation layer receives and returns only string[]. It does not know whether the caller will use mode A or mode B and performs no DOM operation. Both modes consume the same cached { original, translation } records. The original string is authoritative in the display layer's in-memory, iterable node record table, not in data-* attributes, not in a DOM property, and not in the rendered translation. The DOM is only a rebuildable view.

Mode switching iterates the existing record table and calls render(node, mode). It never calls the translation layer, makes no API request, and has no translation latency.

- Mode A updates the existing text node's content when the approved strategy allows translation. It does not insert a sibling.
- Mode B leaves the original text in place and appends the translation as the next sibling presentation. It is forbidden for position-index-sensitive elements.
- Bilingual nodes, when implemented, carry data-hltv-zh="1" and translate="no".
- If a framework replaces DOM nodes, observer/display reconciliation rebuilds the view from the in-memory records; it does not guess the original from an altered DOM attribute or translated text.
- If the translation equals the original, or the original is pure numeric, pure date, or pure symbol text, mode A does not replace it and mode B does not insert anything.

### 3.2 Exact semantics of off

off is the user-visible disabled state, not a third rendering mode. The extension runtime remains installed and may receive settings/lifecycle events, but the page translation feature is dormant:

- after the transition to off, the content observer is disconnected and no new nodes are recorded;
- no translation request, cache fill, DOM replacement, or DOM insertion is performed while off;
- on entry to off, the display controller performs one cleanup transition using the in-memory records: restore tracked text nodes to original and remove only extension-owned bilingual nodes marked data-hltv-zh="1"; this cleanup is not steady-state off behavior;
- the record table is retained until cleanup and restoration are verified, then cleared so off has no stale page records;
- after the table is cleared, framework re-render reconciliation does not run while off;
- re-enabling mode A or B starts a fresh scan and creates fresh records from the current page view; it does not request translations until eligible strings are collected;
- off is not passed to render(node, mode); the controller branches before rendering.

This makes off distinct from mode A and mode B while ensuring that disabling the feature leaves the page in its original view and does not require DOM attributes to recover text.

## 4. Staged execution and verifiable outputs

### Gate 0 — Owner approval of this plan

Output: approved PLAN.md.

Completion test: the owner explicitly says to continue. No code, Git initialization, browser loading, or page capture occurs before that confirmation.

### Gate 0.5 — Git and repository hygiene

Actions after Gate 0 approval:

1. Initialize Git with the default branch explicitly named main:

       git init -b main

2. Create .gitignore before staging or committing anything. It must include:

       node_modules/
       dist/
       .env
       .env.*
       !.env.example
       *.log
       .DS_Store
       raw-capture/
       *.tmp.html

3. Immediately after .gitignore is created, create the local evidence directory:

       New-Item -ItemType Directory -Force raw-capture

4. Immediately verify the ignore rules with Git, before creating or staging any other file:

       git check-ignore -v --no-index raw-capture/ .env raw-capture/probe.tmp.html

   The actual command output must be shown to the owner. No predicted or fabricated output is acceptable. If Git does not emit a line for the empty directory path itself, the output for raw-capture/probe.tmp.html must be present and the behavior must be recorded; the verification is not silently treated as passed.

5. For this verification, retain raw-capture/ as an empty local directory and do not add .gitkeep. Git does not track empty directories, the directory is intentionally local-only, and .gitkeep would add an unnecessary repository file and could weaken the raw-evidence boundary. Do not delete and recreate it merely to make it appear in Git. If a fresh clone lacks it, Gate 3 may recreate the ignored directory before capture.

6. Create the MIT LICENSE, the English README.md skeleton with the HLTV non-affiliation disclaimer and the warning that the extension depends on hltv.org page structure and may break after site changes, and NOTICE.md with the third-party reference/license section.

7. The first-commit staging whitelist is exactly:

       .gitignore
       LICENSE
       README.md
       NOTICE.md

   PLAN.md, .env.example, raw-capture/, dist/, source files, and every other file are excluded from the first commit. Do not use git add -A. Before staging, report this exact whitelist and wait for owner confirmation.

8. Before committing, inspect the exact staged set for real secrets/API keys, raw captures, and anomalously large files. If any are found, report them and do not commit.

9. Make one conventional first commit, for example chore: initialize repository hygiene, only after the owner confirms the whitelist.

10. Immediately after the commit, run:

       git show --stat HEAD

    The real output must be pasted to the owner so the actual commit contents can be checked. A statement of intended contents is not a substitute. Also show git status --short --branch.

Verifiable output: a main-branch repository, a verified .gitignore, the four-file first commit only, the actual git show --stat HEAD output, and the actual post-commit status. No dist/, raw capture, real .env, real key, or PLAN.md may be in the first commit.

### Gate 1 — Minimal cross-browser scaffold

Planned implementation:

- TypeScript + Vite;
- one root manifest.json only;
- Manifest V3 background declaration with both scripts: ["background.js"] and service_worker: "background.js" pointing to the same IIFE output;
- no background.type: module;
- browser_specific_settings.gecko.id;
- webextension-polyfill and only browser.* calls;
- one background entry that prints a startup log;
- one HLTV content entry that prints an injection log;
- no translation, DOM replacement, DOM insertion, glossary, API call, or CI configuration.

The build must be inspected to ensure background.js is a single IIFE-compatible file and that manifest paths point to real output files.

Verifiable output: the build completes with its real terminal output recorded; generated dist/ remains ignored and uncommitted; source inspection shows no translation or DOM-write implementation.

### Gate 2 — Blocking owner-run browser loading checks

This gate is a hard blocker. Chrome, Edge, and Firefox must all pass independently before Gate 3 begins. If any browser fails to load the extension, start the background context, inject the content script, or expose the required log, stop and fix the scaffold, rebuild, and rerun the failed browser. Do not enter Gate 3 with a missing browser log. “Known limitation” is allowed only for a non-blocking difference such as harmless styling or console presentation; it is not allowed for a non-starting scaffold or an unobservable required log.

Loading instructions will be handed to the owner:

- Chrome/Edge: open the extensions management page, enable Developer mode, choose Load unpacked, select dist/, reload after rebuild, and inspect the extension/background log and an HLTV tab's content log. Edge must be run separately even though its engine is related to Chrome.
- Firefox: open about:debugging → This Firefox → Load Temporary Add-on…, select the built manifest.json, then open the temporary extension's Inspect entry if present. In the Add-on Toolbox, use Console to verify the background startup log. Also open DevTools for an hltv.org tab and verify the content-script log there.
- Firefox fallback when the temporary extension card has no Inspect entry or the Add-on Toolbox does not expose the event-page log: open Browser Console with Ctrl+Shift+J, filter by the extension ID or the known log prefix, and trigger the extension event/content-script message that starts the event page. The same fallback can be exercised through web-ext run --bc once web-ext is installed. This fallback is an alternative log location, not permission to skip the background-log check.

Firefox-specific test status at plan time: it could not be executed in this environment because Firefox was neither exposed by the browser connector nor installed locally. The official locations above are therefore pending actual owner-run verification. If the owner-run Firefox version provides neither Add-on Toolbox nor Browser Console evidence for the background log, Gate 2 fails and the scaffold must be revised or the issue escalated; it is not silently recorded as a known limitation.

Verifiable output: a separate pass/fail report for Chrome, Edge, and Firefox containing browser/version, load method, background-log location, content-log location, and observed log text. All three must pass before reconnaissance.

### Gate 3 — Evidence-based reconnaissance

Outputs:

- docs/findings.md: three real URLs, SSR/client-rendering evidence, SPA/navigation evidence, live-update request names and observed intervals, CSP, framework evidence, positional-update investigation, layout inventory, and route comparison;
- docs/display-strategy.md: per-element proposal covering translate/keep, mode A/B, selector, rationale, and risk, explicitly marking index-sensitive elements mode A only;
- docs/compliance.md: exact robots/terms excerpts, URLs/access dates, referenced projects and licenses, and any incompatibility or unresolved legal risk.

Gate 3 is subdivided as follows:

- Gate 3A: capture the three pages, inspect initial HTML and Network requests, and establish SSR/client-rendering and SPA/live-update evidence.
- Gate 3B: complete the P0 framework and positional-update investigation in section 2.4. If it is Unable to confirm, stop the architecture decision.
- Gate 3C: complete the compact-layout and marker investigation in section 2.5, then draft the element strategy.
- Gate 3D: complete compliance and third-party license checks.

Completion test: every requested conclusion has a URL, selector, request name, response fragment, DOM observation, or an explicit Unable to confirm record describing the attempted check. No speculative wording is used as evidence.

### Gate 4 — Owner review of display strategy and blockers

Output: owner-approved or corrected docs/display-strategy.md, plus resolved/accepted entries in PROGRESS.md.

Completion test: each listed element type has an explicit translate decision and mode decision, including the no-noise rule for identical/pure numeric/date/symbol strings. No display implementation begins before this review.

### Gate 5 — Later implementation milestones (not part of this step)

Each later milestone must have an independently testable artifact:

- pure translation contract and cache tests proving shared results and zero-request mode switches;
- node record store and renderer tests proving the DOM is never the source of truth;
- observer tests proving extension nodes are skipped and framework re-renders can be rebuilt from records;
- approved element strategy implemented with the one CSS file;
- timeout/fallback tests proving API failure cannot blank or break the page;
- separate Chrome, Edge, and Firefox regression passes;
- packaging check proving only a tagged GitHub Release carries a built ZIP, while dist/ stays untracked.

## 5. Open questions, ordered by importance

### P0-LANG — Original-language eligibility

Before any translation request, the display layer needs a deterministic eligibility decision for each candidate text. This is a new P0 blocker because a wrong skip/translate decision can either waste API calls and create noise or alter text that should remain authoritative.

The planned decision strategy is layered and conservative. It will classify a normalized view of the text but preserve the exact original string unchanged for rendering and records:

1. Exclude non-text surfaces first. The scanner only considers visible text nodes; URLs, CSS class names, data-* values, element attributes, and other metadata are never sent to the language classifier or translator.
2. Apply deterministic protected-value checks before language detection. The checker recognizes strict pure-number forms, strict pure-date forms (including numeric/ISO forms and documented date-token forms), and pure-symbol/punctuation/emoji forms using Unicode categories plus explicit separator grammars. It does not treat any string containing ordinary prose letters as pure numeric/date/symbol merely because it contains digits.
3. Match glossary.json entries with keep_as_is: true using longest-match, token-aware matching on a comparison-normalized view. The original spelling and casing remain untouched. Substring matches inside a longer identifier are not protected unless the glossary entry's token boundaries match.
4. Classify already-target-language text using multiple signals, not a single “contains a Chinese character” regular expression. For the current target zh-CN, the classifier will combine Unicode script runs and counts (Han, Latin, Kana, Hangul, and other letters), minimum Han evidence, the proportion of Han characters among meaningful letters after protected spans are removed, and a locale-aware lexical/language score for short or ambiguous text. Han plus Kana/Hangul, a single Han character in an English name, and very short tokens are not automatically classified as Chinese. The exact threshold and score table are a P0 implementation parameter to be validated against the captured pages.
5. If the text is clearly target-language text, keep it unchanged and do not call the translation layer. If it is clearly eligible English prose, send it to the translation layer. If confidence is low, preserve the original instead of risking a destructive translation; record the uncertain classification for later strategy review.
6. For a mixed English/Chinese sentence, split only at confident language/protected boundaries. Preserve Chinese runs, glossary-protected terms, identifiers, numbers, dates, symbols, and separators byte-for-byte; send only clearly translatable English prose segments as string[]; reassemble segments in original order. If the boundary is ambiguous or cannot be represented safely in the chosen element strategy, keep the whole candidate unchanged rather than translating through the ambiguity.

This strategy has both error types:

- False positive skip: an English or mixed phrase can be treated as Chinese because it contains a Chinese name, a short Han token, or an English sentence with many protected digits. Consequence: missed translation. Mitigation: minimum evidence, script conflict checks, lexical score, and uncertain fallback.
- False negative translate: Chinese, Japanese Kanji, a proper noun, or a mixed label can be treated as eligible prose. Consequence: unnecessary API cost or altered terminology. Mitigation: glossary protection, Kana/Hangul conflict checks, conservative short-text handling, the equality/no-noise rule, and original fallback on uncertainty.

The report and later tests must include examples of pure numbers, dates, symbols, Chinese-only text, English-only text, a glossary keep_as_is term, Chinese/English mixed sentences, team names, player IDs, and short ambiguous labels. The owner must approve the threshold and mixed-segment behavior before implementation. No glossary file is created in this step.

### P0 page and mutation questions

1. What exact mechanism updates each page class: server-rendered HTML, client JSON, or a mixture? The answer must be tied to observed requests and DOM evidence.
2. Does any inspected HLTV code update compact containers by positional access (children[0], firstElementChild, nth-child, childNodes[i], or an equivalent compiled/keyed-list assumption)? If yes, which container and which content?
3. If extension text is overwritten by a re-render, can the extension reliably identify the same logical text and rebuild it from its in-memory record without reading a DOM attribute?
4. Is HLTV using React, Vue, Svelte, another framework, or server-rendered DOM with incremental scripts? What concrete runtime/markup evidence supports that classification?
5. What CSP is actually returned on the selected pages, and does it permit or block the proposed page-script/in-page integration? Is page-script injection needed at all for the approved DOM route?

### P1 behavior and strategy questions

6. Is navigation SPA-like on any target page, and which lifecycle event reliably tells the content script that a new view needs scanning?
7. Are scores or live data refreshed by polling, long-lived connections, or user-triggered requests? What is the observed interval and which nodes change?
8. Which selectors remain stable across the three page types and across a reload? Which text containers are compact grid/table cells where bilingual width is unacceptable?
9. Which semantic values must never be translated or rewritten, including IDs, abbreviations, numbers/statistics, timestamps, URLs, CSS classes, and data-* values?
10. Can bilingual text be inserted as the next sibling without changing the child positions relied upon by the page, and can data-hltv-zh="1" plus translate="no" make the node safely invisible to both the extension observer and browser translation?

### P2 delivery and compliance questions

11. Do robots.txt and the current terms restrict the planned manual/requested access, automated fetching, or redistribution of translated output? Are the relevant clauses unambiguous?
12. Which third-party projects will actually be referenced or borrowed from, and are their licenses compatible with an MIT-distributed extension?
13. What Firefox AMO constraints or review considerations affect the chosen transport, permissions, or user-supplied API-key storage?
14. What UI is needed for the three visible states (disabled/off, mode A, mode B), and where should user settings live without putting secrets in source control?

## 6. Planned document outputs beyond this file

### docs/findings.md

Must contain the three exact real URLs, capture method and access date, curl/DevTools evidence, request names, response excerpts, selectors, CSP, SPA/live-update observations, framework markers, position-index findings, layout inventory, and explicit Unable to confirm entries where evidence could not be obtained. It must never include raw challenge pages as evidence.

### docs/display-strategy.md

Must give an owner-review proposal for each required element type:

- team name;
- player ID;
- map name;
- event/tournament name;
- statistics table header;
- numbers and time;
- news title;
- article body;
- score and live data.

Each row must contain element type, translate/keep decision, suggested mode A or mode B, reason, selector when known, and risk. Position-index-sensitive elements must say mode A only. The following rule is mandatory:

> If the translation equals the original, or the original is pure numeric, pure date, or pure symbol text, write nothing: mode A does not replace it and mode B does not insert it.

The strategy is a proposal only until the owner confirms it row by row.

### PROGRESS.md

Must record step status, actual browser verification results, key decisions, unresolved P0/P1/P2 questions, owner confirmations, and the next allowed action. It must not claim a gate passed without the corresponding real output.

### docs/compliance.md

Must quote the relevant current robots.txt and Terms/usage wording verbatim within permitted short excerpts, link each source URL, record access date, list every referenced third-party project and license, explicitly flag MIT incompatibility, and report any compliance risk without choosing a bypass.

## 7. Explicit non-goals and hard rules for the current step

- No translation API calls or API-key handling.
- No glossary file or hard-coded terminology.
- No DOM text replacement or sibling insertion.
- No network interception implementation.
- No Puppeteer, Playwright, or automated crawling.
- No Safari/iOS support, CI, release packaging, or unrelated refactoring.
- No second manifest and no browser-specific manifest fork.
- Request hltv.org at intervals of at least one second and never in parallel.
- Do not commit dist/, raw-capture/, local HTML/temp captures, real .env files, or real API keys.
- Use conventional commit prefixes only: feat:, fix:, docs:, chore:, refactor:.
- Stage only explicitly approved files; never use git add -A.
- Before every commit, report the exact staging list and wait for owner confirmation.
- README.md and code comments will be in English; glossary.json will be Chinese when it is created in a later step.
- The README will state that the extension is not affiliated with HLTV and depends on hltv.org page structure, so site changes may make it fail.
