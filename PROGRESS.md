# Progress

Latest handoff: **0.0.6** reviewed on 2026-10-08 without functional changes. Normal Chrome confirms fixed dropdown text and the archive All filter are Chinese, but match-detail UI still has substantial English. Current 156 tests, typecheck/build/distribution checks pass; additional mock reproductions establish remaining validator/cache/settings/runtime defects. See `docs/review-2026-10-08.md` and the final section. Canvas Chinese replacement is still awaiting the owner's display-contract choice. Earlier stages are historical records.

## Gate 0.5 — Git initialization and repository hygiene

Status: complete; Gate 1 implementation and build are complete; Gate 2 is complete for the current Chrome and Edge scope, with Firefox deferred.

- Git repository initialized with default branch `main`.
- `.gitignore` created before any staging action.
- `raw-capture/` created as an empty local-only directory.
- The required `git check-ignore -v --no-index raw-capture/ .env raw-capture/probe.tmp.html` check returned exit code 0 and matched all three paths.
- Created `LICENSE`, `README.md`, `NOTICE.md`, and placeholder-only `.env.example`.
- Pre-commit scan found no high-confidence secret pattern, raw capture, or anomalously large whitelist file.
- `PLAN.md` is intentionally not ignored; it is excluded from the first commit by the explicit staging whitelist and remains eligible for a later documentation commit.
- First commit created as `ddcc188` with message `chore: initialize repository hygiene`.
- The first-commit hash changed from `f181a34d4d0e2a5341bd3998f31fdb5eba10bc28` to `ddcc188` because the commit author identity was corrected.
- `git show --stat HEAD` confirmed that the commit contains exactly four files: `.gitignore`, `LICENSE`, `NOTICE.md`, and `README.md`.
- Second commit created as `862d88faa345fc7d054ef1b88cca92717d547cf4` with message `docs: add project plan and progress log`.
- The second commit contains `.env.example`, `PLAN.md`, and `PROGRESS.md`; the post-commit status was clean.

### Actual verification output

The required ignore check for `.env.example` returned the negation rule:

```text
.gitignore:5:!.env.example	.env.example
```

Therefore `.env.example` is not ignored.

## Gate 1 — Minimal scaffold

Status: implementation and build complete; Gate 2 is complete for the current Chrome and Edge scope; Firefox is deferred, not abandoned.

- Node: `v24.19.0`.
- Package manager: `pnpm 12.4.1` via `pnpm.cmd`; PowerShell's `pnpm.ps1` shim was blocked by execution policy.
- Installed versions: `webextension-polyfill 0.12.0`, `@types/webextension-polyfill 0.12.6`, `typescript 7.0.2`, and `vite 8.3.0`.
- `pnpm typecheck` passed with `tsc --noEmit`.
- `pnpm build` produced exactly `dist/background.js`, `dist/content.js`, and `dist/manifest.json`.
- The bare import/export check returned `rg_exit=1` and `NO_BARE_IMPORT_EXPORT_FOUND`.
- Manifest paths resolve to existing files: `background.js`, `background.js`, and `content.js`.
- `git ls-files -- dist` returned no tracked files; `dist/` is ignored by `.gitignore`.
- Gate 2 passed for the current target browsers Chrome and Edge. Firefox is outside the current supported scope and is documented below as an unresolved diagnostic, not as a success.

### Gate 2 browser validation

- Edge: automatic validation passed. The service worker was alive and read the manifest internally: worker id `aiginabjibgaalcealemidoceijokeka`, version `0.0.1`, and name `CS2 HLTV Chinese Reader`. On `https://www.hltv.org/`, the content log was `[cs2-hltv-zh] content script injected at https://www.hltv.org/`. The HTTP response was `200`, the title was `Counter-Strike News & Coverage | HLTV.org`, and no Cloudflare challenge page appeared.
- Chrome: manual validation passed. The background log `[cs2-hltv-zh] background started (version 0.0.1)` was confirmed in the extension service worker DevTools Console, and the content log `[cs2-hltv-zh] content script injected at https://www.hltv.org/` was confirmed in the hltv.org page Console.
- Additional evidence: Playwright's supported Chromium host passed both background and content validation, and produced the same extension ID as Edge (`aiginabjibgaalcealemidoceijokeka`). This supports that the built artifacts and manifest are healthy.
- Gate 2 is passed for the current target browsers Chrome and Edge. Firefox is not a current Gate 2 target.

### Gate 2 current-scope completion

- No pending Gate 2 browser checks remain for the current Chrome and Edge scope.

### Deferred Firefox diagnostic

- Firefox is temporarily unsupported and deferred, not abandoned.
- The owner-run Firefox test showed `WebExtension Fallback Document` in Add-on Toolbox with an empty console, and no background startup log in Browser Console.
- The content script did inject normally: `[cs2-hltv-zh] content script injected at https://www.hltv.org/`.
- These observations rule out Firefox rejecting the extension entirely and rule out content-script injection as the failure. The unresolved problem is specifically that the background event page did not start.
- Unverified hypothesis: the presence of the `background.service_worker` key may interfere with Firefox parsing or starting the `background.scripts` event page. This remains a hypothesis; it is not recorded as the cause.
- When Firefox support is restored, the first isolation experiment must be:

  > 临时移除 background.service_worker 键，只保留 background.scripts，重新加载，观察事件页是否启动。若启动 → 双键写法是原因；若不启动 → 原因在其他地方。

- Test record: Firefox `156.0`, executable `C:\Program Files\Mozilla Firefox\firefox.exe`. The temporary extension must be reloaded after each browser restart during future diagnosis.

### Known items deferred from Gate 1

- `manifest.json` currently has no `icons` field. Chrome and Edge will display the default extension icon; adding icons is a later TODO and is not part of this scaffold.
- `manifest.json` currently uses the user-visible placeholder description `A log-only browser extension scaffold...`. After Gate 3 reconnaissance and confirmation of the feature positioning, rewrite it to describe the real extension functionality.

### Gate 1 scaffold commit

- Completed as `529ae86` with message `chore: add minimal extension scaffold`.

## Gate 3 — Evidence-based reconnaissance

Status: Gate 3 documentation outputs updated for the current Chrome and Edge scope. P0-3 is resolved for `/matches` and the documented news/article structures; the match-detail `.match-page`/score-area CSS remains `Unable to confirm`, and Gate 4 owner decisions are recorded below.

- Gate 3A: the current news archive, one news article, and one match-detail page were captured once each with curl and at least two-second request spacing. Under the explicit P0-3 re-fetch authorization, `/matches` and its primary stylesheet were then captured sequentially with the same curl discipline.
- News-list URL resolution: `https://www.hltv.org/news` was known to return 404; the current list URL was resolved from home navigation and the sitemap trail as `https://www.hltv.org/news/archive/2026/september`.
- P0-1: the four sampled page types show SSR HTML, no React/Vue/Svelte/Angular/Alpine markers, no `hx-*` attributes, and no relevant first-party DOM child-position access in the inspected scripts. Runtime SPA navigation and mutation timing remain bounded as `Unable to confirm` because this pass used curl/source evidence rather than a live DevTools trace.
- P0-2: the preloaded livescore modules establish Socket.IO score delivery from `https://scorebot-lb.hltv.org`; `score` events update `data-livescore-*` nodes. Runtime handshake/reconnect timing was not measured.
- P0-3: the local 2026-09-20 re-fetch returned HTTP 200 and produced 1,247,718 bytes for `https://www.hltv.org/matches` and 2,524,977 bytes for `https://resources.hltv.org/hltv-everything.css/fdddc7f98fef6cb157c3efd609bb3360.css`. The local evidence is in `raw-capture/gate3/matches.html` and `raw-capture/gate3/matches-style.css`. The handoff sizes were 1,243,948 and 2,524,946 bytes; the difference is recorded, but its cause is not established.
- The target-parent scan found no `:nth-child`, `:first-child`, or `:last-child` selector for `.match-team`, `.match-teams`, `.match-teamname`, or `.match-info`. The observed positional selectors are on `.match-time-wrapper`, not the `.match-teamname` parent, so position-shift risk was not found in this `/matches` scan.
- The real `/matches` constraint is dimension-related: `match-event` and `match-time` have no fixed target width rule found in the stylesheet and are bilingual-feasible candidates; `match-teamname` is structurally unconstrained but is excluded from translation by the Gate 4 owner decision; `match-stage` and `match-meta` have fixed dimensions and are Mode A only because inserted content may clip or overflow.
- CSS for the match-detail `.match-page`/score area was not checked and remains `Unable to confirm`. News/article CSS is resolved for the documented archive `.index` structure and article `.newsdsl .newstext-con`/`.news-block` structure; no `/matches` or news conclusion is applied to the uninspected match-detail score area.
- Created `docs/findings.md`, `docs/display-strategy.md`, and `docs/compliance.md`. Raw captures remain ignored and local-only.
- Gate 4 owner review and decisions are now recorded below. No display implementation begins in this documentation step.

## Gate 4 — Owner-confirmed display strategy

Status: complete for the owner decision; implementation remains a later Gate 5 activity.

- Team names are never translated. `Aurora` remains `Aurora`; the strategy is Mode A no-op and excludes team names from Mode B.
- Event/tournament names use partial translation. Brand fragments are protected by `glossary.json` entries with `keep_as_is`. The prompt must list each protected fragment, the result must preserve every protected fragment byte-for-byte, and validation failure discards the result and falls back to the original. Reordering such as `Fall 2026` → `2026 秋季赛` requires structural validation. On `/matches`, `match-event` is approved for this strategy in Mode B; other page-specific containers remain separately bounded.
- The translation backend is an interchangeable LLM provider interface using the OpenAI-compatible `/chat/completions` protocol. DeepSeek, OpenAI, and local models are selected by `baseURL` and model name only. No provider is locked at Gate 4, and DeepL is not used.
- News titles and article bodies are approved for Mode B. The archive `.index .newstext` flex evidence and article `.newsdsl .newstext-con`/`.news-block` evidence support that decision; the match-detail `.match-page`/score-area CSS remains `Unable to confirm`.
- Comments are approved for Mode B only when the entire `.forum-middle` body is confidently classified as English. Other languages, low-confidence or failed classifications, and comments containing Chinese characters remain unchanged. Comments are translated as a whole and never use event-name partial translation. Failed or uncertain classifications must be recordable for later review.
- Comment evidence: the owner-supplied match-detail response was HTTP 200 and 717,697 bytes; the primary stylesheet was 2,524,977 bytes. The response contained 195 SSR `post` elements, with 122 `children` and 73 `threading` elements. `.forum-middle` has no fixed width/height or `overflow:hidden`, while `content-visibility:auto` can cause a small scroll-position change that requires later rendered observation.
- Comment timestamps are prohibited from translation because `hltv-csstheme.js` rewrites `[data-time-format][data-unix]` text. Countdown and `data-livescore-*` dynamic values remain prohibited as already recorded.
- P0-LANG uses the conservative rule: when language confidence is low, keep the entire original text. The same rule is mandatory for comments; comments do not use mixed-segment or partial translation.
- Unchecked boundaries remain explicit: match-detail `.match-page`/score-area CSS is `Unable to confirm`. No `/matches`, news, or comment-area CSS result is applied to that uninspected container.

## Gate 5 housekeeping — documentation and configuration debt

