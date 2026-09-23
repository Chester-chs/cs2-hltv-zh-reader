# Test execution convention

The repository uses Node's native test runner. The `test` script is:

```text
node --test tests/*.test.ts
```

Node v24.19.0 executes the TypeScript test files through native type stripping; no `ts-node`, `tsx`, or test runtime dependency is required. `tsconfig.json` includes `tests/**/*.ts`, so test-file type errors are checked by the normal `typecheck` command.

Test files must use explicit `.ts` extensions when importing TypeScript modules, for example:

```ts
import { add } from './fixtures/add.ts';
```

The repository's TypeScript 7.0.2 currently emits TS5097 for this spelling without `allowImportingTsExtensions`; the demonstration test contains a narrow, documented `@ts-expect-error TS5097` on that import. This keeps the required runtime spelling without adding the compiler option. Existing imports inside `src/` retain their established extensionless spelling and are not being normalized by this convention.

## Provider permission browser verification

Provider permission verification must include both of these browser scenarios:

1. Install and load the extension with no saved provider configuration or host permission. Open `/matches` so the content script scans while permission is missing. Then configure an HTTPS provider in Options and grant its permission. The open page must rescan after the settings change and translate without a reload.
2. Use a real external HTTPS provider origin, such as `https://api.deepseek.com`, for the permission flow. A loopback address such as `127.0.0.1` exercises the special local HTTP allowance and does not represent an external provider origin.

The earlier automated browser validation used `127.0.0.1` and granted its permission in the same session. It therefore did not exercise the extension-starts-before-configuration timing, the default-origin startup diagnostic, or recovery of a page that had already scanned before permission was granted. Keep these scenarios in future provider permission verification; unit tests do not replace the external-origin browser check.
