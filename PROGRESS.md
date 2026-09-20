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

Status: Gate 3 documentation outputs created for the current Chrome and Edge scope. P0-3 remains `Unable to confirm`, so the display architecture decision is still blocked.

- Gate 3A: the supplied `/matches` facts were adopted without re-fetching; the current news archive, one news article, and one match-detail page were captured once each with curl and at least two-second request spacing.
- News-list URL resolution: `https://www.hltv.org/news` was known to return 404; the current list URL was resolved from home navigation and the sitemap trail as `https://www.hltv.org/news/archive/2026/september`.
- P0-1: the four sampled page types show SSR HTML, no React/Vue/Svelte/Angular/Alpine markers, no `hx-*` attributes, and no relevant first-party DOM child-position access in the inspected scripts. Runtime SPA navigation and mutation timing remain bounded as `Unable to confirm` because this pass used curl/source evidence rather than a live DevTools trace.
- P0-2: the preloaded livescore modules establish Socket.IO score delivery from `https://scorebot-lb.hltv.org`; `score` events update `data-livescore-*` nodes. Runtime handshake/reconnect timing was not measured.
- P0-3: `Unable to confirm` for the `/matches` target parents' `:nth-child`, `:first-child`, and `:last-child` dependencies because the owner-supplied match-list HTML was not present locally and was not re-fetched. Mode B remains withheld for those containers.
- Created `docs/findings.md`, `docs/display-strategy.md`, and `docs/compliance.md`. Raw captures remain ignored and local-only.
- Next allowed action: obtain or inspect the owner-supplied match-list HTML/CSS evidence or perform the specifically approved read-only parent-selector check. No display implementation begins before P0-3 is resolved and Gate 4 owner review is complete.

## Documentation lesson

> PROGRESS.md 曾出现文档漂移：记录了已完成的提交为待批准状态，导致后续会话误判进度。今后每个 Gate 完成时，必须在同一次操作中更新 PROGRESS.md 并核对 git log 的真实输出。