Status: complete for these four debts; B2 page integration and the document-event debug bridge are recorded below.

- News/article CSS reconnaissance was added to `docs/findings.md`. The archive capture was 355,372 bytes, the article capture was 320,875 bytes, and the shared stylesheet was 2,524,977 bytes. The `.index .newstext` and `.newsdsl .newstext-con`/`.news-block` containers are Mode B-feasible; `.newstc` is not an insertion target because of `min-width:80px`. The match-detail `.match-page`/score-area CSS remains `Unable to confirm`.
- The global prohibition on elements carrying both `data-time-format` and `data-unix` is recorded with evidence from match-list, comment, article, and match-detail time fields.
- `tsconfig.json` includes `tests/**/*.ts`. The deliberate test-file error produced TS2322 with typecheck exit 1; after removal, `pnpm.cmd typecheck` returned exit 0.
- `package.json` uses the native Node test runner with `node --test tests/*.test.ts`. Node v24.19.0 type stripping is used; no ts-node, tsx, or test runtime dependency was added. Test imports use explicit `.ts` extensions; existing `src/` imports retain their previous spelling. `tsconfig.json` enables `allowImportingTsExtensions` with `noEmit: true`, so the imports are type-checked directly and no TS5097 suppression is used.
- Root `glossary.json` now follows the versioned `term`/`target`/`keep_as_is`/`category` schema. The documented loader contract rejects and reports entries where `keep_as_is` is true but `target` differs from `term`.
- Vite copies the root glossary asset into `dist/glossary.json`. Runtime code must read the packaged extension copy, not the repository path.

## Gate 5 B2 — Content-script integration browser validation

Status: implementation and owner-provided automated browser validation complete. The validation used Playwright's bundled Chromium against the real `https://www.hltv.org/matches` page; it was not a system-installed Chrome or Edge run.

Implementation notes: the content script changes only target text-node `data`; it never assigns `textContent` or `innerHTML` on container elements. Observer writes use `disconnect -> write -> takeRecords -> observe` inside `try/finally` to prevent self-triggered loops. Nested candidate ownership stops at the innermost matching element. B2 uses a `【译】`-prefixed stub translator; B3b will replace it with the real provider.

The owner-provided automated run passed all ten checks:

1. Host response was `status=200`, and the extension service worker was present.
2. The document-event stats response was `{processedNodes: 1720, skippedNodes: 1268, mode: "B", enabled: true}`.
3. Mode B inserted `452` translation nodes with `forbiddenParents=0`. Sample parent classes were `text-ellipsis` and `match-event`; no inserted node had a parent class containing `match-stage`, `match-meta`, `match-time`, `current-map-score`, or `match-teamname`.
4. All `452` inserted nodes carried both `data-hltv-zh="1"` and `translate="no"`.
5. Among `40` checked `.match-stage` elements, `0` contained a translation node.
6. Never-translate checks passed: `.match-teamname` `225/0`, `.match-time` `456/0`, `.current-map-score` `4/0`, and `.match-team-livescore` `2/0`, where each value is total/mutated.
7. Layout checks passed: `overflow=0`, `docScroll=docClient=1425`, and `.match-team` remained `21px` high.
8. The observer was stable for five seconds in Mode B: translation markers remained `452 -> 452` with no loop.
9. Switching back to Mode A left `markers=0`.
10. Disabling left `markers=0`, no `【译】` text, and restored `.match-stage` text `Playoffs`.

Additional integrity checks passed: `1641` links remained intact, including `452` `a.match-top` links.

Known limits and unverified behavior:

- The run used Playwright's bundled Chromium, not the project owner's system-installed Chrome or Edge. Loading the extension in those system browsers remains unverified.
- An attempted automated page reload returned approximately `28 KB` instead of the normal approximately `1.4 MB` response and was classified as Cloudflare anti-bot interception. This is an environment limitation, not an extension failure. Therefore, reapplying translations after a page reload remains unverified.

## Gate 5 B3a — Background integration architecture

Status at the original B3a handoff: implementation was complete for owner review; no real provider was connected and no `host_permissions` had been added. B3b and B4 below supersede that handoff.

- `src/background/protocol.ts` defines validated request/response codecs for `plain` and `event-name` batches. Failure responses carry the original text array and never require the content script to handle an exception.
- `src/background/cache-store.ts` provides the IndexedDB `CacheStore` adapter. Reads degrade to cache misses and writes are best effort with diagnostics. The core `CacheStore` interface is unchanged.
- `src/background/settings.ts` reads the full local settings object in background. The API key never enters the content settings reader or the message protocol. `src/shared/settings.ts` is the single source of the `mode: 'A'` default used by both sides.
- `src/background/fake-provider.ts` is the B3a-only injectable provider and supports success, provider failure, invalid response, and never-resolving test modes. Successful values use the visible `【译】` prefix.
- `src/content/background-translator.ts` uses an injected message sender and a same-session result map. A same-session hit sends no message; a cross-page IndexedDB hit still sends one message because the cache is background-owned, but background does not call the provider on that hit.
- The background and content timeout values are injectable. Production defaults are 5000 ms for the background operation and 6000 ms for the content message; tests use short values for deterministic timeout coverage. B3a performs no retries.
- `docs/background-integration.md` records the protocol, module boundaries, API-key boundary, runtime glossary loading, timeout policy, and the three cache semantics.
- At the original B3a handoff, automated validation was pending owner review; system-browser loading and a real provider remained B3b or later work.

## Documentation lesson

> PROGRESS.md 曾出现文档漂移：记录了已完成的提交为待批准状态，导致后续会话误判进度。今后每个 Gate 完成时，必须在同一次操作中更新 PROGRESS.md 并核对 git log 的真实输出。

## Gate 5 B3b and B4 implementation

Status: implementation and automated verification are complete, and the owner has passed local-model end-to-end validation and approved staging, commit, and push.

- Added the real OpenAI-compatible background provider using the shared core `createOpenAICompatibleProvider`, with DeepSeek/OpenAI defaults, injected timeout and temperature, strict JSON response parsing, per-item validation, and original-text failure fallback.
- Added exact-origin optional permission checks at options save, background startup, each translation request, and permission removal. The background never prompts. The options page reports missing permission and provides an explicit repair action.
- Added an HTTP exception only for `localhost`, `127.0.0.1`, and `[::1]` so local model servers can be used without allowing external HTTP hosts. The manifest declares only those loopback HTTP patterns in addition to HTTPS; parser tests cover localhost, IPv4/IPv6 loopback, external HTTP rejection, and unchanged HTTPS behavior.
- Added the plain HTML/CSS/TypeScript options page, local settings storage, preset selection, JSON output mode switch, safe one-request connection test, and counted IndexedDB cache clearing. Existing tabs apply enabled/mode changes from `browser.storage.onChanged` without reload.
- Recorded the approved interface-preserving core batching change and its four regression tests. The public `TranslationService` signatures remain unchanged.
- Cache identity now comes from `createTranslationCacheKey(text, purpose, hash)` with format `v2:<purpose>:<text hash>`. Existing B3a bare-hash records remain inert until cache clearing; texts with only an old record are translated once under the new format, with no effect on settings, permissions, returned values, or valid v2 records.
- Updated `README.md`, `docs/background-integration.md`, `docs/translation-layer.md`, and `docs/b3b-provider-options-contract.md` to reflect the implemented behavior and cache-key migration.
- Strict TDD was used for the batching, permission guard/revocation, provider factory, connection test, cache clear, live settings updates, empty-userinfo URL rejection, and loopback HTTP URL parsing. Each targeted RED test was observed before its corresponding implementation and then passed.
- `ConnectionTestResult` remains a fixed discriminated union of safe reason values and optional HTTP status. It never carries raw provider text or settings, which prevents key disclosure through the result structure instead of relying on string redaction; this is documented in the provider contract.
- This implementation was subsequently committed as `d3b42af feat: add configurable provider and contextual translation`; it is included in the verified `main` history.

## Classification context repair

Status: implementation, automated verification, and owner-provided local fake-provider end-to-end validation are complete; commit and push are authorized.

- Added context-aware classification while keeping the default `comment` context conservative. Match event/stage/meta/time strategies pass `structured`, prose strategies pass `prose`, and comment strategies pass `comment`.
- Added deterministic pre-classification glossary substitution for fully covered controlled values. `bo3` and `bo5` remain unchanged because players recognize them and the 28 px `.match-meta` field cannot fit expanded labels reliably.
- Added regression coverage for real match labels, no provider call for glossary-covered values, conservative UGC comments, context-independent numbers/dates/symbols/Chinese, and the display `never` strategy for team names.
- Verification passed: `pnpm.cmd typecheck` (exit 0); `pnpm.cmd test` (95 passed, 0 failed, 0 skipped); `pnpm.cmd build` (all background/content/options builds succeeded); dependency direction (`node --test tests/translate-dependencies.test.ts`, 1 passed). The built distribution contains manifest, glossary, background/content/options JS, options HTML/CSS, no bare import/export statements in bundles, and valid options resource references.
- Owner-provided browser end-to-end verification passed with a local OpenAI-compatible fake server at `127.0.0.1:8788`: loopback permission grant and settings save succeeded; Mode B inserted 374 translation nodes, and all 14/14 event names rendered. Never-translate counts were team names 212/0, times 369/0, live scores 28/0, and livescore 14/0 (total / containing Chinese). Translations were the next sibling of the original text under `text-ellipsis`. The observer remained stable at 374 nodes for six seconds. Disabling the extension removed all translation nodes and restored the page.
- Owner-provided classifier checks on real page text showed structured eligible values increasing from 2/27 to 17/23; comment values remained 8/8 untranslated; Chinese 0/3 and number/symbol values 0/6 were translated. `bo3` and `bo5` matched glossary `keep_as_is` and bypassed both classifier and provider.
- One document-width measurement read 1521 against a 1425 viewport. Four controlled reproductions measured 1425 with zero overflowing elements; the same disabled state produced inconsistent 1425 and 1521 readings, while translation-enabled readings were normal. The owner attributes this measurement noise to HLTV lazy loading rather than the extension. Future manual verification uses the count of overflowing extension container elements as the layout criterion, not document width.
- This implementation was subsequently included in `d3b42af feat: add configurable provider and contextual translation`; the current verified remote `main` contains that commit.

## Provider permission lifecycle recovery and live-page rescan

Status: implementation and automated verification were completed and committed as `d6d8fa5 fix: recover provider permission state and rescan open pages`. The earlier handoff text below saying review was pending is superseded by this recorded repository state.

- The background permission monitor now rechecks the saved exact origin after local settings changes and matching `permissions.onAdded` / `permissions.onRemoved` events. Diagnostics represent current state, are deduplicated across repeated checks, and clear through an `undefined` callback after permission is restored. The per-request permission guard remains active.
- Existing content scripts now route enabled, mode, and provider-setting updates through the serialized `requestScan` chain. Provider changes refresh records and the session cache; failed fallback translations can be retried after settings change. Rescans preserve record identity, do not duplicate marked siblings, return originals on failure, and do not run while disabled.
- Added permission lifecycle and open-page recovery tests. TDD showed the new cases fail before the implementation; the full suite now passes with 99 tests (the previous 95 plus four new cases). The failed translation fallback is not cached, allowing a later scan in the same page session to retry.
- Updated the background/provider contracts and testing guide with the startup ordering trap and the prior browser-validation blind spot: the previous check used `127.0.0.1` and granted permission in the same session, so it did not cover load-before-configuration. Future browser verification must use both load-then-configure on an already-open `/matches` page and a real external HTTPS provider origin.
- Verification passed at that stage: `pnpm.cmd typecheck`; `pnpm.cmd test` (99 passed, 0 failed); `pnpm.cmd build` (background, content, and options); `node --test tests/translate-dependencies.test.ts` (1 passed). The commit is present on `origin/main`.

