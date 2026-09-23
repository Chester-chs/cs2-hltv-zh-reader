import type { CacheStore } from '../core/translate/index.ts';

export interface CacheBackend {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  clear?(): Promise<number>;
}

export interface CacheManagementStore extends CacheStore {
  clear(): Promise<number>;
}

export type CacheDiagnosticCode =
  | 'cache-read-failed'
  | 'cache-write-failed';

export interface CacheDiagnostic {
  code: CacheDiagnosticCode;
  key: string;
  message: string;
}

export type CacheDiagnosticSink = (diagnostic: CacheDiagnostic) => void;

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createCacheStoreFromBackend(
  backend: CacheBackend,
  onDiagnostic: CacheDiagnosticSink = () => {}
): CacheManagementStore {
  return {
    async get(key) {
      try {
        return await backend.get(key);
      } catch (error) {
        onDiagnostic({
          code: 'cache-read-failed',
          key,
          message: describeError(error)
        });
        return undefined;
      }
    },
    async set(key, value) {
      try {
        await backend.set(key, value);
      } catch (error) {
        onDiagnostic({
          code: 'cache-write-failed',
          key,
          message: describeError(error)
        });
        // A successful translation must remain usable when persistence fails.
      }
    },
    async clear() {
      if (backend.clear === undefined) {
        throw new Error('Translation cache clearing is unavailable.');
      }
      try {
        return await backend.clear();
      } catch {
        throw new Error('Translation cache could not be cleared.');
      }
    }
  };
}

interface IndexedDbFactoryLike {
  open(name: string, version?: number): IDBOpenDBRequest;
}

interface CacheRecord {
  key: string;
  value: string;
}

export interface IndexedDbCacheStoreOptions {
  indexedDB?: IndexedDbFactoryLike;
  databaseName?: string;
  storeName?: string;
  onDiagnostic?: CacheDiagnosticSink;
}

const DEFAULT_DATABASE_NAME = 'cs2-hltv-zh-cache-v1';
const DEFAULT_STORE_NAME = 'translations';

function requestPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function transactionPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
  });
}

function openDatabase(
  factory: IndexedDbFactoryLike,
  databaseName: string,
  storeName: string
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(databaseName, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(storeName)) {
        database.createObjectStore(storeName, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed.'));
  });
}

function createIndexedDbBackend(
  factory: IndexedDbFactoryLike | undefined,
  databaseName: string,
  storeName: string
): CacheBackend {
  let databasePromise: Promise<IDBDatabase> | undefined;

  const open = (): Promise<IDBDatabase> => {
    if (factory === undefined) {
      return Promise.reject(new Error('IndexedDB is unavailable.'));
    }
    databasePromise ??= openDatabase(factory, databaseName, storeName);
    return databasePromise;
  };

  return {
    async get(key) {
      const database = await open();
      const transaction = database.transaction(storeName, 'readonly');
      const record = await requestPromise<CacheRecord | undefined>(
        transaction.objectStore(storeName).get(key)
      );
      return record?.value;
    },
    async set(key, value) {
      const database = await open();
      const transaction = database.transaction(storeName, 'readwrite');
      await requestPromise(transaction.objectStore(storeName).put({ key, value }));
    },
    async clear() {
      const database = await open();
      const transaction = database.transaction(storeName, 'readwrite');
      const completed = transactionPromise(transaction);
      const objectStore = transaction.objectStore(storeName);
      const countRequest = requestPromise(objectStore.count());
      const clearRequest = requestPromise(objectStore.clear());
      const [count] = await Promise.all([
        countRequest,
        clearRequest,
        completed
      ]);
      return count;
    }
  };
}

export function createIndexedDbCacheStore(
  options: IndexedDbCacheStoreOptions = {}
): CacheManagementStore {
  const factory = options.indexedDB ?? globalThis.indexedDB;
  const backend = createIndexedDbBackend(
    factory,
    options.databaseName ?? DEFAULT_DATABASE_NAME,
    options.storeName ?? DEFAULT_STORE_NAME
  );
  return createCacheStoreFromBackend(backend, options.onDiagnostic);
}
