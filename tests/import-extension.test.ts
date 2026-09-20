// TypeScript 7.0.2 reports TS5097 for explicit .ts imports without the
// allowImportingTsExtensions flag; keep the required import spelling and
// document this narrow compiler discrepancy instead of changing the config.
// @ts-expect-error TS5097
import { add } from './fixtures/add.ts';

const nodeTestModuleName: string = 'node:test';
const { test } = await import(nodeTestModuleName) as {
  test(name: string, callback: () => void | Promise<void>): void;
};

test('loads a TypeScript module with an explicit .ts import extension', () => {
  if (add(2, 3) !== 5) {
    throw new Error('add fixture returned an unexpected result');
  }
});