## Toolbar popup and first-use setup

Status: implementation and automated verification complete; the owner continued to the next stage.

- Added a Chinese toolbar popup with a translation enable switch, full-Chinese/bilingual mode choices, provider readiness status, and an entry to the existing options page.
- The popup checks whether an API Key exists and whether the configured provider origin has permission. It never displays or sends the API Key; changing enabled/mode writes only those preference fields to local storage, which triggers the existing open-tab rescan path.
- Added the `action.default_popup` manifest entry and a Vite popup build target. The build includes `popup.html`, `popup.js`, and `popup.css` alongside the required background, content, manifest, and glossary outputs. No new permission or dependency was added.
- Added five popup controller regression tests. The tests first failed against an empty controller stub and passed after implementation.
- Verification: `pnpm.cmd typecheck` passed; `pnpm.cmd test` passed (104 passed, 0 failed, 0 skipped); `pnpm.cmd build` passed for background, content, options, and popup. The popup HTML references the packaged stylesheet and script. No files have been staged or committed.
- This repository stage began with `HEAD=d6d8fa5c5eec0e92b07ce19a5bca031e1706accc`, equal to `origin/main`, and a clean working tree. Confirm the actual `git log` and final status before recording or committing later changes.
- Remaining product scope: first use still requires the user to configure their own provider/API Key and authorize its origin. The current page-coverage stage is recorded below.

## Evidence-based news, article, and comment coverage

Status: implementation and automated verification are complete in the working tree; awaiting owner review.

- Added centralized selectors and data-driven strategies for the inspected news archive title, article prose, tooltip-linked article entities, and match comment body. The match-detail `.match-page`/score area remains explicitly out of scope because its layout is `Unable to confirm`.
- News titles and article prose are enabled in Modes A and B. Tooltip-linked entities carrying `data-tooltip-id` are protected from translation. Comments are enabled only in Mode B; the content runtime skips their provider request in Mode A and rescans them when the user switches to Mode B.
- Added content/display regressions for page classification, protected article entities, prose/comment contexts, and mode-aware provider calls. Targeted TDD checks passed (29 tests).
- Verification passed: `pnpm.cmd typecheck`; `pnpm.cmd test` (107 passed, 0 failed, 0 skipped); `pnpm.cmd build` (background, content, options, and popup); `node --test tests/translate-dependencies.test.ts` (1 passed); `git diff --check`. The build contains background/content/manifest/glossary plus options and popup assets; background scripts and service worker both point to `background.js`, with no bare imports/exports in the background/content bundles.
- Repository check: `git log -5 --oneline --decorate` begins with `d6d8fa5 (HEAD -> main, origin/main) fix: recover provider permission state and rescan open pages`; `git rev-parse HEAD` and `git ls-remote origin refs/heads/main` both report `d6d8fa5c5eec0e92b07ce19a5bca031e1706accc`. All current work remains unstaged and uncommitted.
- This stage preserves existing popup/options/provider work in the same working tree. `git status --short --branch` reports changes in `AGENTS.md`, `PROGRESS.md`, `README.md`, display/findings docs, manifest/package/Vite configuration, content/display implementation and tests, plus untracked `src/popup/` and `tests/popup.test.ts`.
- The next separately reviewed stage now covers three home news section headings, documented below.

## Home page news section headings

Status: implementation and automated verification are complete in the working tree; awaiting owner review.

- The existing `.index .newsline.article .newstext` selector already covers the 30 news titles in the captured home page, because they sit under `.index` and use the same flexible `.newstext` structure as the archive.
- Added tests for the three news-section headings in that capture. The `newsheader` class also appears on two tab controls and one recent-activity link, so the selector is narrowed to `.index h2.newsheader` and does not select those other elements.
- The shared `.index .newsheader` CSS specifies font size and spacing without a fixed width, fixed height, or hidden overflow. Only the home news section labels are included in this stage; other home-page sidebars and the unverified match-detail score area remain out of scope.
- Targeted TDD checks first failed as expected before implementation; `node --test tests/display.test.ts tests/content.test.ts` then passed all 30 tests.
- Verification passed: `pnpm.cmd typecheck`; `pnpm.cmd test` (108 passed, 0 failed, 0 skipped); `pnpm.cmd build` (background, content, options, and popup); `node --test tests/translate-dependencies.test.ts` (1 passed); `git diff --check`.
- The implementation uses the existing local 2026-09-20 home capture and shared stylesheet only; no new HLTV request or manual browser rendering check was performed. Rendered behavior beyond automated DOM-fake coverage remains unverified.
- No files have been staged or committed. Stop for owner review after the final repository-state check.

## Match-detail static module headings

Status: implementation and automated verification are complete in the working tree; awaiting owner review.

- Added a selector group for five captured headings: `Betting`, `Lineups`, `Matches, past 3 months`, `Head to head`, and `VRS forecast`. These strings use structured classification and Mode A replacement only.
- The selector excludes the `Maps` and `Map stats` sections, the dynamic `Watch(143k)` heading, and all team/player names, score/map data, odds, and statistical values. The full match-detail/maps/score layout remains `Unable to confirm`.
- The existing match-detail snapshot and shared CSS were inspected locally; no new HLTV request was made. Tests first failed before implementation, and the targeted display/content suite now passes 31 tests.
- Verification passed: `pnpm.cmd typecheck`; `pnpm.cmd test` (109 passed, 0 failed, 0 skipped); `pnpm.cmd build` (background, content, options, and popup); `node --test tests/translate-dependencies.test.ts` (1 passed); `git diff --check`. All required distribution files are present, both background declarations point to `background.js`, and background/content bundles have no bare imports or exports.
- Repository check: `git log -5 --oneline --decorate` begins with `d6d8fa5 (HEAD -> main, origin/main) fix: recover provider permission state and rescan open pages`; local `HEAD` and `origin/main` both report `d6d8fa5c5eec0e92b07ce19a5bca031e1706accc`. Existing feature and documentation changes remain unstaged and uncommitted.
- No live browser rendering check was run for the new headings. Stop for owner review before starting another coverage stage.

## Global primary navigation

Status: implementation and automated verification are complete in the working tree; work continued under the owner's explicit instruction to proceed across stages.

- The owner confirmed the interface contract before implementation. The selector `.navbar .navcon a.nav-link` targets 15 primary-menu entries in each of the five existing local captures; it excludes the separate `.navbar-smartphone` bar, dropdown contents, and unrelated controls.
- The primary navigation strategy uses structured classification and Mode A replacement only. The content regression confirms that text changes in place while the anchor's `href` and nested SVG icon remain intact. The captured narrow-screen navbar item has a fixed 40px height and `overflow:hidden`, so Mode B sibling insertion is not enabled.
- Tests first failed against the missing selector, context, and strategy (4 expected failures across the targeted files); after implementation, `node --test tests/display.test.ts tests/content.test.ts` passed 32/32. `pnpm.cmd typecheck`, `pnpm.cmd test` (110 passed, 0 failed, 0 skipped), `pnpm.cmd build`, `node --test tests/translate-dependencies.test.ts` (1 passed), and `git diff --check` passed.
- Build inspection found all required `dist/` files plus the options and popup assets. `background.scripts` and `background.service_worker` both point to `background.js`; permissions remain `storage`; the background/content bundles start as IIFEs and contain no bare imports or exports. The navigation selector is present in `dist/content.js`.
- Evidence is limited to the five local 2026-09-20 page captures and the shared stylesheet; no new HLTV request or rendered-browser check was made. Visual layout and provider-specific translations remain unverified.
- No files have been staged or committed. The next section records the subsequent coverage work and current verification state.

## Additional captured page labels and route checks

Status: evidence-backed selectors and regression coverage are implemented in the working tree. Route-wide completion remains limited by unavailable page evidence.

- Expanded `.index h2.newsheader` documentation to include the archive page heading as well as the three home section headings.
- Added data-driven selectors and tests for the news article `h1` title; captured shared sidebar module headings; live/upcoming match-list headings; the match filter panel heading and static starred/ranked labels; the three match-detail map-stat tabs; and shared footer headings, copy, links, CTA, and responsible-gaming notice. These are Mode A in-place replacements. Tournament names, region counts, player-of-the-week data, the CSS-only minigame “New” badge, map-stat values, scores, times, and live data remain excluded.
- Route reconnaissance on 2026-09-26 attempted `https://www.hltv.org/events`, `/results`, and `/ranking/teams` sequentially with `curl.exe` and `Accept-Language: en-US`. All three returned HTTP 403 and `Cf-Mitigated: challenge`; the saved challenge bodies are not used as page evidence and were not retried. These route layouts are **Unable to confirm**. Other uncaptured HLTV routes also remain unverified.
- The existing `https://www.hltv.org/terms` capture (`raw-capture/gate3/terms.html`, HTTP 200 on 2026-09-20) confirms the shared navigation, sidebar, and footer selectors apply there. Terms of Service text stays in English because the captured terms say English controls if a translation conflicts; only shared page chrome is covered.
- Updated `docs/findings.md`, `docs/display-strategy.md`, `docs/display-layer.md`, `README.md`, and the current-progress instructions in `AGENTS.md` to record the real coverage and route limits.
- Targeted RED/GREEN checks for this stage passed: the footer tests failed before selectors/strategies were added; `node --test tests/display.test.ts tests/content.test.ts` then passed 39 tests. Full verification passed: `pnpm.cmd test` (117 passed, 0 failed, 0 skipped); `pnpm.cmd typecheck`; `pnpm.cmd build`; `node --test tests/translate-dependencies.test.ts` (1 passed); and `git diff --check` (exit 0; only Git LF-to-CRLF notices).
- Build inspection confirmed `dist/background.js`, `dist/content.js`, `dist/manifest.json`, and `dist/glossary.json` exist; both background manifest declarations point to `background.js`; permissions remain `storage`; and neither background nor content output has bare import/export statements. Popup and options assets also build. `dist/` remains generated output and is not staged.
- No live browser rendering or extension-install verification was possible from an existing HLTV browser tab; the available browser tabs did not include HLTV. Visual layout and provider-specific final translations remain unverified.
- Final repository check: `git status --short --branch` reports `## main...origin/main` with the current popup/provider/display changes unstaged and uncommitted; `git log -5 --oneline --decorate` begins at `d6d8fa5 (HEAD -> main, origin/main) fix: recover provider permission state and rescan open pages`; `git rev-parse HEAD` is `d6d8fa5c5eec0e92b07ce19a5bca031e1706accc`.
- No files have been staged or committed. Verify the real Git status/log before handing back. This working tree includes earlier uncommitted popup/provider/display work as well as this selector stage.

## Results and player archive route coverage

Status: route-limited title/filter candidates and regression coverage are implemented in the working tree; the installed-extension rendering is unverified.

