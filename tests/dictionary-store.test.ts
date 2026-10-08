const assertModuleName = 'node:assert/strict';
const { strict: assert } = (await import(assertModuleName)) as {
  strict: {
    equal(actual: unknown, expected: unknown, message?: string): void;
    deepEqual(actual: unknown, expected: unknown, message?: string): void;
  };
};

const nodeTestModuleName = 'node:test';
const { test } = (await import(nodeTestModuleName)) as {
  test(name: string, callback: () => void | Promise<void>): void;
};
import {
  createDictionaryStore,
  type DictionaryEntry,
  type DictionaryStorage
} from '../src/content/dictionary-store.ts';

class MemoryStorage implements DictionaryStorage {
  values: Record<string, unknown> = {};

  async get(): Promise<Record<string, unknown>> {
    return { ...this.values };
  }

  async set(values: Record<string, unknown>): Promise<void> {
    Object.assign(this.values, values);
  }
}

function entry(query: string, translated = `${query} 中文`): DictionaryEntry {
  return {
    query,
    translated,
    baseForm: query,
    savedAt: 100
  };
}

test('dictionary history deduplicates terms and keeps newest entries first', async () => {
  const storage = new MemoryStorage();
  const store = createDictionaryStore(storage, () => 200);

  await store.recordHistory(entry('benched'));
  await store.recordHistory(entry('Spirit'));
  await store.recordHistory(entry('BENCHED', '坐冷板凳'));

  assert.deepEqual(
    (await store.listHistory()).map((item) => [item.query, item.translated]),
    [['BENCHED', '坐冷板凳'], ['Spirit', 'Spirit 中文']]
  );
});

test('dictionary favorites toggle and persist independently of history', async () => {
  const storage = new MemoryStorage();
  const store = createDictionaryStore(storage, () => 300);

  assert.equal(await store.toggleFavorite(entry('benched')), true);
  assert.equal(await store.isFavorite('BENCHED'), true);
  assert.equal(await store.toggleFavorite(entry('BENCHED')), false);
  assert.equal(await store.isFavorite('benched'), false);
  assert.deepEqual(await store.listFavorites(), []);
});

test('dictionary store can clear history and favorites independently', async () => {
  const storage = new MemoryStorage();
  const store = createDictionaryStore(storage, () => 400);
  await store.recordHistory(entry('bench'));
  await store.toggleFavorite(entry('bench'));

  await store.clearHistory();
  assert.deepEqual(await store.listHistory(), []);
  assert.equal((await store.listFavorites()).length, 1);

  await store.clearFavorites();
  assert.deepEqual(await store.listFavorites(), []);
});
