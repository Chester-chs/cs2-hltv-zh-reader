interface StrictAssert {
  equal(actual: unknown, expected: unknown, message?: string): void;
}

const nodeAssertModuleName = 'node:assert/strict';
const { strict: assert } = (await import(nodeAssertModuleName)) as {
  strict: StrictAssert;
};

const nodeFsModuleName = 'node:fs';
const { readFileSync } = (await import(nodeFsModuleName)) as {
  readFileSync(path: URL, encoding: 'utf8'): string;
};

const nodeTestModuleName = 'node:test';
const { test } = (await import(nodeTestModuleName)) as {
  test(name: string, callback: () => void | Promise<void>): void;
};

test('MV3 manifest uses only the service worker background declaration', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../manifest.json', import.meta.url), 'utf8')
  ) as {
    manifest_version?: number;
    background?: { scripts?: unknown; service_worker?: unknown };
  };

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.background?.service_worker, 'background.js');
  assert.equal(manifest.background?.scripts, undefined);
});