- Normal Chrome displayed the `/results` heading and its static filter labels. The `/players` route normalized to `/players/archive/active` and displayed the `Counter-Strike Players` page heading and player directory. Opening `/stats` displayed Cloudflare's security-verification screen; that route remains `Unable to confirm` and uncovered.
- Added a route-aware selector gate used by both candidate collection and strategy resolution. The page-title H1 candidate is limited to `/results` and `/players/archive`; results filter candidates `.header-filters-title` and `.filter-headline` are limited to `/results`. The captured stylesheet contains those filter class names, but their exact binding to the live results controls is `Unable to confirm`. The profile route `/player/123/spirit`, `/results-old`, player names, scores, and ranking values are covered by exclusion regressions.
- The page title strings and visible result filter labels are browser evidence, not raw HTML. A `view-source:` attempt was rejected by browser policy; no alternative source-inspection method was used. The selector effect has not been checked with the extension installed, so no visual success claim is made.
- TDD showed the new content case unchanged before implementation and the missing path helper before export. After implementation, `node --test tests/display.test.ts tests/content.test.ts` passed 42/42. Full verification passed: `pnpm.cmd test` (120 passed, 0 failed, 0 skipped); `pnpm.cmd typecheck`; `pnpm.cmd build`; `node --test tests/translate-dependencies.test.ts` (1 passed); and `git diff --check` (exit 0, line-ending notices only).
- Build audit passed: `dist/background.js`, `dist/content.js`, `dist/manifest.json`, and `dist/glossary.json` exist. Both background declarations point to `background.js`; no `background.type` is set; permissions remain `storage`; and background/content bundles are IIFEs with no bare import/export statements. The new selector is in `dist/content.js`.
- Repository state: `git status --short --branch` reports `## main...origin/main` with the existing popup/provider/display changes unstaged and uncommitted. `git log -5 --oneline --decorate` begins at `d6d8fa5 (HEAD -> main, origin/main) fix: recover provider permission state and rescan open pages`; `git rev-parse HEAD` and `git ls-remote origin refs/heads/main` both return `d6d8fa5c5eec0e92b07ce19a5bca031e1706accc`. No commit or push was made.

## Fantasy overview and Live controls

Status: narrow route-specific heading/control candidates are implemented in the working tree. Rendering with the extension installed remains unverified.

- Normal Chrome rendered `/fantasy` and `/live`. Fantasy showed overview headings, a leaderboard, and dynamic user/game/point data. Live showed a Fullscreen button and Theater link plus team/event/live-score data.
- Added `h1`/`h2` candidates only for the exact `/fantasy` path and candidates for the Fullscreen button and `a[href*="fullscreen=1"]` Theater link only for the exact `/live` path. Individual Fantasy game routes and Live child routes are excluded. Usernames, team/event names, ranking/leaderboard values, and live scores remain untouched by these candidates.
- The accessibility tree provided heading/button/link roles but no raw markup. Fantasy element-tag bindings and the exact Live control DOM selectors are **Unable to confirm**; these candidates have not been exercised with the extension installed. `/major` and `/forums` were opened for route audit; their content mixes names, dynamic data, and long prose without a verified safe selector, so no page-specific selectors were added. `/stats` remains behind Cloudflare security verification.
- TDD RED: `node --test tests/display.test.ts tests/content.test.ts` failed on missing Fantasy/Live selectors, strategies, and content behavior. GREEN: the same command passed 44/44, including negative route checks and assertions that leaderboard values/live scores remain unchanged. Full verification passed: `pnpm.cmd test` (122 passed, 0 failed, 0 skipped); `pnpm.cmd typecheck`; `pnpm.cmd build`; `node --test tests/translate-dependencies.test.ts` (1 passed); and `git diff --check` (exit 0, line-ending notices only).
- Build audit passed: all four required distribution files exist; both background manifest declarations point to `background.js`; `background.type` is absent; permissions are only `storage`; background/content outputs are IIFEs without bare imports/exports; and the results/Fantasy/Live selectors are present in `dist/content.js`.
- `docs/findings.md`, `docs/display-strategy.md`, `docs/display-layer.md`, `README.md`, and this progress record now describe the observed routes and evidence boundaries. No files were staged or committed. The earlier `d6d8fa5` HEAD remains the starting point; verify the actual Git state before handoff.

## Browser-visible route follow-up

Status: narrow event/ranking selectors and regression coverage are implemented; route-wide coverage remains incomplete.

- The earlier sequential `curl.exe` attempts to `/events`, `/results`, and `/ranking/teams` returned 403 Cloudflare challenges. A later read-only visit through normal Chrome rendered all three pages; no challenge was solved or bypassed.
- The `/events` accessibility tree showed `Ongoing events` and `Upcoming events`. The implementation adds Mode A selectors for `.event-status-headline` and `.event-status-upcoming-headline`, based on those visible labels and the corresponding class names in the saved shared stylesheet. The exact live-DOM class binding remains **Unable to confirm**; extension rendering on that route has not been tested.
- The `/ranking/teams` route normalized to `/ranking/teams/2026/september/21`. Its accessibility tree exposed a `ranking-open-region-selector` container with the label `Regional rankings`. That label now uses an in-place Mode A selector. Team names, player nicknames, point totals, positions, and movement values remain outside all translation selectors.
- The `/results` page and its visible title/filter labels were confirmed, but this view did not expose a safe stable selector for them. Its page-specific title and filter coverage remain **Unable to confirm**; shared navigation, sidebar, and footer selectors still apply.
- A normal browser `view-source:` navigation was attempted to inspect markup and was rejected by the browser URL policy. It was not retried through another path. No HTML was added under `raw-capture/` from these browser views; the earlier challenge captures remain ignored and were not used as evidence.
- TDD RED: `node --test tests/display.test.ts tests/content.test.ts` failed on the missing strategy contexts, selector definitions, strategy policies, and unchanged content labels. GREEN: the same command passed all 40 tests after the data-driven selectors and Mode A strategies were added. The test also confirms ranking names, points, and player nicknames remain unchanged.
- Updated `docs/findings.md`, `docs/display-strategy.md`, `docs/display-layer.md`, `README.md`, and the current-progress entry in `AGENTS.md` to distinguish visible browser evidence from unavailable raw markup and to keep the `/results` limitation explicit.
- Final verification passed: `pnpm.cmd test` (118 passed, 0 failed, 0 skipped); `pnpm.cmd typecheck`; `pnpm.cmd build`; `node --test tests/translate-dependencies.test.ts` (1 passed); and `git diff --check` (exit 0, with Git line-ending notices only).
- Build audit passed: all four required `dist/` files exist; `background.scripts` and `background.service_worker` both point to `background.js`; no `background.type` is declared; permissions remain `storage`; and `dist/background.js`/`dist/content.js` contain no bare import/export statements. Options and popup assets also build.
- Repository verification: `git status --short --branch` reports `## main...origin/main` with all ongoing project changes unstaged and uncommitted; `git log -5 --oneline --decorate` begins with `d6d8fa5 (HEAD -> main, origin/main) fix: recover provider permission state and rescan open pages`; `git rev-parse HEAD` and `git ls-remote origin refs/heads/main` both return `d6d8fa5c5eec0e92b07ce19a5bca031e1706accc`. No commit or push was made.

## Player and team profile audit

Status: rendered-page wording and data boundaries are recorded; profile-body selector mapping is **Unable to confirm**, so no page-specific profile selector was added.

- Normal Chrome accessibility views confirmed static tab labels and section text on `/player/8528/hobbit` and `/team/12467/parivision`. The observed labels and route evidence are recorded in `docs/findings.md`.
- These profiles also mix names and IDs with dynamic statistics, rankings, roster data, prices, match scores, and team-specific FAQ text. The accessibility view does not expose CSS classes or exact tag bindings. Because this project does not permit automated Playwright scraping of HLTV and the browser rejected `view-source:`, no alternative source/DOM inspection was attempted.
- Shared navigation, sidebar, and footer selectors still apply. Profile-body coverage remains absent until stable selector evidence is available. Player/team names and numeric values remain unmodified.
- No code or tests changed in this audit. `README.md`, `docs/display-strategy.md`, this file, and `AGENTS.md` now record the evidence boundary and the uncovered route bodies. No files were staged or committed.

## Local install bundle

Status: a locally loadable Chrome/Edge extension ZIP was generated and audited; installed-browser visual verification remains unverified.

- Fresh verification passed: `pnpm.cmd test` (122 passed, 0 failed, 0 skipped), `pnpm.cmd typecheck`, and `pnpm.cmd build` (background, content, options, and popup).
- Build audit confirmed `dist/background.js`, `dist/content.js`, `dist/manifest.json`, and `dist/glossary.json`; both background declarations point to `background.js`; required permissions are only `storage`; and background/content bundles contain no bare imports or exports.
- The ZIP has `manifest.json` at its root with popup/options assets, glossary, and `INSTALL.txt`; its archive listing was checked. Artifact: `C:\Users\Chester\.codex\visualizations\2026\09\26\01a0dd51-5db4-7f20-a70c-554f1b522dca\cs2-hltv-chinese-reader-0.0.1.zip`. Generated `dist/` remains ignored by Git; the ZIP is outside the repository.
- `README.md` now includes Chrome/Edge local installation and provider setup steps. The user must select a provider and provide its API key before provider-backed translations can run.
- No files have been staged or committed. Profile bodies, `/major`, general forums, `/stats`, the `/results` filter binding, and installed-browser visual behavior remain the recorded coverage boundaries.

## Offline glossary UI labels and event-name isolation

Status: implemented, regression-checked, built, and packaged for local Chrome/Edge installation.

- Added confirmed static HLTV interface wording to the sole production glossary. Covered labels now translate locally without making a provider request; dynamic player/team identities, match values, scores, and times remain outside this change.
- Translation matching supports excluded glossary categories. For `event-name`, direct glossary substitution and required-target validation exclude `category: "ui"`; season, stage, and event terminology still participates. This prevents a UI word such as `Ranked` in a tournament title from forcing the page-label translation `有排名` while keeping the `Fall` → `秋季` requirement.
- TDD RED reproduced both regressions: event-name validation rejected a correct title for missing `有排名`, and the event-name service returned `有排名` instead of reaching the provider. GREEN: the three focused production-glossary tests passed, including a check that season terminology remains required.
- Final verification after the implementation: `pnpm.cmd test` passed 125/125 with 0 failures and 0 skipped; `pnpm.cmd typecheck` passed; `pnpm.cmd build` passed for background, content, options, and popup; `node --test tests/translate-dependencies.test.ts` passed 1/1; and `git diff --check` passed with only the repository's LF/CRLF notices.
- Build audit confirmed the four required `dist/` files, all manifest-referenced assets, matching `background.scripts` and `background.service_worker`, no `background.type`, only the `storage` required permission, IIFE wrappers for background/content, current glossary bytes, and CommonJS syntax checks for both bundles (which reject static bare import/export declarations).
- Regenerated install artifact: `C:\Users\Chester\.codex\visualizations\2026\09\26\01a0dd51-5db4-7f20-a70c-554f1b522dca\cs2-hltv-chinese-reader-0.0.1-ui-glossary.zip`. Archive inspection confirmed a root-level manifest, installation guide, glossary, background/content files, and all options/popup assets.
- README and this file describe offline fixed-label behavior. Remaining coverage boundaries are unchanged: selector bindings for some visually observed pages, player/team profile bodies, `/major`, forums, `/stats`, and installed-browser behavior remain as previously recorded. Non-glossary page text still needs a user-configured compatible provider and API key.
- All changes remain unstaged and uncommitted. The repository's `HEAD` and remote have not been advanced.

