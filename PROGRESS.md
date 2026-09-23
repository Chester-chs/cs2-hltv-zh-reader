# Progress

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

Status: implementation complete for owner review; no real provider is connected and no `host_permissions` were added.

- `src/background/protocol.ts` defines validated request/response codecs for `plain` and `event-name` batches. Failure responses carry the original text array and never require the content script to handle an exception.
- `src/background/cache-store.ts` provides the IndexedDB `CacheStore` adapter. Reads degrade to cache misses and writes are best effort with diagnostics. The core `CacheStore` interface is unchanged.
- `src/background/settings.ts` reads the full local settings object in background. The API key never enters the content settings reader or the message protocol. `src/shared/settings.ts` is the single source of the `mode: 'A'` default used by both sides.
- `src/background/fake-provider.ts` is the B3a-only injectable provider and supports success, provider failure, invalid response, and never-resolving test modes. Successful values use the visible `【译】` prefix.
- `src/content/background-translator.ts` uses an injected message sender and a same-session result map. A same-session hit sends no message; a cross-page IndexedDB hit still sends one message because the cache is background-owned, but background does not call the provider on that hit.
- The background and content timeout values are injectable. Production defaults are 5000 ms for the background operation and 6000 ms for the content message; tests use short values for deterministic timeout coverage. B3a performs no retries.
- `docs/background-integration.md` records the protocol, module boundaries, API-key boundary, runtime glossary loading, timeout policy, and the three cache semantics.
- Automated validation is pending owner review in this working tree; system-browser loading and a real provider remain B3b or later work.

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
- Automated verification output and build artifact checks are reported with the implementation handoff. No files have been staged or committed. The reviewed repository HEAD remains `a563a70 feat: add background translation integration`; current `git log -5` was checked during this implementation.

## Classification context repair

Status: implementation, automated verification, and owner-provided local fake-provider end-to-end validation are complete; commit and push are authorized.

- Added context-aware classification while keeping the default `comment` context conservative. Match event/stage/meta/time strategies pass `structured`, prose strategies pass `prose`, and comment strategies pass `comment`.
- Added deterministic pre-classification glossary substitution for fully covered controlled values. `bo3` and `bo5` remain unchanged because players recognize them and the 28 px `.match-meta` field cannot fit expanded labels reliably.
- Added regression coverage for real match labels, no provider call for glossary-covered values, conservative UGC comments, context-independent numbers/dates/symbols/Chinese, and the display `never` strategy for team names.
- Verification passed: `pnpm.cmd typecheck` (exit 0); `pnpm.cmd test` (95 passed, 0 failed, 0 skipped); `pnpm.cmd build` (all background/content/options builds succeeded); dependency direction (`node --test tests/translate-dependencies.test.ts`, 1 passed). The built distribution contains manifest, glossary, background/content/options JS, options HTML/CSS, no bare import/export statements in bundles, and valid options resource references.
- Owner-provided browser end-to-end verification passed with a local OpenAI-compatible fake server at `127.0.0.1:8788`: loopback permission grant and settings save succeeded; Mode B inserted 374 translation nodes, and all 14/14 event names rendered. Never-translate counts were team names 212/0, times 369/0, live scores 28/0, and livescore 14/0 (total / containing Chinese). Translations were the next sibling of the original text under `text-ellipsis`. The observer remained stable at 374 nodes for six seconds. Disabling the extension removed all translation nodes and restored the page.
- Owner-provided classifier checks on real page text showed structured eligible values increasing from 2/27 to 17/23; comment values remained 8/8 untranslated; Chinese 0/3 and number/symbol values 0/6 were translated. `bo3` and `bo5` matched glossary `keep_as_is` and bypassed both classifier and provider.
- One document-width measurement read 1521 against a 1425 viewport. Four controlled reproductions measured 1425 with zero overflowing elements; the same disabled state produced inconsistent 1425 and 1521 readings, while translation-enabled readings were normal. The owner attributes this measurement noise to HLTV lazy loading rather than the extension. Future manual verification uses the count of overflowing extension container elements as the layout criterion, not document width.
- The owner has authorized explicit-path staging, commit, and push. No files have been staged yet.
