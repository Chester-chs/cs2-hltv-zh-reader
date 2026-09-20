interface StrictAssert {
  equal(actual: unknown, expected: unknown, message?: string): void;
}

interface DirectoryEntry {
  name: string;
  isDirectory(): boolean;
  isFile(): boolean;
}

const nodeAssertModuleName = 'node:assert/strict';
const { strict: assert } = (await import(nodeAssertModuleName)) as {
  strict: StrictAssert;
};

const nodeFsModuleName = 'node:fs';
const { existsSync, readdirSync, readFileSync } = (await import(
  nodeFsModuleName
)) as {
  existsSync(path: string): boolean;
  readdirSync(
    path: string,
    options: { withFileTypes: true }
  ): DirectoryEntry[];
  readFileSync(path: string, encoding: 'utf8'): string;
};

const nodePathModuleName = 'node:path';
const { dirname, resolve } = (await import(nodePathModuleName)) as {
  dirname(path: string): string;
  resolve(...paths: string[]): string;
};

const nodeUrlModuleName = 'node:url';
const { fileURLToPath } = (await import(nodeUrlModuleName)) as {
  fileURLToPath(url: string | URL): string;
};

const nodeTestModuleName = 'node:test';
const { test } = (await import(nodeTestModuleName)) as {
  test(name: string, callback: () => void | Promise<void>): void;
};

const forbiddenReferences: ReadonlyArray<[string, RegExp]> = [
  ['document usage', /\bdocument\s*[.[(]/],
  ['window usage', /\bwindow\s*[.[(]/],
  ['browser API', /\bbrowser\./],
  ['chrome API', /\bchrome\./],
  ['fetch', /\bfetch\s*\(/],
  ['XMLHttpRequest', /\bXMLHttpRequest\b/],
  ['localStorage', /\blocalStorage\b/],
  ['indexedDB', /\bindexedDB\b/]
];

function collectTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      return collectTypeScriptFiles(path);
    }
    return entry.isFile() && path.endsWith('.ts') ? [path] : [];
  });
}

test('translation layer has no browser or DOM dependencies', () => {
  const testDirectory = dirname(fileURLToPath(import.meta.url));
  const sourceDirectories = [
    resolve(testDirectory, '../src/core/translate'),
    resolve(testDirectory, '../src/core/display')
  ];

  for (const sourceDirectory of sourceDirectories) {
    assert.equal(existsSync(sourceDirectory), true, sourceDirectory);

    for (const filePath of collectTypeScriptFiles(sourceDirectory)) {
      const source = readFileSync(filePath, 'utf8');
      for (const [name, pattern] of forbiddenReferences) {
        assert.equal(
          pattern.test(source),
          false,
          `${filePath} contains forbidden reference: ${name}`
        );
      }
    }
  }
});
