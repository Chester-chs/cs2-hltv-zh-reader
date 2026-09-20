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
