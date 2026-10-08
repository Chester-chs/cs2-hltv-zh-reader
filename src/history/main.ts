import browser from 'webextension-polyfill';
import {
  createDictionaryStore,
  type DictionaryEntry,
  type DictionaryStorage
} from '../content/dictionary-store.ts';

const storage = browser.storage.local as unknown as DictionaryStorage;
const store = createDictionaryStore(storage);
const summary = document.querySelector<HTMLElement>('#summary')!;
const entries = document.querySelector<HTMLUListElement>('#entries')!;
const clearButton = document.querySelector<HTMLButtonElement>('#clear')!;
const filterButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-filter]'));

type HistoryFilter = 'all' | 'favorites';
let filter: HistoryFilter = 'all';

function renderEntry(item: DictionaryEntry, favorite: boolean): HTMLLIElement {
  const row = document.createElement('li');
  row.className = 'entry';
  const content = document.createElement('div');
  const query = document.createElement('strong');
  query.className = 'entry-query';
  query.textContent = item.query;
  const translation = document.createElement('span');
  translation.className = 'entry-translation';
  translation.textContent = item.translated;
  const meta = document.createElement('span');
  meta.className = 'entry-meta';
  meta.textContent = item.baseForm === undefined ? '词典查询' : `动词原形：${item.baseForm}`;
  content.append(query, translation, meta);

  const favoriteButton = document.createElement('button');
  favoriteButton.type = 'button';
  favoriteButton.className = 'entry-favorite';
  favoriteButton.textContent = favorite ? '★' : '☆';
  favoriteButton.setAttribute('aria-label', favorite ? '取消收藏' : '收藏');
  favoriteButton.addEventListener('click', async () => {
    await store.toggleFavorite(item);
    await render();
  });
  row.append(content, favoriteButton);
  return row;
}

async function render(): Promise<void> {
  const [history, favorites] = await Promise.all([
    store.listHistory(),
    store.listFavorites()
  ]);
  const favoriteQueries = new Set(favorites.map((item) => item.query.toLocaleLowerCase()));
  const visible = filter === 'favorites' ? favorites : history;
  summary.textContent = `${history.length} 条历史 · ${favorites.length} 个收藏`;
  entries.replaceChildren();
  if (visible.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = filter === 'favorites' ? '还没有收藏词条。' : '还没有词典查询记录。';
    entries.appendChild(empty);
    return;
  }
  for (const item of visible) {
    entries.appendChild(renderEntry(item, favoriteQueries.has(item.query.toLocaleLowerCase())));
  }
}

for (const button of filterButtons) {
  button.addEventListener('click', () => {
    filter = button.dataset.filter === 'favorites' ? 'favorites' : 'all';
    for (const item of filterButtons) {
      item.classList.toggle('active', item === button);
    }
    void render();
  });
}

clearButton.addEventListener('click', async () => {
  if (filter === 'favorites') {
    await store.clearFavorites();
  } else {
    await store.clearHistory();
  }
  await render();
});

document.querySelector<HTMLButtonElement>('#close')?.addEventListener('click', () => window.close());
void render();