## Screenshot follow-up — keep offline labels and extend article-page chrome

Status: the version `0.0.2` package and refreshed unpacked folder are ready. Source/build verification passed; Chrome reload and installed-page rendering remain **Unable to confirm**.

- The supplied article screenshot showed untranslated primary navigation, article title/body, and several sidebar labels. The article title `.newsitem.standard-box > h1.headline` and article prose `.newsdsl .newstext-con` are already in the approved selector set. Arbitrary titles and prose are provider-backed and cannot be translated without the user's own API key, a granted provider origin, and a working network connection.
- A regression test exposed a second background bug: with provider permission present but the provider failing, the handler returned the entire batch as original, discarding locally available glossary labels. The new RED/GREEN case verifies that `News` stays `新闻`, only uncovered strings reach the provider, and an unavailable provider leaves only those strings original.
- Added evidenced static selectors and glossary entries for the top-bar `Sign in`, the Player of the week category/metric, the `MINIGAME` heading and `Play` action, `Complete ranking`, and `Event calendar`. A nested `never` strategy preserves the ranking update label/date. Player names, percentages, `KAST`, team/event names, and the `Timeline` game name remain unchanged; `NEW` remains a CSS badge. Source evidence is the existing local article capture and the user screenshot; no new HLTV request was made.
- The popup and options page now state the offline-glossary/provider distinction. The `Search...` input placeholder is still outside the current text-node renderer; no input attribute was read or rewritten. Sidebar UGC titles and unconfirmed route templates are not covered.
- Fresh final verification: `pnpm.cmd test` passed 129/129 (0 failed, 0 skipped); `pnpm.cmd typecheck` passed; `pnpm.cmd build` passed for background/content/options/popup; `node --test tests/translate-dependencies.test.ts` passed 1/1; `git diff --check` exited 0 (only Git LF/CRLF notices). A concurrent first attempt hit `ERR_PNPM_WORKSPACE_STATE_WRITE_IO` because pnpm tasks shared workspace state; the serial full test rerun passed.
- Distribution audit passed: required `dist/background.js`, `dist/content.js`, `dist/manifest.json`, and `dist/glossary.json` exist; manifest version is `0.0.2`; both background declarations point to `background.js`; `background.type` is absent; required permissions remain only `storage`; all referenced assets exist; background/content outputs begin as IIFEs, parse successfully, and contain no bare import/export declarations.
- Package: `C:\Users\Chester\Downloads\CS2-HLTV-Chinese-Reader-0.0.2-article-coverage.zip`. Refreshed the existing unpacked folder at `C:\Users\Chester\Downloads\CS2-HLTV-Chinese-Reader-0.0.1-ui-glossary` so the path stays stable for an existing Chrome unpacked install; its manifest now reports version `0.0.2`. The ZIP root listing was checked for manifest, background/content bundles, and glossary.
- The Computer Use inventory showed Chrome open but no HLTV tab. Opening `chrome://extensions` was explicitly denied by Browser Use URL security policy (only HTTP(S) pages are permitted). No bypass, alternate internal URL, CDP, or extension-management workaround was attempted. Therefore no reload/install action or visual browser verification is claimed; the user must open Chrome's extensions manager, click **Reload** on the unpacked extension if already loaded, then refresh the HLTV page.
- No files were staged or committed. Verify real Git status/log before handoff.

## Screenshot follow-up — offline labels blocked by provider permission

Status: the permission-gate bug is fixed and repackaged; the new build has not yet been reloaded or visually verified in Chrome.

- The user-provided article-page screenshot showed the navigation, sidebar labels, article headline, and prose all still in English. This established the visible failure but did not show whether the extension was installed, enabled, or configured.
- Root cause found in `createBackgroundMessageHandler`: it returned an error before the core runner whenever the configured provider origin lacked permission. That blocked even glossary-covered labels, despite the core being able to translate them without a provider. Regression test RED reproduced the original-text fallback; GREEN verifies a mixed batch returns offline `News`/`Matches` labels in Chinese, leaves provider-dependent text unchanged, and makes zero provider calls.
- The core now exports its pure glossary-coverage mapping, the background runner exposes it for preflight, and the handler preserves glossary translations when provider permission is missing. Uncovered values remain original until provider settings and permission are available.
- Full verification passed after the fix: `pnpm.cmd test` (126 passed, 0 failed, 0 skipped), `pnpm.cmd typecheck`, `pnpm.cmd build`, `node --test tests/translate-dependencies.test.ts` (1 passed), and `git diff --check` (exit 0; Git emitted only LF/CRLF notices).
- Built a refreshed archive at `C:\Users\Chester\.codex\visualizations\2026\09\26\01a0dd51-5db4-7f20-a70c-554f1b522dca\cs2-hltv-chinese-reader-0.0.1-offline-label-fix.zip`, copied it to `C:\Users\Chester\Downloads\CS2-HLTV-Chinese-Reader-0.0.1-offline-label-fix.zip`, and refreshed the existing extracted folder `C:\Users\Chester\Downloads\CS2-HLTV-Chinese-Reader-0.0.1-ui-glossary` with the updated build.
- Installed-browser state is **Unable to confirm**: the Computer Use helper stopped before any browser operation because it could not determine the current Chrome URL confidently. The user still needs to reload the unpacked extension in `chrome://extensions` if that folder is already loaded, then refresh the HLTV article. Article headline/body translation still needs a configured provider and granted origin; a no-key build cannot translate arbitrary prose.
- No files were staged or committed.

## 0.0.3 — statistics interface and readable-page coverage (2026-09-30)

Status: source implemented, verified, built, and copied to the existing Downloads folder. Chrome reload and installed-page rendering remain **Unable to confirm**. This section supersedes the earlier `/stats`, profile-body, placeholder, badge, and comment-mode coverage notes.

- The newest user screenshot establishes a working partial extension: shared sidebar labels are Chinese while the statistics body is English. The user confirms their provider is configured and its connection test succeeds. Missing strategy coverage is the demonstrated cause for the statistics labels; missing provider setup is not assumed.
- Added 58 screenshot-backed statistics label/value samples, including filters, navigation, ratings/metrics, quality labels, player profile action, age/map/round units, side/round toggles, and performance categories. Local `ui-stats` admission is scoped to `/stats`. A numeric `years` suffix can be translated while preserving the preceding player identity. Scoped terminology is excluded from general prose/event-name glossary shortcuts and validation.
- A centralized `body` candidate matches shared fixed UI wording and separately admits known public-route prose with at least four Latin words and the existing prose classifier. The player/team profile routes also admit the `ui-profile` labels observed in the prior visual audit. No page class names are guessed from screenshots. Short identities and unknown short labels stay original; this is not evidence of exhaustive all-page translation.
- Added the captured `.activitylist` topic-span selector, excluding adjacent comment counts. The captured `.forum .post .forum-middle` template now replaces eligible comments in Chinese mode and retains bilingual rendering in Mode B. Conservative comment-language classification remains unchanged.
- Known input placeholders now use local glossary translations. Originals are registered in an in-memory display record table; typed input values are never read or modified. The captured CSS `New` badge gets a removable glossary-derived overlay. Disabled/bilingual modes restore recorded hints and remove the overlay. SVG text and statistics tooltip labels stay eligible; actual article-linked entities retain their scoped protection.
- Root admission protects scripts/styles/templates, editable fields, forum/activity containers, dynamic time/countdown/score policies, and `data-livescore-*`/`data-live-odds-*` fields. Nested candidates retain ownership. Page writes invalidate root records without restoring an obsolete original over the new page text.
- Local labels render before provider work. Large page groups are split at 20 items or 6,000 input characters and rendered as each batch completes. One oversized record is kept intact. Core per-call batching and public provider/service interfaces stay unchanged. Increased production deadlines from the former five-second background cutoff to provider/background/content values of 25/30/35 seconds. No real page latency or cache hit rate is claimed measured.
- Evidence request: one `curl.exe` fetch of `/stats/players/3741/niko` returned HTTP 403 and 5,429 bytes, saved under ignored `raw-capture/stats-player.html`. It does not establish statistics markup. Exact live bindings, viewport fit, and installed rendering are **Unable to confirm**. Browser Use previously rejected `chrome://extensions`; no internal-URL, native, CDP, profile, or extension-management bypass was attempted.
- TDD RED reproduced untranslated screenshot labels, missing provider routing for prose/activity/comments, stale page-written labels, absent placeholders, identity age units, profile labels, tooltip over-protection, provider-delayed fixed UI, unbounded batches, the old timeout values, and live-score attribute leakage. GREEN checks passed after each implementation. Reverse validation deliberately removed script protection and enlarged the character bound; the relevant assertions failed, then passed after both violations were removed.
- Fresh final checks: `pnpm.cmd test` passed **144/144**, 0 failed/0 skipped; `pnpm.cmd typecheck` passed; `pnpm.cmd build` passed all four bundles; `node --test tests/translate-dependencies.test.ts` passed 1/1; `git diff --check` passed with only LF/CRLF notices. Saved test output: ignored `raw-capture/verify-0.0.3.log`.
- Distribution audit passed: version `0.0.3`; four required `dist/` files and manifest-referenced assets exist; background declarations point to one file; `background.type` is absent; required permission remains only `storage`; background/content are IIFEs and parse as scripts without bare import/export; copied glossary bytes equal the root asset. No dependency or required permission was added. Content uses a built JSON asset via `resolveJsonModule`.
- New archive: `C:\Users\Chester\Downloads\CS2-HLTV-Chinese-Reader-0.0.3-full-page.zip` (**52,965 bytes**). ZIP root listing includes background/content, manifest/glossary, installation guide, and popup/options assets. The existing `C:\Users\Chester\Downloads\CS2-HLTV-Chinese-Reader-0.0.1-ui-glossary` folder was refreshed and reports manifest version `0.0.3`; keeping its path preserves the unpacked extension identity. The user needs to click Reload in Chrome's extension manager and refresh HLTV; their existing provider settings should remain attached to the same extension identity.
- Real Git evidence remains unchanged: HEAD `d6d8fa5c5eec0e92b07ce19a5bca031e1706accc`, and `git ls-remote origin refs/heads/main` returned that exact hash. `git log -3 --oneline` shows `d6d8fa5 fix: recover provider permission state and rescan open pages`, `d3b42af feat: add configurable provider and contextual translation`, and `a563a70 feat: add background translation integration`. All current implementation/documentation changes remain unstaged and uncommitted; no commit/push claim is made.

## 0.0.4 — lower statistics table and accessible interface coverage (2026-09-30)

Status: implemented, reviewed, verified, packaged and copied to the stable Downloads installation folder. Actual rendering after reloading this final build is **Unable to confirm**. Manual reload confirmation has been requested; no browser-management bypass was attempted.

