import { createDictionaryStore, type DictionaryStorage } from '../content/dictionary-store.ts';
import { decodeDictionaryRequest, type DictionaryResponse } from '../shared/dictionary-messages.ts';

export function createDictionaryMessageHandler(storage: DictionaryStorage):
  (message: unknown) => Promise<DictionaryResponse> {
  const store = createDictionaryStore(storage);
  let queue: Promise<void> = Promise.resolve();
  return (message) => {
    const request = decodeDictionaryRequest(message);
    if (request === undefined) return Promise.resolve({ ok: false, message: '无效的词典保存请求。' });
    // Every tab and the history page use this one writer. Reads and clears are
    // queued too, so they observe completed writes rather than stale arrays.
    const operation = queue.then(async (): Promise<DictionaryResponse> => {
      try {
        switch (request.action) {
          case 'record-history':
            if (request.entry === undefined) throw new Error('Missing entry');
            await store.recordHistory(request.entry);
            return { ok: true, value: null };
          case 'toggle-favorite':
            if (request.entry === undefined) throw new Error('Missing entry');
            return { ok: true, value: await store.toggleFavorite(request.entry) };
          case 'is-favorite': return { ok: true, value: await store.isFavorite(request.query ?? '') };
          case 'list-history': return { ok: true, value: await store.listHistory() };
          case 'list-favorites': return { ok: true, value: await store.listFavorites() };
          case 'clear-history':
            await store.clearHistory();
            return { ok: true, value: null };
          case 'clear-favorites':
            await store.clearFavorites();
            return { ok: true, value: null };
          case 'record-review':
            if (request.query === undefined || request.remembered === undefined) throw new Error('Missing review');
            await store.recordReview(request.query, request.remembered);
            return { ok: true, value: null };
        }
      } catch {
        return { ok: false, message: '词典记录操作失败，请重试；已有记录不会被清空。' };
      }
    });
    queue = operation.then(() => {});
    return operation;
  };
}
