# Progress

## Gate 0.5 — Git initialization and repository hygiene

Status: complete; Gate 1 implementation and build are complete; Gate 2 is pending owner-run browser verification.

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

Status: implementation and build complete; Gate 2 is pending owner-run browser verification.

- Node: `v24.19.0`.
- Package manager: `pnpm 12.4.1` via `pnpm.cmd`; PowerShell's `pnpm.ps1` shim was blocked by execution policy.
- Installed versions: `webextension-polyfill 0.12.0`, `@types/webextension-polyfill 0.12.6`, `typescript 7.0.2`, and `vite 8.3.0`.
- `pnpm typecheck` passed with `tsc --noEmit`.
- `pnpm build` produced exactly `dist/background.js`, `dist/content.js`, and `dist/manifest.json`.
- The bare import/export check returned `rg_exit=1` and `NO_BARE_IMPORT_EXPORT_FOUND`.
- Manifest paths resolve to existing files: `background.js`, `background.js`, and `content.js`.
- `git ls-files -- dist` returned no tracked files; `dist/` is ignored by `.gitignore`.
- Gate 2 is not fully passed. Edge was externally auto-validated, but Chrome and Firefox still require manual loading verification.

### Gate 2 partial external pre-validation

- Edge: automatic validation passed. The service worker was alive and read the manifest internally: worker id `aiginabjibgaalcealemidoceijokeka`, version `0.0.1`, and name `CS2 HLTV Chinese Reader`. On `https://www.hltv.org/`, the content log was `[cs2-hltv-zh] content script injected at https://www.hltv.org/`. The HTTP response was `200`, the title was `Counter-Strike News & Coverage | HLTV.org`, and no Cloudflare challenge page appeared.
- Chrome: manual validation required. Playwright automation could not load the extension because Chrome rejected `--load-extension` under its official browser security restriction; CDP `Extensions.loadUnpacked` accepted the path but did not activate the extension. This is an automation limitation, not an extension defect.
- Firefox: manual validation required. The Playwright Firefox build does not support loading unsigned extensions (`backgroundPages=0`). This is an automation limitation, not an extension defect.
- Additional evidence: Playwright's supported Chromium host passed both background and content validation, and produced the same extension ID as Edge (`aiginabjibgaalcealemidoceijokeka`). This supports that the built artifacts and manifest are healthy.
- Gate 2 remains incomplete until the Chrome and Firefox manual checks pass. The Edge and Playwright Chromium results do not substitute for those two checks.

### Pending manual Gate 2 checks

- Chrome: open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `C:\ChatGPT\HLTV\dist`. Open the extension service worker's **Inspect** console for the background log, then open `https://www.hltv.org/` and use the page DevTools **Console** for the content log. Expected messages are `[cs2-hltv-zh] background started (version 0.0.1)` and `[cs2-hltv-zh] content script injected at https://www.hltv.org/`.
- Firefox: open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select `C:\ChatGPT\HLTV\dist\manifest.json`. Use the Add-on Toolbox Console when its **Inspect** entry is available; otherwise use **Browser Console**. In the filtering controls, enable **Info**, **Logs**, **Errors**, and **Warnings**, because `console.log` is Info-level. Use the page DevTools **Console** for the content log. If neither Add-on Toolbox nor Browser Console shows the background log, Gate 2 fails; it is not a known limitation.
- Firefox test record: Firefox `156.0`, executable `C:\Program Files\Mozilla Firefox\firefox.exe`. The temporary extension must be reloaded after each browser restart.

### Gate 2 Firefox notes

- Test record supplied by the owner: Firefox `156.0`, executable `C:\Program Files\Mozilla Firefox\firefox.exe`.
- In Browser Console, the filter controls must have Info, Logs, Errors, and Warnings enabled; `console.log` is an Info-level message and must not be hidden by the filter.
- If the Add-on Toolbox Console has level filters, enable the same Info, Logs, Errors, and Warnings levels there as well.
- If neither Add-on Toolbox nor Browser Console shows the background log, Gate 2 fails; this is not a known limitation.

### Known items deferred from Gate 1

- `manifest.json` currently has no `icons` field. Firefox will display its default extension icon; adding icons is a later TODO and is not part of this scaffold.
- Firefox temporary extensions do not persist after the browser closes. Each new Firefox test must reload `C:\ChatGPT\HLTV\dist\manifest.json` through `about:debugging`.
- `manifest.json` currently uses the user-visible placeholder description `A log-only browser extension scaffold...`. After Gate 3 reconnaissance and confirmation of the feature positioning, rewrite it to describe the real extension functionality.

### Gate 1 scaffold commit

- Completed as `529ae86` with message `chore: add minimal extension scaffold`.

## Documentation lesson

> PROGRESS.md 曾出现文档漂移：记录了已完成的提交为待批准状态，导致后续会话误判进度。今后每个 Gate 完成时，必须在同一次操作中更新 PROGRESS.md 并核对 git log 的真实输出。