- The latest screenshot demonstrates 16 missing statistics labels, while `Rating 3.0` is Chinese. Those labels were absent from the glossary. Most did not pass the four-word prose fallback; one longer label could reach the provider, so its screenshot failure is not reduced to that gate. Provider configuration was already confirmed by the user.
- Normal Chrome accessibility inspection of the existing `https://www.hltv.org/stats/players/21167/donk?csVersion=CS2` tab confirmed partial Chinese rendering and exposed additional fixed English wording. Added 69 glossary entries and 70 literal source/target test pairs across table labels, filter options, opponent summaries, teammate/form headings, average and economy-adjust hints, compound control fragments, four observed help explanations, transfer/streaming/privacy wording and the minigame title. Player/team/map identities, numeric values and unknown short strings remain protected.
- Standard `title` and `aria-label` targets on `/stats` now admit only shared/statistics glossary wording. Path, categories and subtree protection are centralized data. Attribute originals stay in the memory record table, page-written replacements invalidate old records, and disabled/bilingual modes restore only extension-owned translations. The observer watches the configured attribute names. The input-placeholder exception remains intentional; typed values are not inspected by this adapter.
- The normal accessibility view confirms help wording, including the one-second save definitions. It does not confirm which DOM attribute supplies each help description; exact attribute bindings, layout and exhaustive all-page rendering remain **Unable to confirm**. No statistics class selector was inferred and no prose threshold was lowered. Image lettering and unobserved UI remain limitations.
- Read-only code review found that the new attributes initially bypassed live/editable subtree protection, plus an observer-configuration test gap. Both were fixed. Targets and ancestors now use the centralized protection helper; a newly protected target restores the memory original if it still contains the extension's translation. Regression coverage includes scores, forum ancestors, live-score attributes, editable content, timestamps, countdowns, textbox roles and actual observer options. Follow-up review reports both findings resolved and no further blocker in the reviewed subset.
- TDD RED reproduced all table omissions, split controls and absent attribute translations; GREEN passed after implementation. Reverse validation deliberately omitted Statistics, Sides and Timeline, disabled attribute observation and title rescan handling, bypassed subtree protection, and removed restoration for newly protected targets. Each corresponding check failed; all deliberate violations were removed and the checks passed again.
- Fresh final checks: `pnpm.cmd test` **150/150**, 0 failed/0 skipped; `pnpm.cmd typecheck` passed; `pnpm.cmd build` passed all four modes; `node --test --test-isolation=none tests/translate-dependencies.test.ts` passed 1/1; `git diff --check` passes with only LF/CRLF notices. Test log: ignored `raw-capture/verify-0.0.4.log`. Initial sandboxed Node test child spawn failed with EPERM; focused checks used Node's same-process isolation setting, and the full package command ran successfully with approved sandbox escalation. No assertion or dependency check was weakened.
- Final distribution audit: four required files and all manifest references exist; both background declarations point to `background.js`; no background module type; required permission remains `storage`; background/content single-file IIFEs parse with `vm.Script`, which rejects bare module declarations; glossary bytes exactly match the root asset. No dependency or permission was added.
- Final ZIP: `C:\Users\Chester\Downloads\CS2-HLTV-Chinese-Reader-0.0.4-statistics.zip`, **55,774 bytes**, 11 root-level files including installation guide and all options/popup assets. The stable folder `C:\Users\Chester\Downloads\CS2-HLTV-Chinese-Reader-0.0.1-ui-glossary` now contains the final 0.0.4 manifest and bundles; all 11 copied files match their source SHA-256 hashes. The folder name stays unchanged to retain extension identity/settings.
- Real Git state checked: `git rev-parse HEAD` remains `d6d8fa5c5eec0e92b07ce19a5bca031e1706accc`; `git log -3 --oneline` shows `d6d8fa5 fix: recover provider permission state and rescan open pages`, `d3b42af feat: add configurable provider and contextual translation`, `a563a70 feat: add background translation integration`. `git status --short --branch` shows the inherited and new working-tree changes on `main...origin/main`. No staging, commit or push was performed; no new remote verification claim is made.

## 0.0.5 — fixes from the reloaded statistics-page audit (2026-09-30)

Status: source, tests, build, review and package checks complete; the stable installation folder now contains 0.0.5. Its live rendering awaits reload. The broader Chinese-site goal remains incomplete: the Canvas graph still draws English months and its proposed replacement contract awaits the owner's choice. Do not silently treat elapsed time as approval.

- The owner confirmed reloading 0.0.4 and refreshing HLTV. Normal rendered UI and screenshot inspection now verify all 16 screenshot table labels, statistical filters, metric/quality labels, opponent summaries, teammate/form labels and shared streaming labels are Chinese, with the original values. Screenshot: `C:\Users\Chester\.codex\visualizations\2026\09\26\01a0dd51-5db4-7f20-a70c-554f1b522dca\hltv-statistics-live-0.0.4.png`. This confirms that particular installed page; it does not prove every route or all text is Chinese.
- Live audit revealed remaining date/context placeholders, transfer statuses and hover descriptions. Added the three hints, BENCH/No team statuses and the exact search help; the transfer heading now uses Chinese wording throughout. Current follow-up additions total 75 entries relative to the start of the lower-table work, with 77 observed source/target pairs. Official player/team/map identifiers stay original.
- Focused read-only inspection of the already open, UI-grounded damage row establishes its parent standard `title` binding and BODY `data-livescore-server-url`. No page fetch, source scraping navigation, script execution or extension-manager access was used. The prefix guard wrongly treated that BODY connection configuration as a writer and blocked all attribute descendants. The centralized exception now requires both exact attribute name and BODY; the same attribute on a span, real writer flags and editable ancestors remain protected. Positive/negative regressions and follow-up read-only review confirm this narrow boundary.
- TDD reproduced the blocked real title and missing hinted wording. Reverse validation moved the metadata exception to SPAN: the BODY-positive and SPAN-negative tests both failed; restoration passed. Deliberate Start date/transfer-status omissions also failed the relevant tests, then were removed. Existing numeric, identity, original-memory, live-data and unknown-element protections remain asserted.
- Final `pnpm.cmd test`: **152 passed**, 0 failed/0 skipped; `pnpm.cmd typecheck` passed; `pnpm.cmd build` passed all four modes; core dependency check passed 1/1; `git diff --check` passes with LF/CRLF notices only. Ignored log: `raw-capture/verify-0.0.5.log`. Final bundle audit confirms the four required files, references, matching background outputs, storage-only required permission, no background module type, single IIFEs parsed as scripts and exact glossary bytes. No dependency or permission added.
- ZIP: `C:\Users\Chester\Downloads\CS2-HLTV-Chinese-Reader-0.0.5-live-fixes.zip`, **56,157 bytes**, 11 root files. The existing `C:\Users\Chester\Downloads\CS2-HLTV-Chinese-Reader-0.0.1-ui-glossary` folder was refreshed; version 0.0.5 and all 11 SHA-256 matches were verified. Browser tools still cannot access the extension manager; the owner must reload the extension for these latest files to run.
- Canvas work: normal screenshot shows English month ticks. Its observed graph parent exposes `data-chartjs-config` containing date labels and numeric points. Per AGENTS interface confirmation, the pending choice proposes an accessible Chinese SVG using identical validated data, preserving the original canvas and restoring it on disabled/bilingual mode. No SVG renderer or page-world bridge was implemented. Unsupported configurations must retain the native graph; numeric values must never be changed. Month/year semantics, selectors and restoration need tests before implementation. Primary binding record: ignored `raw-capture/stats-live-bindings-2026-09-30.json`.
- Git state is still unstaged/uncommitted at HEAD `d6d8fa5c5eec0e92b07ce19a5bca031e1706accc`; current `git log -3 --oneline` confirms the same three real commits recorded above. No staging, commit, push or new remote-success claim.

## 0.0.6 — navigation dropdown follow-up (2026-09-30)

Status: source, regression checks, independent review, build and packaging complete; original installed folder updated. Installed rendering is **Unable to confirm** pending owner reload and a working browser connection.

- Root cause: primary navigation selected `a.nav-link`, while all dropdown anchors use `a.dropdown-link`; short submenu phrases lacked complete glossary coverage and did not qualify for the four-word body prose fallback. Six local Gate 3 captures corroborate the shell. Focused read-only normal Chrome inspection confirms 36 current fixed links, one dynamic Fantasy title, separate New badges, Player explorer, Betting Canada, and the archive alphabet All anchor. No automated fetch was made.
- Added 32 scoped `ui-navigation` entries and two centralized fixed-local strategies. All seven groups are covered: Events, Players, Stats, Fantasy, Forum, Media and Betting. Player awards, annual ranking and prospect labels now use explanatory Chinese. `/players/archive` All translates to 全部 while alphabet/digit controls remain original. General/provider terminology enforcement excludes this category.
- Dynamic `/events/` and `/fantasy/` detail links are excluded from the fixed-menu selector, with an explicit `/events/archive` exception. Their prior body/event-name policy remains in place. Text-node replacement preserves anchor destinations and badge identities; disabled/bilingual modes restore the in-memory originals. No interface, provider, permission or dependency was added.
- Regression RED: three content/glossary checks and two display checks failed for the missing labels/strategies. GREEN: all five pass. Reverse validation deliberately removed `ui-navigation` exclusions; the glossary leakage check failed with 退役选手 instead of undefined. Original bytes were restored, all five checks passed, and the dependency check passed 1/1. Reverse output is in ignored `raw-capture/navigation-reverse-0.0.6.log`.
- Fresh full verification: `pnpm.cmd test` passed 156/156, 0 failed, 0 skipped; `pnpm.cmd typecheck` passed; `pnpm.cmd build` passed all four bundles. Final distribution audit passed: required four files, manifest 0.0.6, matching background declarations, no module type, storage-only required permission, exact glossary bytes, referenced assets present, background/content single-file IIFEs parsing as scripts with no bare import/export declarations. Independent scoped review reported no actionable findings and noted fake DOM checks do not execute CSS matching.
- Package `C:\Users\Chester\Downloads\CS2-HLTV-Chinese-Reader-0.0.6-navigation-menus.zip` is 57,373 bytes, with 11 root files including INSTALL.txt. All 11 files copied into `C:\Users\Chester\Downloads\CS2-HLTV-Chinese-Reader-0.0.1-ui-glossary` match dist SHA256 hashes; its manifest reports 0.0.6. The duplicate archive is in the task visualization output directory.
- Browser verification: pre-edit current DOM was inspected. A subsequent selector-audit attempt lost the handle; fresh inventory/re-binding returned `Debugger unattached`. Reload and post-update menu rendering/click behavior remain **Unable to confirm**. The owner was asked to reload the existing extension and refresh HLTV. `chrome://extensions` remains prohibited by Browser Use; no workaround was used. Whole-site completion and the pending Canvas graph are not claimed.
- Real Git state: HEAD remains `d6d8fa5c5eec0e92b07ce19a5bca031e1706accc` on main; `git log -3 --oneline` shows d6d8fa5, d3b42af, a563a70. The inherited working tree remains dirty. No files staged, committed or pushed. Final whitespace check is recorded below after execution.
- Final `git diff --check` exited 0; only Git LF/CRLF notices. No source or build changes after the successful verification.

## 0.0.6 — read-only remaining-problems audit (2026-10-08)

Status: review complete; no functional remediation, glossary edit, installation update, staging, commit or push. Full findings and reproduction boundaries are in `docs/review-2026-10-08.md`.

