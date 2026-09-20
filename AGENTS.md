# AGENTS.md

## 1. Project location and purpose

- Repository: **CS2 HLTV Chinese Reader**.
- This is a browser extension that translates page content from `hltv.org` into Chinese.
- Supported browsers are Chrome and Edge. Firefox is deferred, not abandoned, because its background event page did not start during validation; the unresolved diagnostic is recorded in `PROGRESS.md`. Firefox is outside the current scope.
- This project does not target Safari, an iOS app, or general-purpose web translation.

## 2. Architectural hard constraints

Violating these constraints can produce an extension that does not load:

- Keep one root-level `manifest.json`. Do not generate a second browser-specific manifest.
- Declare both `background.scripts` and `background.service_worker`, pointing to the same output.
- Do not use `background.type: "module"`.
- The background and content outputs must be single-file IIFEs. The built files must not contain bare `import` or `export` statements.
- Use `browser.*` consistently through `webextension-polyfill`. Do not call `chrome.*` directly.
- Keep permissions minimal; the current permission is only `storage`. Any added permission requires a documented reason.
- Do not depend on `declarativeNetRequest`.
- Every build must be checked for these four files under `dist/`: `background.js`, `content.js`, `manifest.json`, and `glossary.json`.

## 3. Layers and dependency direction

- `src/core/translate/` contains pure logic: its inputs and outputs are `string[]`, it does not know about display modes, and it performs no DOM operations.
- `src/core/display/` contains pure decisions: it computes `RenderIntent` values and performs no DOM operations.
- Neither directory may import DOM APIs, `browser.*` APIs, or content-script code.
- `tests/translate-dependencies.test.ts` asserts this constraint for both directories.
- After changing any file in either directory, run that dependency check.
- DOM operations belong to the content-script layer, which is the only layer allowed to touch the DOM.

## 4. Testing conventions

- Use Node's built-in `node:test`; do not add a test-framework dependency.
- Node's native type stripping runs the `.ts` test files directly; `ts-node` and `tsx` are not required.
- Imports in test files must use explicit `.ts` extensions. Node ESM requires explicit extensions, and `tsconfig.json` enables `allowImportingTsExtensions`.
- Keep the existing extensionless import style inside `src/`; do not batch-rewrite it for stylistic consistency.
- Tests must not depend on the real network. Providers use mocks.
- Tests must not use a real DOM or import `jsdom`. DOM-related logic remains testable through returned intents.
- Do not use `skip`, `only`, weakened assertions, or `try/catch` that swallows errors.

## 5. Do not suppress checks to make them pass

These are hard prohibitions based on two real problems in this project:

- Do not use `@ts-expect-error` or `@ts-ignore` to eliminate an error. Fix the root cause. If it genuinely cannot be fixed, record it as a known limitation and explain why.
- Do not weaken a check merely to make it pass. Two examples have already occurred:
  - The dependency-direction check once used `.replace()` to remove identifiers from the text before matching, allowing a forbidden reference hidden in a removed identifier to escape detection.
  - Four imports once used `@ts-expect-error TS5097`, allowing misspelled imported symbols to evade type checking.
- Make checks more precise instead, such as using `/\bdocument\s*[.[(]/` to match actual access, rather than weakening the check.
- Whenever a check is added or modified, perform a reverse validation: deliberately create a violation that should be caught, confirm that the check reports it, then remove it and confirm that the check passes again. A check without reverse validation is unverified.

## 6. Display-strategy constraints

These constraints come from `docs/display-strategy.md`:

- `glossary.json` is the sole authority for terminology. Do not hard-code translations in code.
- The in-memory record table is the sole authority for original text. Do not recover original text from DOM attributes.
- Do not provide a default in-memory cache implementation in the core layer; an in-memory implementation is allowed only in tests.
- Element strategies must be represented as data, not scattered `if/else` chains.
- An element without a matching strategy defaults to no translation. This default must be asserted by tests.
- Known non-translatable objects include elements with both `data-time-format` and `data-unix`, elements with `data-countdown-target-timestamp`, and live-score nodes.
- Keep selectors centralized in `src/core/display/selectors.ts`; do not scatter them across other files.

## 7. Git and commit discipline

- Do not use `git add -A` or `git add .`. Stage files explicitly, one by one.
- Before every commit, report the files to be staged and wait for owner confirmation.
- Use conventional commit prefixes: `feat:`, `fix:`, `docs:`, `chore:`, or `refactor:`.
- Do not commit `dist/`, `raw-capture/`, `node_modules/`, real `.env` files, or any secrets.
- After committing and pushing, show real output from:

  ```text
  git show --stat HEAD
  git status --short --branch
  git rev-parse HEAD
  git ls-remote origin
  ```

  Require the local `HEAD` hash to appear on the remote `main` line. A push command without an error is not proof that the push succeeded.
- At the same time as completing every stage, update `PROGRESS.md` and verify the real `git log` output.
- This project has experienced documentation drift: `PROGRESS.md` once recorded completed commits as awaiting approval, causing a later session to misjudge progress. Documentation must follow the repository's real state, never the other way around.

## 8. Reconnaissance and external-request discipline

- Do not use Puppeteer, Playwright, or similar automated scraping to fetch `hltv.org`. It has been tested that the formal Chrome release rejects loading the extension with the required command-line flag, and Firefox-side Playwright does not support unsigned extensions.
- Space requests to `hltv.org` by at least two seconds and do not make them concurrently.
- Store captured raw pages under `raw-capture/`. That directory is ignored by Git and must not be committed.
- If evidence cannot be obtained, write `Unable to confirm` and state what was attempted. Do not present speculation as a conclusion.

## 9. Working method

- Show the interface contract to the owner and obtain confirmation before implementing it. This project has avoided rework multiple times by confirming interfaces first.
- When uncertain, stop and ask; do not guess.
- Stop after completing one stage and wait for confirmation; do not automatically enter the next stage.
- Do not opportunistically refactor unrelated code or add unapproved dependencies.
- Do not write CI configuration; the project has not reached that stage.

## 10. Current progress and next steps

- Completed: Gate 0 planning, Gate 0.5 repository setup, Gate 1 scaffold, Gate 2 browser validation for Chrome and Edge, Gate 3 reconnaissance, Gate 4 display strategy, Gate 5 translation-core and display-layer pure logic, and B2 content-script wiring with the document-event bridge.
- B3a background-side IndexedDB/message architecture is implemented in the working tree and is pending owner review; pending later work is B3b real-provider integration and the B4 options page.
- The background-side IndexedDB adapter now exists, but the real browser cache hit rate has not been measured. Do not fake a measured hit rate by adding a default cache to the core layer.

## 11. Documentation map

- `PLAN.md` — project plan and architectural decisions.
- `PROGRESS.md` — current progress and handoff point.
- `docs/findings.md` — reconnaissance evidence.
- `docs/display-strategy.md` — per-element display strategy.
- `docs/compliance.md` — compliance and licensing.
- `docs/translation-layer.md` — translation-layer contract.
- `docs/display-layer.md` — display-layer contract.
- `docs/background-integration.md` — B3a background integration contract.
- `docs/testing.md` — testing conventions.
