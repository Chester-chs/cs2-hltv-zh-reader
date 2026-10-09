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
const reviewButton = document.querySelector<HTMLButtonElement>('#review')!;
const exportButton = document.querySelector<HTMLButtonElement>('#export')!;
const filterButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-filter]'));

type HistoryFilter = 'all' | 'favorites';
let filter: HistoryFilter = 'all';
let reviewMode = false;
let reviewIndex = 0;
const englishUi = false;

interface ReviewState {
  dueAt: number;
  interval: number;
}

const REVIEW_KEY = 'dictionaryReviewState';

function applyLanguage(): void {
  document.documentElement.lang = englishUi ? 'en' : 'zh-CN';
  document.querySelector<HTMLElement>('#history-title')!.textContent = englishUi ? 'Dictionary history' : '词典历史';
  document.querySelector<HTMLButtonElement>('#filter-all')!.textContent = englishUi ? 'All' : '全部';
  document.querySelector<HTMLButtonElement>('#filter-favorites')!.textContent = englishUi ? 'Favorites' : '收藏';
  reviewButton.textContent = reviewMode ? (englishUi ? 'Exit review' : '退出复习') : (englishUi ? 'Start review' : '开始复习');
  exportButton.textContent = englishUi ? 'Export CSV' : '导出 CSV';
  clearButton.textContent = englishUi ? 'Clear current list' : '清空当前列表';
  document.querySelector<HTMLButtonElement>('#close')!.textContent = englishUi ? 'Close' : '关闭';
}

async function readReviewState(): Promise<Record<string, ReviewState>> {
  const values = await storage.get([REVIEW_KEY]);
  const stored = values[REVIEW_KEY];
  if (typeof stored !== 'object' || stored === null) return {};
  const result: Record<string, ReviewState> = {};
  for (const [query, value] of Object.entries(stored as Record<string, unknown>)) {
    if (typeof value !== 'object' || value === null) continue;
    const item = value as Record<string, unknown>;
    if (typeof item.dueAt === 'number' && typeof item.interval === 'number') {
      result[query] = { dueAt: item.dueAt, interval: item.interval };
    }
  }
  return result;
}

async function markReview(query: string, remembered: boolean): Promise<void> {
  const state = await readReviewState();
  const previous = state[query] ?? { dueAt: 0, interval: 0 };
  const interval = remembered ? Math.min(30, Math.max(1, previous.interval * 2)) : 1;
  state[query] = { interval, dueAt: Date.now() + interval * 24 * 60 * 60 * 1000 };
  await storage.set({ [REVIEW_KEY]: state });
}

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
  meta.textContent = [
    item.baseForm === undefined ? (englishUi ? 'Dictionary lookup' : '词典查询') : `${englishUi ? 'Base form' : '动词原形'}：${item.baseForm}`,
    item.difficulty === undefined ? '' : `${englishUi ? 'Level' : '难度'}：${item.difficulty}`,
    item.pinyin === undefined ? '' : `${englishUi ? 'Pinyin' : '拼音'}：${item.pinyin}`
  ].filter(Boolean).join(' · ');
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

function renderReviewEntry(item: DictionaryEntry, favorite: boolean, total: number): HTMLLIElement {
  const row = renderEntry(item, favorite);
  row.classList.add('review-entry');
  const content = row.firstElementChild;
  if (content !== null) {
    const answer = document.createElement('button');
    answer.type = 'button';
    answer.className = 'review-answer';
    answer.textContent = englishUi ? 'Show answer' : '显示答案';
    answer.addEventListener('click', () => {
      const translation = document.createElement('p');
      translation.className = 'entry-translation';
      translation.textContent = item.translated;
      answer.replaceWith(translation);
    });
    content.appendChild(answer);
    const controls = document.createElement('div');
    controls.className = 'review-controls';
    for (const [label, remembered] of [[englishUi ? 'Remembered' : '记住了', true], [englishUi ? 'Review later' : '稍后复习', false]] as const) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.addEventListener('click', async () => {
        await markReview(item.query, remembered);
        reviewIndex += 1;
        await render();
      });
      controls.appendChild(button);
    }
    content.appendChild(controls);
  }
  summary.textContent = englishUi ? `Review ${Math.min(reviewIndex + 1, total)} / ${total}` : `复习 ${Math.min(reviewIndex + 1, total)} / ${total}`;
  return row;
}

async function render(): Promise<void> {
  const [history, favorites] = await Promise.all([
    store.listHistory(),
    store.listFavorites()
  ]);
  const favoriteQueries = new Set(favorites.map((item) => item.query.toLocaleLowerCase()));
  const visible = filter === 'favorites' ? favorites : history;
  summary.textContent = englishUi ? `${history.length} history · ${favorites.length} favorites` : `${history.length} 条历史 · ${favorites.length} 个收藏`;
  entries.replaceChildren();
  if (reviewMode) {
    if (favorites.length === 0 || reviewIndex >= favorites.length) {
      reviewMode = false;
      reviewIndex = 0;
      applyLanguage();
      const empty = document.createElement('li');
      empty.className = 'empty';
      empty.textContent = favorites.length === 0
        ? (englishUi ? 'Favorite a word before starting review.' : '请先收藏词条，再开始复习。')
        : (englishUi ? 'Review complete.' : '本轮复习完成。');
      entries.appendChild(empty);
      return;
    }
    entries.appendChild(renderReviewEntry(
      favorites[reviewIndex]!,
      favoriteQueries.has(favorites[reviewIndex]!.query.toLocaleLowerCase()),
      favorites.length
    ));
    return;
  }
  if (visible.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = filter === 'favorites'
      ? (englishUi ? 'No favorites yet.' : '还没有收藏词条。')
      : (englishUi ? 'No dictionary history yet.' : '还没有词典查询记录。');
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

reviewButton.addEventListener('click', async () => {
  reviewMode = !reviewMode;
  reviewIndex = 0;
  applyLanguage();
  await render();
});

exportButton.addEventListener('click', async () => {
  const [history, favorites] = await Promise.all([store.listHistory(), store.listFavorites()]);
  const rows = [
    ['query', 'translation', 'baseForm', 'difficulty', 'pinyin', 'favorite'],
    ...history.map((item) => [
      item.query,
      item.translated,
      item.baseForm ?? '',
      item.difficulty ?? '',
      item.pinyin ?? '',
      favorites.some((favorite) => favorite.query.toLocaleLowerCase() === item.query.toLocaleLowerCase()) ? 'yes' : 'no'
    ])
  ];
  const csv = rows
    .map((row) => row.map((cell) => `"${cell.replace(/"/gu, '""')}"`).join(','))
    .join('\n');
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'hltv-dictionary.csv';
  link.click();
  URL.revokeObjectURL(url);
});

clearButton.addEventListener('click', async () => {
  if (filter === 'favorites') {
    await store.clearFavorites();
  } else {
    await store.clearHistory();
  }
  await render();
});

document.querySelector<HTMLButtonElement>('#close')?.addEventListener('click', () => window.close());
void (async () => {
  applyLanguage();
  await render();
})();