- Normal Chrome current Spirit–M80 match page shows Chinese navigation/prose alongside English status, map veto, replay, data controls/table help and event widgets. A player-directory visit confirms all current fixed menu labels and the All filter are Chinese; variable tournament titles remain partially English. A Unicode-name admission defect is also observed/reproduced. Returned the user's tab to its original match page.
- Confirmed via source and local mocks: repeated protected fragments reject valid translations; whitespace translations can hide text and persist; actual FNV collisions reuse another source translation; changing model can hit old persistent cache; response-body parsing escapes provider timeout; concurrent background messages lack shared in-flight dedup; stale Options overwrite popup changes; permission-only recovery does not rescan; connection test and provider deadlines differ; page writes retain stale bilingual translations. The report distinguishes coverage gaps, these defects, comment-contract drift and unverified browser behavior. The alleged post-disable billing issue was rejected after checking the real disabled-settings gate.
- Fresh `pnpm.cmd test`: 156 passed, 0 failed/0 skipped. Typecheck and all four build modes pass; core dependency check 1/1. Distribution audit passes required files, asset references, matching background outputs, storage-only required permission, exact glossary, script parsing and single-file IIFEs. Ten generated loadable files equal the original installed folder byte-for-byte; INSTALL.txt was not regenerated or modified. No real provider connection test was sent.
- Evidence: ignored `raw-capture/audit-2026-10-08-test.log`, `raw-capture/audit-menus-2026-10-08.json`; screenshot `C:\Users\Chester\.codex\visualizations\2026\09\26\01a0dd51-5db4-7f20-a70c-554f1b522dca\hltv-audit-2026-10-08.png`. Browser tools never visited the extension manager or inspected credentials. No exhaustive-page, loaded-version, Edge, layout/click or measured-cache-hit claim.
- Real Git HEAD remains d6d8fa5c5eec0e92b07ce19a5bca031e1706accc; fresh `git log -3 --oneline` records d6d8fa5, d3b42af, a563a70. The inherited dirty source tree is preserved. This stage adds only review documentation and progress tracking to tracked/untracked authoring files.

## 0.0.7 — remaining-problems remediation (2026-10-08)

Status: source fixes, regression coverage, build, distribution audit, and package refresh are complete in the working tree. Browser reload and post-update rendering remain owner actions.

- Fixed the confirmed translation-service defects: repeated protected fragments now use sequential positions, blank provider output is rejected before rendering and caching, cache keys include the full source text and provider/model namespace, and background requests share in-flight work for the same configuration.
- Provider timeout now covers response-body parsing. The options connection test uses the same 25-second default deadline as the provider path. The transport interface still owns cancellation of an already-started request; the caller is bounded and returns a safe original-text fallback.
- Content runtime now detects page rewrites for every allowed strategy, rotates the record key so stale provider responses cannot apply, and classifies a full forum comment before translating any child text node. Unicode two-word identities with diacritics remain unchanged.
- Options saves preserve the latest popup enabled/mode values unless those controls were edited locally. Authorization and successful save write a storage revision signal; open content scripts rescan failed translations after permission recovery.
- Added `ui-match` glossary entries and enabled them in the page fixed-label strategy for match controls visible in the audit (`比赛结束`, `地图`, `回看`, `下载录像`, `比赛数据`, `详细数据`, `地图禁选`, `选图`, and related map/side labels). Match names, player/team identities, scores, dates, and live values remain protected by their existing strategies.
- New RED/GREEN tests cover body timeout, duplicate fragments, blank output, cache collisions/namespaces, runner deduplication/model changes, dynamic page writes, mixed comments, permission recovery, Unicode identities, and match-detail controls. Full `npm test` passes **168/168** with 0 failures and 0 skips; `npm run typecheck`, `npm run build`, and `node --test tests/translate-dependencies.test.ts` pass.
- Distribution audit confirms manifest version 0.0.7, matching `background.scripts`/`background.service_worker`, no background module type, `storage` only, required files, single-file IIFEs, and no bare import/export declarations. The refreshed install folder `C:\Users\Chester\Downloads\CS2-HLTV-Chinese-Reader-0.0.1-ui-glossary` has matching SHA-256 bytes for the ten generated loadable files. ZIP: `C:\Users\Chester\Downloads\CS2-HLTV-Chinese-Reader-0.0.7-remediation.zip` (13 root files).
- Chrome's extension manager remains blocked by Browser Use policy, so the owner must click **Reload** for the unpacked folder and refresh the open HLTV tab. No claim is made that every variable article, forum, image, or canvas string is translated.

## 0.0.8 — news bilingual headline policy (2026-10-08)

Status: source fixes, regression coverage, build, distribution audit, and package refresh are complete in the working tree. Chrome reload and post-update rendering remain owner actions.

- The news article headline strategy now supports both display modes. Mode A replaces the English `h1.headline`; Mode B keeps the original and appends the provider translation as a marked sibling. The article body was already allowed in both modes through `.newsdsl .newstext-con`.
- A regression test now exercises the captured article headline in both modes. The selector remains the evidence-backed `.newsitem.standard-box > h1.headline`; no broader route selector was inferred from the screenshot.
- Free-form article prose still depends on the configured provider, API key, optional host permission, and a live response. If those fail, the safe behavior remains the original English text; fixed glossary labels continue to translate offline.
- Verification: `npm test` passes **169/169**, `npm run typecheck`, `npm run build`, and `node --test tests/translate-dependencies.test.ts` pass. The required distribution files exist, manifest version is `0.0.8`, both background declarations point to `background.js`, permissions remain `storage`, and the background/content bundles contain no bare import/export declarations.
- The Downloads unpacked folder `C:\Users\Chester\Downloads\CS2-HLTV-Chinese-Reader-0.0.1-ui-glossary` was refreshed and its ten generated files match `dist/` SHA-256 hashes. ZIP: `C:\Users\Chester\Downloads\CS2-HLTV-Chinese-Reader-0.0.8-news-modes.zip`.

## 0.0.9 — extension logo (2026-10-08)

Status: logo asset, manifest integration, build, distribution audit, and package refresh are complete in the working tree. Chrome reload and post-update rendering remain owner actions.

- Added an original blue-and-white reading/esports mark generated for the extension. The source assets are `icons/icon-16.png`, `icons/icon-32.png`, `icons/icon-48.png`, and `icons/icon-128.png`; the root manifest declares the same sizes for the extension and toolbar action.
- Vite now copies all four icon files into `dist/icons` alongside the manifest and glossary, so unpacked Chrome/Edge installs and packaged archives use the custom logo instead of the default gray placeholder.
- Verification: `npm test` passes **169/169**, `npm run typecheck`, `npm run build`, and `node --test tests/translate-dependencies.test.ts` pass. Manifest version is `0.0.9`; both background declarations still point to `background.js`, permissions remain `storage`, and background/content bundles remain single-file IIFEs without bare import/export declarations.
- The refreshed unpacked folder `C:\Users\Chester\Downloads\CS2-HLTV-Chinese-Reader-0.0.1-ui-glossary` now contains all 14 generated files with SHA-256 bytes matching `dist/`. ZIP: `C:\Users\Chester\Downloads\CS2-HLTV-Chinese-Reader-0.0.9-logo.zip`; its root manifest and four icon files were checked. Browser Use still blocks `chrome://extensions`, so the owner must click **Reload** for the unpacked folder and refresh the open HLTV tab after the package is installed.
- Real Git state after the stage: `git log -3 --oneline` starts with `d6d8fa5 fix: recover provider permission state and rescan open pages`; `git status --short --branch` remains `## main...origin/main` with the inherited working-tree changes plus the new `icons/` assets; `git rev-parse HEAD` is `d6d8fa5c5eec0e92b07ce19a5bca031e1706accc`. No files were staged, committed, or pushed.

## 0.1.0 — selection context-menu translation (2026-10-08)

Status: feature implementation, regression coverage, build, distribution audit, and package refresh are complete in the working tree. Chrome reload and post-update rendering remain owner actions.

- Added the HLTV-scoped `翻译选中文本` context-menu item. The background forwards only the selected text to the already injected content script; the content script reuses the existing contextual translation service and shows a temporary Chinese result popover without changing the selected page text. Empty selections and non-HLTV pages are ignored.
- Added `src/shared/selection-translation.ts`, `src/background/context-menu.ts`, and `src/content/selection-translation.ts`. The required `contextMenus` permission is documented in `docs/background-integration.md` and limited to the `https://www.hltv.org/*` menu item; no new provider or data permission was added.
- Added two regression tests for message validation, menu registration, HLTV URL scope, empty selections, and tab forwarding. Verification: `npm test` passes **171/171**, `npm run typecheck`, `npm run build`, and `node --test tests/translate-dependencies.test.ts` pass. Manifest version is `0.1.0`; both background declarations still point to `background.js`, and background/content bundles remain single-file IIFEs without bare import/export declarations.
- The refreshed unpacked folder `C:\Users\Chester\Downloads\CS2-HLTV-Chinese-Reader-0.0.1-ui-glossary` contains all 14 generated files with SHA-256 bytes matching `dist/`. ZIP: `C:\Users\Chester\Downloads\CS2-HLTV-Chinese-Reader-0.1.0-context-menu.zip`; its manifest reports `storage, contextMenus` and version `0.1.0`. Browser Use still blocks `chrome://extensions`, so the owner must click **Reload** for the unpacked folder before using the new menu.
- Real Git state after the stage: `git log -3 --oneline` still starts with `d6d8fa5 fix: recover provider permission state and rescan open pages`; `git status --short --branch` remains `## main...origin/main` with the inherited working-tree changes plus the selection-menu and documentation files; `git rev-parse HEAD` remains `d6d8fa5c5eec0e92b07ce19a5bca031e1706accc`. No files were staged, committed, or pushed.

## 0.1.1 — selection menu grouping and failure diagnostics (2026-10-08)

Status: follow-up implementation, regression coverage, build, distribution audit, and package refresh are complete in the working tree. Chrome reload and post-update rendering remain owner actions.

- The right-click action is now grouped under a branded `HLTV 中文阅读器` parent menu with the child `翻译选中文本`. Browser-native copy/search/translation items remain controlled by the browser, while the extension action is visually separated in its own submenu.
- Selection translation now preserves the background failure code through the content bridge. The result popover distinguishes a disabled extension, unreadable settings, provider failure, timeout, and invalid response instead of always saying that no translation was found.
- The content translation adapter now exposes a detailed contextual result without changing the existing page-translation fallback or cache behavior. Selection requests use structured context so one-word selections such as `benched` reach the provider. Full `npm test` passes **173/173**, `npm run typecheck`, `npm run build`, and `node --test tests/translate-dependencies.test.ts` pass. Manifest version is `0.1.1`; required permissions remain `storage` and the documented HLTV-scoped `contextMenus` permission.
- The refreshed unpacked folder `C:\Users\Chester\Downloads\CS2-HLTV-Chinese-Reader-0.0.1-ui-glossary` contains all 14 generated files with SHA-256 bytes matching `dist/`. ZIP: `C:\Users\Chester\Downloads\CS2-HLTV-Chinese-Reader-0.1.1-context-menu-diagnostics.zip`; its manifest reports version `0.1.1` and permissions `storage, contextMenus`.
- Real Git state after the stage: `git log -3 --oneline` still starts with `d6d8fa5 fix: recover provider permission state and rescan open pages`; `git status --short --branch` remains `## main...origin/main` with the inherited working-tree changes plus the selection-menu and diagnostics files; `git rev-parse HEAD` remains `d6d8fa5c5eec0e92b07ce19a5bca031e1706accc`. No files were staged, committed, or pushed.

