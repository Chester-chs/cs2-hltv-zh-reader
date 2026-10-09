import { DEFAULT_CONTENT_SETTINGS } from '../src/shared/settings.ts';

interface StrictAssert {
  equal(actual: unknown, expected: unknown, message?: string): void;
}

const nodeAssertModuleName = 'node:assert/strict';
const { strict: assert } = (await import(nodeAssertModuleName)) as { strict: StrictAssert };
const nodeTestModuleName = 'node:test';
const { test } = (await import(nodeTestModuleName)) as {
  test(name: string, callback: () => void | Promise<void>): void;
};

test('content settings stay on the Chinese-reader interface', () => {
  assert.equal(DEFAULT_CONTENT_SETTINGS.interfaceLanguageSelected, true);
  assert.equal(DEFAULT_CONTENT_SETTINGS.uiLanguage, 'zh-CN');
});