## 0.2.0 — automatic selection magnifier and dictionary lookup (2026-10-08)

Status: source implementation, regression coverage, build, distribution audit, and package refresh are complete in the working tree. Chrome reload and post-update rendering remain owner actions.

- Removed the browser context-menu integration and returned the required permission set to `storage` only. The content script now watches text selection and places a small magnifier beside the selected range, keeping the browser's native right-click menu unchanged.
- Clicking the magnifier sends the selected text through the existing background bridge with `structured` context and a dedicated `dictionary` purpose. The provider prompt requires short Simplified Chinese dictionary explanations and all applicable common parts of speech; the temporary popover labels provider, timeout, settings, and disabled states in Chinese.
- Dictionary purpose bypasses offline UI glossary replacement so short selections such as `Live` and `benched` still reach the provider. Added regression coverage for the request purpose and the glossary bypass. The content overlay keeps source text in memory and never reads DOM attributes to recover it.
- The automatic magnifier is intentionally a content overlay rather than a browser menu item, so no `contextMenus` permission or background tab forwarding is needed. The existing configured provider and origin permission remain required for dictionary results.
- Verification: `npm test` passes **172/172**, `npm run typecheck`, `npm run build`, and `node --test tests/translate-dependencies.test.ts` pass. The distribution audit confirms version `0.2.0`, matching background declarations, `storage` as the only required permission, required files, script parsing, single-file IIFEs, and no bare import/export declarations. `git diff --check` passes after removing the extra EOF blank line.
- The refreshed unpacked folder `C:\Users\Chester\Downloads\CS2-HLTV-Chinese-Reader-0.0.1-ui-glossary` contains the ten generated root files and four icon files with SHA-256 bytes matching `dist/`; its manifest reports version `0.2.0` and permission `storage`. ZIP: `C:\Users\Chester\Downloads\CS2-HLTV-Chinese-Reader-0.2.0-selection-magnifier.zip` (83,079 bytes). Chrome's extension manager remains blocked by Browser Use policy, so the owner must click **Reload** for the unpacked folder and refresh HLTV. No claim is made that every variable article, forum, image, or canvas string is translated.

## 0.2.1 — dictionary card and line magnifier (2026-10-08)

Status: source implementation, regression coverage, build, distribution audit, and package refresh are complete in the working tree. Chrome reload and post-update rendering remain owner actions.

- Replaced the emoji magnifier with a small line SVG that matches the lightweight icon treatment of the dictionary card and does not depend on platform emoji fonts.
- Redesigned the selection result as a compact vocabulary card: original word header, close/search controls, optional UK/US pronunciation rows, separate part-of-speech definitions, optional network meaning, and a muted more-definitions footer. Provider text that does not follow the structured labels remains visible as a general definition.
- Extended the dictionary prompt to request optional pronunciation and network-meaning labels in addition to all applicable common parts of speech. Added parser tests for pronunciation, definitions, network meaning, and unlabelled fallback text.
- Verification: `npm test` passes **174/174**, `npm run typecheck`, `npm run build`, and `node --test tests/translate-dependencies.test.ts` pass. The refreshed package is `C:\Users\Chester\Downloads\CS2-HLTV-Chinese-Reader-0.2.1-dictionary-card.zip` (84,700 bytes); Chrome's extension manager remains blocked by Browser Use policy, so the owner must reload the unpacked folder and refresh HLTV.

## 0.2.2 — editable lookup and verb base form (2026-10-08)

Status: source implementation, regression coverage, build, distribution audit, and package refresh are complete in the working tree. Chrome reload and post-update rendering remain owner actions.

- The dictionary card header is now an editable lookup input. Clicking the line search icon or pressing Enter queries the edited word or phrase again, so a user can remove an ending such as `ed` before searching.
- Dictionary results display a `动词原形` row when the provider supplies one. For regular English past forms, the content layer safely derives common forms such as `benched → bench` and `stopped → stop` when the provider omits the explicit base form; it does not infer identities or irregular verbs.
- The provider prompt now requests `动词原形：...` for inflected verbs. Parser and fallback regression tests cover base-form output and editable-lookup support. The visual card remains compact and anchored near the selected text.
- Verification: `npm test` passes **175/175**, `npm run typecheck`, `npm run build`, and `node --test tests/translate-dependencies.test.ts` pass. The refreshed package is `C:\Users\Chester\Downloads\CS2-HLTV-Chinese-Reader-0.2.2-editable-dictionary.zip` (85,421 bytes); Chrome's extension manager remains blocked by Browser Use policy, so the owner must reload the unpacked folder and refresh HLTV.

## 0.2.3 — Apple-inspired dictionary card (2026-10-08)

Status: source implementation, build, distribution audit, and package refresh are complete in the working tree. Chrome reload and post-update rendering remain owner actions.

- Removed the `更多释义` footer so the card ends after the actual dictionary content.
- Refined the selection card and magnifier with a restrained system-font stack, translucent white surface, 16px corner radius, neutral gray controls, subtle hover motion, light separators, and soft layered shadows. The card remains anchored near the selected text and keeps the editable lookup behavior and verb base-form row.
- Verification: `npm test` passes **175/175**, `npm run typecheck`, `npm run build`, and `node --test tests/translate-dependencies.test.ts` pass. The distribution audit confirms manifest version `0.2.3`, storage-only permission, required files, script parsing, and the absence of the removed footer label in the content bundle. ZIP: `C:\Users\Chester\Downloads\CS2-HLTV-Chinese-Reader-0.2.3-apple-card.zip` (85,620 bytes); Chrome's extension manager remains blocked by Browser Use policy, so the owner must reload the unpacked folder and refresh HLTV.

## 0.2.4 — resizable card and smaller magnifier (2026-10-08)

Status: source implementation, build, distribution audit, and package refresh are complete in the working tree. Chrome reload and post-update rendering remain owner actions.

- Added native CSS resizing to the dictionary card. Users can drag its lower-right corner; the card has readable minimum dimensions and viewport-bounded maximum dimensions, with scrolling for content that exceeds the chosen height.
- Reduced the floating magnifier from 34px to 28px and reduced its SVG stroke icon to 17px. Its position calculation now uses the smaller control bounds.
- Verification: `npm test` passes **175/175**, `npm run typecheck`, `npm run build`, and `node --test tests/translate-dependencies.test.ts` pass. The distribution audit confirms manifest version `0.2.4`, storage-only permission, required files, script parsing, and the resizable-card/smaller-magnifier markers. The final installation folder hashes match all 14 generated and icon files. ZIP: `C:\Users\Chester\Downloads\CS2-HLTV-Chinese-Reader-0.2.4-resizable-card.zip` (106,601 bytes); Chrome's extension manager remains blocked by Browser Use policy, so the owner must reload the unpacked folder and refresh HLTV.

## 0.3.0 — sentence lookup, Oxford-style dictionary, history, fallback, and appearance (2026-10-08)

Status: source implementation, regression coverage, build, distribution audit, and package refresh are complete in the working tree. Chrome reload and post-update rendering remain owner actions.

- Selection now classifies one English word as a dictionary lookup and longer selections as a sentence lookup. Both remain available when page translation is disabled; page display modes continue to control only page content.
- Dictionary output accepts Chinese meanings plus concise English explanations, retains verb base forms and UK/US IPA, and adds clickable UK/US browser pronunciation buttons.
- Dictionary lookups are recorded locally in `browser.storage.local`; the card can toggle favorites, and the toolbar popup opens a dedicated history page with all/favorites filters and cleanup actions.
- Added optional fallback provider fields. When the primary provider returns a failure, the background retries the same request through the configured fallback provider. Existing IndexedDB translation caching remains the first offline path.
- Added dictionary-card theme (`system`/`light`/`dark`) and font-scale controls directly to the card header. Changes apply immediately to the open card and persist for later lookups; the options page no longer owns those controls.
- Verification: `npm test` passes **183/183**, `npm run typecheck`, `npm run build`, and the final distribution audit pass. The audit confirms manifest version `0.3.0`, storage-only permission, required files, script parsing, sentence/dictionary purpose markers, Oxford-style definition parsing, fallback-provider retry, dedicated history page, card-level theme/font controls, and SHA-256 matches for all 17 generated and icon files. The fresh installation folder is `C:\Users\Chester\Downloads\CS2-HLTV-Chinese-Reader-0.3.0-history-card-controls`; ZIP: `C:\Users\Chester\Downloads\CS2-HLTV-Chinese-Reader-0.3.0-history-card-controls-final.zip` (95,494 bytes). The previous unpacked folder was locked by the running Chrome extension, so the fresh folder must be loaded and then the HLTV tab refreshed.

## 0.3.1 — Chrome/Edge MV3 background declaration fix (2026-10-08)

Status: manifest fix, regression coverage, build, distribution audit, and package refresh are complete in the working tree. The owner must remove the old unpacked extension instance before loading this package so stale context-menu errors are cleared.

- Removed the obsolete MV2 `background.scripts` declaration from the MV3 manifest. Chrome was reporting `'background.scripts' requires manifest version of 2 or lower`; the supported Chrome and Edge builds now declare only `background.service_worker: "background.js"`.
- Added a manifest regression test. Reverse validation deliberately restored `background.scripts` and the test failed, then the field was removed and the full suite passed. The current source contains no context-menu registration or the old `hltv-zh-tools` / `hltv-zh-translate-selection` IDs; those duplicate-ID messages were stale errors from the earlier context-menu build and are cleared by removing the old extension instance.
- Verification: `npm test` passes **184/184**, `npm run typecheck`, `npm run build`, `node --check dist/background.js`, `node --check dist/content.js`, required-file and SHA-256 audits, and `git diff --check` pass. The manifest reports version `0.3.1`, permission `storage`, service worker `background.js`, and no `background.scripts` field.
- Fresh installation folder: `C:\Users\Chester\Downloads\CS2-HLTV-Chinese-Reader-0.3.1-chrome-edge`; ZIP: `C:\Users\Chester\Downloads\CS2-HLTV-Chinese-Reader-0.3.1-chrome-edge.zip` (95,310 bytes, SHA-256 `7F01BF58F58F66CA6A4A958010D53C7346C1EC95BC2914FAA8C09BA249907D13`).

## 1.0.0 — first GitHub release preparation (2026-10-08)

Status: published to GitHub and pushed to `main`; future updates should continue from this tagged baseline.

- Promoted the extension and package metadata to `1.0.0` for the first GitHub release without using `3.0` in the release or asset name.
- Replaced the README with `README.md` (English) and `README.zh-CN.md` (中文). Each page has an `English | 中文` link at the top, so only one language is shown at a time and one click switches between the two GitHub-rendered pages.
- The published release asset is `CS2-HLTV-Chinese-Reader-v1.0.0.zip` (95,260 bytes, SHA-256 `0124D83A15DF2CFD493EF3E8EBD7E3BF7F97EEB76C839756D31E6D2CC8C03EC7`) and contains the validated MV3 service-worker build. The matching unpacked folder is `C:\Users\Chester\Downloads\CS2-HLTV-Chinese-Reader-v1.0.0`.
- Published commit: `c93e74abed5cf4cfc4f5e5b0ca07f26b65573164`; tag and release: `v1.0.0` at `https://github.com/Chester-chs/cs2-hltv-zh-reader/releases/tag/v1.0.0`. The asset is uploaded and the remote `main` line matches the local commit.
