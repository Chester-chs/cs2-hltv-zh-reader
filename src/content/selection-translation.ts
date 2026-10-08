import type {
  ContextualTranslationAdapter,
  DetailedTranslationResult
} from './background-translator.ts';
import type { TranslateFailureCode } from '../background/protocol.ts';
import type { TranslationPurpose } from '../core/translate/index.ts';
import type { DictionaryEntry } from './dictionary-store.ts';
import type { ThemeMode } from '../shared/settings.ts';

function setStyles(element: HTMLElement, styles: Partial<CSSStyleDeclaration>): void {
  for (const [property, value] of Object.entries(styles)) {
    if (value !== undefined) {
      element.style.setProperty(
        property.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`),
        String(value)
      );
    }
  }
}

export interface DictionaryDefinition {
  partOfSpeech: string;
  meaning: string;
  englishMeaning?: string;
}

export interface DictionaryDisplayData {
  baseForm?: string;
  ukPronunciation?: string;
  usPronunciation?: string;
  definitions: DictionaryDefinition[];
  networkMeaning?: string;
}

export type SelectionPurpose = 'dictionary' | 'sentence';

export function clampFontScale(value: number): number {
  return Math.max(0.8, Math.min(1.25, Number.isFinite(value) ? value : 1));
}

export function nextThemeMode(theme: ThemeMode): ThemeMode {
  return theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
}

export function classifySelectionPurpose(text: string): SelectionPurpose {
  const normalized = text.trim();
  return /^[A-Za-z]+(?:[-'][A-Za-z]+)*$/u.test(normalized)
    ? 'dictionary'
    : 'sentence';
}

const PART_OF_SPEECH_LABELS = new Map<string, string>([
  ['n', '名词'],
  ['noun', '名词'],
  ['名词', '名词'],
  ['v', '动词'],
  ['verb', '动词'],
  ['动词', '动词'],
  ['adj', '形容词'],
  ['adjective', '形容词'],
  ['形容词', '形容词'],
  ['adv', '副词'],
  ['adverb', '副词'],
  ['副词', '副词'],
  ['prep', '介词'],
  ['preposition', '介词'],
  ['介词', '介词'],
  ['pron', '代词'],
  ['pronoun', '代词'],
  ['代词', '代词'],
  ['conj', '连词'],
  ['conjunction', '连词'],
  ['连词', '连词'],
  ['phrase', '短语'],
  ['短语', '短语'],
  ['phr', '短语'],
  ['int', '感叹词'],
  ['interjection', '感叹词'],
  ['感叹词', '感叹词']
]);

function normalizePartOfSpeech(label: string): string | undefined {
  return PART_OF_SPEECH_LABELS.get(label.trim().toLowerCase().replace(/\.$/u, ''));
}

/**
 * Turns the provider's compact dictionary text into stable visual sections.
 * The provider is still allowed to return plain text; unrecognised text is
 * retained as a general definition instead of being discarded.
 */
export function parseDictionaryTranslation(translated: string): DictionaryDisplayData {
  const definitions: DictionaryDefinition[] = [];
  const unlabelled: string[] = [];
  let baseForm: string | undefined;
  let ukPronunciation: string | undefined;
  let usPronunciation: string | undefined;
  let networkMeaning: string | undefined;

  for (const rawPart of translated.split(/[;；\n]+/u)) {
    const part = rawPart.trim();
    if (part.length === 0) {
      continue;
    }
    const base = part.match(/^(?:动词原形|原形|词根|base(?:\s+form)?|lemma)\s*[:：]\s*(.+)$/iu);
    if (base !== null) {
      baseForm = base[1]?.trim();
      continue;
    }
    const pronunciation = part.match(/^(英(?:式)?|美(?:式)?)(?:音标|发音)?\s*[:：]\s*(.+)$/u);
    if (pronunciation !== null) {
      if (pronunciation[1]?.startsWith('英') === true) {
        ukPronunciation = pronunciation[2]?.trim();
      } else {
        usPronunciation = pronunciation[2]?.trim();
      }
      continue;
    }
    const network = part.match(/^网络\s*[:：]\s*(.+)$/u);
    if (network !== null) {
      networkMeaning = network[1]?.trim();
      continue;
    }
    const labelled = part.match(/^([^:：]{1,12})\s*[:：]\s*(.+)$/u);
    if (labelled !== null) {
      const partOfSpeech = normalizePartOfSpeech(labelled[1] ?? '');
      if (partOfSpeech !== undefined) {
        const [meaning, englishMeaning] = (labelled[2]?.trim() ?? '').split(/\s+\|\|\s+/u, 2);
        definitions.push({
          partOfSpeech,
          meaning: meaning ?? '',
          ...(englishMeaning === undefined ? {} : { englishMeaning })
        });
        continue;
      }
    }
    unlabelled.push(part);
  }

  if (definitions.length === 0 && unlabelled.length > 0) {
    definitions.push({
      partOfSpeech: '释义',
      meaning: unlabelled.join('；')
    });
  } else if (unlabelled.length > 0) {
    definitions.push({
      partOfSpeech: '补充',
      meaning: unlabelled.join('；')
    });
  }

  return {
    ...(baseForm === undefined ? {} : { baseForm }),
    ...(ukPronunciation === undefined ? {} : { ukPronunciation }),
    ...(usPronunciation === undefined ? {} : { usPronunciation }),
    definitions,
    ...(networkMeaning === undefined ? {} : { networkMeaning })
  };
}

export function inferRegularPastBaseForm(original: string, definitions: readonly DictionaryDefinition[]): string | undefined {
  if (!definitions.some((definition) => definition.partOfSpeech === '动词')) {
    return undefined;
  }
  const word = original.trim();
  if (!/^[A-Za-z]+$/u.test(word) || word.length < 4) {
    return undefined;
  }
  const lower = word.toLowerCase();
  if (lower.endsWith('ied') && word.length > 4) {
    return `${word.slice(0, -3)}y`;
  }
  if (!lower.endsWith('ed')) {
    return undefined;
  }
  let stem = word.slice(0, -2);
  if (/([b-df-hj-np-tv-z])\1$/iu.test(stem)) {
    stem = stem.slice(0, -1);
  }
  if (stem.toLowerCase().endsWith('us') || stem.toLowerCase().endsWith('aus')) {
    return `${stem}e`;
  }
  return stem;
}

function appendSearchIcon(
  document: Document,
  parent: Element,
  size = 20,
  responsive = false
): void {
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('focusable', 'false');
  icon.setAttribute('width', String(size));
  icon.setAttribute('height', String(size));
  icon.setAttribute('fill', 'none');
  icon.setAttribute('stroke', 'currentColor');
  icon.setAttribute('stroke-width', '1.7');
  icon.setAttribute('stroke-linecap', 'round');
  icon.style.setProperty(
    'width',
    responsive ? `calc(${size}px * var(--hltv-zh-scale))` : `${size}px`
  );
  icon.style.setProperty(
    'height',
    responsive ? `calc(${size}px * var(--hltv-zh-scale))` : `${size}px`
  );
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '10.8');
  circle.setAttribute('cy', '10.8');
  circle.setAttribute('r', '6.8');
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  line.setAttribute('d', 'm16 16 5 5');
  icon.append(circle, line);
  parent.appendChild(icon);
}

function appendCloseIcon(document: Document, parent: Element): void {
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('focusable', 'false');
  icon.setAttribute('width', '22');
  icon.setAttribute('height', '22');
  icon.setAttribute('fill', 'none');
  icon.setAttribute('stroke', 'currentColor');
  icon.setAttribute('stroke-width', '1.7');
  icon.setAttribute('stroke-linecap', 'round');
  icon.style.setProperty('width', 'calc(22px * var(--hltv-zh-scale))');
  icon.style.setProperty('height', 'calc(22px * var(--hltv-zh-scale))');
  const first = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  first.setAttribute('d', 'm6 6 12 12');
  const second = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  second.setAttribute('d', 'm18 6-12 12');
  icon.append(first, second);
  parent.appendChild(icon);
}

function appendSpeakerIcon(document: Document, parent: Element): void {
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('focusable', 'false');
  icon.setAttribute('width', '18');
  icon.setAttribute('height', '18');
  icon.setAttribute('fill', 'none');
  icon.setAttribute('stroke', 'currentColor');
  icon.setAttribute('stroke-width', '1.6');
  icon.setAttribute('stroke-linecap', 'round');
  icon.setAttribute('stroke-linejoin', 'round');
  icon.style.setProperty('width', 'calc(18px * var(--hltv-zh-scale))');
  icon.style.setProperty('height', 'calc(18px * var(--hltv-zh-scale))');
  const speaker = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  speaker.setAttribute('d', 'M4 10v4h4l5 4V6l-5 4H4Z');
  const wave = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  wave.setAttribute('d', 'M16 9.5a4 4 0 0 1 0 5');
  icon.append(speaker, wave);
  parent.appendChild(icon);
}

function appendStarIcon(document: Document, parent: Element, filled: boolean): void {
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('focusable', 'false');
  icon.setAttribute('width', '20');
  icon.setAttribute('height', '20');
  icon.setAttribute('fill', filled ? 'currentColor' : 'none');
  icon.setAttribute('stroke', 'currentColor');
  icon.setAttribute('stroke-width', '1.6');
  icon.setAttribute('stroke-linejoin', 'round');
  icon.style.setProperty('width', 'calc(20px * var(--hltv-zh-scale))');
  icon.style.setProperty('height', 'calc(20px * var(--hltv-zh-scale))');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'm12 3 2.78 5.63 6.22.9-4.5 4.39 1.06 6.2L12 17.2l-5.56 2.92 1.06-6.2L3 9.53l6.22-.9L12 3Z');
  icon.appendChild(path);
  parent.appendChild(icon);
}

function speakWord(document: Document, word: string, language: 'en-GB' | 'en-US'): void {
  const view = document.defaultView;
  if (view === null || typeof view.speechSynthesis?.speak !== 'function' || typeof view.SpeechSynthesisUtterance !== 'function') {
    return;
  }
  view.speechSynthesis.cancel();
  const utterance = new view.SpeechSynthesisUtterance(word);
  utterance.lang = language;
  utterance.rate = 0.86;
  view.speechSynthesis.speak(utterance);
}

function appendSpeakerButton(
  document: Document,
  parent: Element,
  word: string,
  language: 'en-GB' | 'en-US',
  label: string
): void {
  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-label', `${label}发音`);
  setStyles(button, {
    border: '0',
    padding: '0',
    backgroundColor: 'transparent',
    color: '#8e8e93',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center'
  });
  appendSpeakerIcon(document, button);
  button.addEventListener('click', () => speakWord(document, word, language));
  parent.appendChild(button);
}

function installIconButtonHover(button: HTMLElement): void {
  const idle = 'rgba(118, 118, 128, 0.08)';
  const hover = 'rgba(118, 118, 128, 0.16)';
  setStyles(button, {
    backgroundColor: idle,
    borderRadius: '50%',
    transition: 'background-color 120ms ease, transform 120ms ease'
  });
  button.addEventListener('mouseenter', () => {
    setStyles(button, { backgroundColor: hover, transform: 'scale(1.03)' });
  });
  button.addEventListener('mouseleave', () => {
    setStyles(button, { backgroundColor: idle, transform: 'scale(1)' });
  });
}

function positionResultPopover(
  popover: HTMLElement,
  anchorRect: DOMRect | undefined,
  document: Document
): void {
  if (anchorRect === undefined) {
    return;
  }
  const view = document.defaultView;
  const viewportWidth = view?.innerWidth ?? 1024;
  const viewportHeight = view?.innerHeight ?? 768;
  const cardWidth = Math.min(460, viewportWidth - 32);
  const left = Math.min(
    Math.max(anchorRect.left, 16),
    Math.max(16, viewportWidth - cardWidth - 16)
  );
  const estimatedHeight = Math.min(390, viewportHeight - 32);
  const below = anchorRect.bottom + 10;
  const top = below + estimatedHeight <= viewportHeight - 16
    ? below
    : Math.max(16, anchorRect.top - estimatedHeight - 10);
  setStyles(popover, {
    left: `${left}px`,
    top: `${top}px`,
    right: 'auto',
    bottom: 'auto',
    maxHeight: `calc(100vh - 32px)`,
    overflowY: 'auto'
  });
}

function updatePopoverScale(popover: HTMLElement, fontScale: number): void {
  const width = popover.getBoundingClientRect().width;
  const scale = Math.max(0.72, Math.min(1.18, (width / 440) * clampFontScale(fontScale)));
  popover.style.setProperty('--hltv-zh-scale', scale.toFixed(3));
}

function installSelectionCardScaling(
  popover: HTMLElement,
  appearance: { fontScale: number }
): ResizeObserver | undefined {
  const updateScale = (): void => updatePopoverScale(popover, appearance.fontScale);
  updateScale();
  if (typeof ResizeObserver === 'undefined') {
    return undefined;
  }
  const observer = new ResizeObserver(updateScale);
  observer.observe(popover);
  return observer;
}

function mountSelectionPopover(
  document: Document,
  body: HTMLElement,
  popover: HTMLElement,
  appearance: { fontScale: number }
): void {
  body.appendChild(popover);
  const observer = installSelectionCardScaling(popover, appearance);
  document.defaultView?.setTimeout(() => {
    observer?.disconnect();
    if (popover.parentElement !== null) {
      popover.remove();
    }
  }, 12000);
}

export function selectionFailureMessage(
  errorCode: TranslateFailureCode | undefined
): string | undefined {
  switch (errorCode) {
    case 'disabled':
      return '插件翻译已关闭，请先打开插件。';
    case 'settings-failure':
      return '翻译服务设置无法读取，请重新打开插件设置。';
    case 'provider-failure':
      return '翻译服务请求失败，请检查 API 地址、密钥和网络权限。';
    case 'provider-timeout':
      return '翻译服务响应超时，请检查网络或稍后重试。';
    case 'invalid-response':
      return '翻译服务返回格式无效，请检查模型或响应格式设置。';
    default:
      return undefined;
  }
}

function showSelectionTranslation(
  document: Document,
  original: string,
  translated: string,
  errorCode?: TranslateFailureCode,
  anchorRect?: DOMRect,
  onSearch?: (text: string) => void,
  purpose: SelectionPurpose = 'dictionary',
  dictionaryStore?: {
    recordHistory(entry: DictionaryEntry): Promise<void>;
    isFavorite(query: string): Promise<boolean>;
    toggleFavorite(entry: DictionaryEntry): Promise<boolean>;
  },
  appearance: { theme: ThemeMode; fontScale: number } = { theme: 'system', fontScale: 1 },
  appearanceStore?: { set(values: Record<string, unknown>): Promise<void> }
): void {
  const body = document.body;
  if (body === null) {
    return;
  }
  document.querySelector('[data-hltv-zh-selection-result]')?.remove();

  const popover = document.createElement('aside');
  popover.setAttribute('data-hltv-zh-selection-result', '1');
  popover.setAttribute('data-hltv-zh-selection-ui', '1');
  popover.setAttribute('role', 'status');
  popover.style.setProperty('--hltv-zh-scale', '1');
  const applyCardTheme = (theme: ThemeMode): void => {
    const dark = theme === 'dark' || (
      theme === 'system' &&
      document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)').matches === true
    );
    popover.style.setProperty('--hltv-zh-card-text', dark ? '#f5f5f7' : '#1d1d1f');
    popover.style.setProperty('--hltv-zh-card-muted', dark ? '#a1a1a6' : '#6e6e73');
    popover.style.setProperty('--hltv-zh-card-control', dark ? '#a1a1a6' : '#86868b');
    popover.style.setProperty('--hltv-zh-card-surface', dark ? 'rgba(28, 28, 30, 0.97)' : 'rgba(255, 255, 255, 0.96)');
    popover.style.setProperty('background-color', dark ? 'rgba(28, 28, 30, 0.97)' : 'rgba(255, 255, 255, 0.96)');
    popover.style.setProperty('color', 'var(--hltv-zh-card-text)');
  };
  applyCardTheme(appearance.theme);
  setStyles(popover, {
    position: 'fixed',
    right: '16px',
    bottom: '16px',
    zIndex: '2147483647',
    width: 'min(440px, calc(100vw - 28px))',
    minWidth: '300px',
    minHeight: '180px',
    maxWidth: 'calc(100vw - 28px)',
    maxHeight: 'calc(100vh - 28px)',
    resize: 'both',
    overflow: 'auto',
    boxSizing: 'border-box',
    padding: 'calc(20px * var(--hltv-zh-scale)) calc(22px * var(--hltv-zh-scale)) calc(22px * var(--hltv-zh-scale))',
    border: '1px solid rgba(60, 60, 67, 0.18)',
    borderRadius: '16px',
    backgroundColor: 'var(--hltv-zh-card-surface)',
    color: 'var(--hltv-zh-card-text)',
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.14), 0 2px 8px rgba(0, 0, 0, 0.08)',
    backdropFilter: 'blur(20px) saturate(180%)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, "Microsoft YaHei", sans-serif',
    fontSize: 'calc(15px * var(--hltv-zh-scale))',
    lineHeight: '1.5'
  });

  const header = document.createElement('div');
  setStyles(header, {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 'calc(12px * var(--hltv-zh-scale))',
    alignItems: 'center',
    minHeight: 'calc(38px * var(--hltv-zh-scale))'
  });
  const title = document.createElement('input');
  title.type = 'text';
  title.value = original;
  title.setAttribute('aria-label', '编辑要查询的单词或短语');
  setStyles(title, {
    minWidth: '0',
    flex: '1',
    border: '0',
    outline: '0',
    backgroundColor: 'transparent',
    color: 'var(--hltv-zh-card-text)',
    fontSize: 'calc(31px * var(--hltv-zh-scale))',
    lineHeight: '1.15',
    fontWeight: '500',
    letterSpacing: '-0.45px',
    wordBreak: 'break-word',
    padding: '0',
    fontFamily: 'inherit'
  });
  const controls = document.createElement('div');
  setStyles(controls, {
    display: 'flex',
    alignItems: 'center',
    gap: 'calc(4px * var(--hltv-zh-scale))'
  });
  const search = document.createElement('button');
  search.type = 'button';
  search.setAttribute('aria-label', '查询编辑后的单词');
  setStyles(search, {
    border: '0',
    background: 'transparent',
    color: 'var(--hltv-zh-card-control)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'calc(2px * var(--hltv-zh-scale))',
    width: 'calc(32px * var(--hltv-zh-scale))',
    height: 'calc(32px * var(--hltv-zh-scale))'
  });
  installIconButtonHover(search);
  appendSearchIcon(document, search, 20, true);
  const createCompactControl = (label: string, ariaLabel: string): HTMLButtonElement => {
    const control = document.createElement('button');
    control.type = 'button';
    control.textContent = label;
    control.setAttribute('aria-label', ariaLabel);
    setStyles(control, {
      border: '0',
      background: 'transparent',
      color: 'var(--hltv-zh-card-control)',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'calc(2px * var(--hltv-zh-scale))',
      minWidth: 'calc(26px * var(--hltv-zh-scale))',
      height: 'calc(30px * var(--hltv-zh-scale))',
      fontFamily: 'inherit',
      fontSize: 'calc(13px * var(--hltv-zh-scale))',
      fontWeight: '600'
    });
    installIconButtonHover(control);
    return control;
  };
  const fontDown = createCompactControl('A−', '减小字号');
  const fontUp = createCompactControl('A+', '增大字号');
  const themeButton = createCompactControl('◐', '切换词典卡片主题');
  const themeLabel = (theme: ThemeMode): string => theme === 'system' ? '系统' : theme === 'light' ? '浅色' : '深色';
  const updateThemeButton = (): void => {
    themeButton.textContent = appearance.theme === 'system' ? '◐' : appearance.theme === 'light' ? '☀' : '☾';
    themeButton.title = `当前主题：${themeLabel(appearance.theme)}，点击切换`;
  };
  const persistAppearance = (): void => {
    if (appearanceStore !== undefined) {
      void appearanceStore.set({
        theme: appearance.theme,
        fontScale: clampFontScale(appearance.fontScale)
      }).catch(() => {});
    }
  };
  fontDown.addEventListener('click', () => {
    appearance.fontScale = clampFontScale(appearance.fontScale - 0.05);
    updatePopoverScale(popover, appearance.fontScale);
    persistAppearance();
  });
  fontUp.addEventListener('click', () => {
    appearance.fontScale = clampFontScale(appearance.fontScale + 0.05);
    updatePopoverScale(popover, appearance.fontScale);
    persistAppearance();
  });
  themeButton.addEventListener('click', () => {
    appearance.theme = nextThemeMode(appearance.theme);
    applyCardTheme(appearance.theme);
    updateThemeButton();
    persistAppearance();
  });
  updateThemeButton();
  controls.append(fontDown, fontUp, themeButton);
  let favoriteButton: HTMLButtonElement | undefined;
  if (purpose === 'dictionary' && dictionaryStore !== undefined) {
    favoriteButton = document.createElement('button');
    favoriteButton.type = 'button';
    favoriteButton.setAttribute('aria-label', '收藏词典释义');
    setStyles(favoriteButton, {
      border: '0',
      background: 'transparent',
      color: 'var(--hltv-zh-card-control)',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'calc(2px * var(--hltv-zh-scale))',
      width: 'calc(32px * var(--hltv-zh-scale))',
      height: 'calc(32px * var(--hltv-zh-scale))'
    });
    installIconButtonHover(favoriteButton);
    appendStarIcon(document, favoriteButton, false);
    const updateFavorite = (isFavorite: boolean): void => {
      favoriteButton?.replaceChildren();
      if (favoriteButton !== undefined) {
        favoriteButton.style.color = isFavorite ? '#b8860b' : 'var(--hltv-zh-card-control)';
        favoriteButton.setAttribute('aria-label', isFavorite ? '取消收藏词典释义' : '收藏词典释义');
        appendStarIcon(document, favoriteButton, isFavorite);
      }
    };
    void dictionaryStore.isFavorite(original).then(updateFavorite).catch(() => {});
    favoriteButton.addEventListener('click', () => {
      const data = parseDictionaryTranslation(translated);
      const baseForm = data.baseForm ?? inferRegularPastBaseForm(original, data.definitions);
      const entry: DictionaryEntry = {
        query: original,
        translated,
        ...(baseForm === undefined ? {} : { baseForm }),
        englishMeaning: data.definitions.map((item) => item.englishMeaning).filter((item): item is string => item !== undefined).join('；'),
        savedAt: Date.now()
      };
      void dictionaryStore.toggleFavorite(entry).then(updateFavorite).catch(() => {});
    });
    controls.append(favoriteButton);
  }
  const close = document.createElement('button');
  close.type = 'button';
  close.setAttribute('aria-label', '关闭词典释义');
  setStyles(close, {
    border: '0',
    background: 'transparent',
    color: 'var(--hltv-zh-card-control)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'calc(2px * var(--hltv-zh-scale))',
    width: 'calc(32px * var(--hltv-zh-scale))',
    height: 'calc(32px * var(--hltv-zh-scale))'
  });
  installIconButtonHover(close);
  appendCloseIcon(document, close);
  close.addEventListener('click', () => popover.remove());
  const submitSearch = (): void => {
    const nextText = title.value.trim();
    if (nextText.length === 0 || onSearch === undefined) {
      return;
    }
    popover.remove();
    onSearch(nextText);
  };
  search.addEventListener('click', submitSearch);
  title.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitSearch();
    }
  });
  controls.append(search, close);
  header.append(title, controls);

  const divider = document.createElement('div');
  setStyles(divider, {
    height: '1px',
    backgroundColor: 'rgba(60, 60, 67, 0.18)',
    margin: 'calc(14px * var(--hltv-zh-scale)) 0 calc(14px * var(--hltv-zh-scale))'
  });

  const failure = selectionFailureMessage(errorCode);
  const fallback = translated === original ? '未找到中文释义，请检查翻译服务设置。' : translated;
  if (failure !== undefined || translated === original) {
    const result = document.createElement('div');
    result.textContent = failure ?? fallback;
    setStyles(result, {
      color: '#b35c00',
      fontSize: 'calc(16px * var(--hltv-zh-scale))',
      lineHeight: '1.6',
      wordBreak: 'break-word',
      whiteSpace: 'pre-wrap'
    });
    popover.append(header, divider, result);
    positionResultPopover(popover, anchorRect, document);
    mountSelectionPopover(document, body, popover, appearance);
    return;
  }

  if (purpose === 'sentence') {
    const result = document.createElement('div');
    result.textContent = translated;
    setStyles(result, {
      color: 'var(--hltv-zh-card-text)',
      fontSize: 'calc(20px * var(--hltv-zh-scale))',
      lineHeight: '1.55',
      wordBreak: 'break-word',
      whiteSpace: 'pre-wrap'
    });
    popover.append(header, divider, result);
    mountSelectionPopover(document, body, popover, appearance);
    return;
  }

  const data = parseDictionaryTranslation(translated);
  const baseForm = data.baseForm ?? inferRegularPastBaseForm(original, data.definitions);
  let baseNode: HTMLElement | undefined;
  if (baseForm !== undefined) {
    const base = document.createElement('div');
    setStyles(base, {
      color: 'var(--hltv-zh-card-muted)',
      fontSize: 'calc(15px * var(--hltv-zh-scale))',
      marginBottom: 'calc(10px * var(--hltv-zh-scale))'
    });
    const baseLabel = document.createElement('strong');
    baseLabel.textContent = '动词原形  ';
    const baseValue = document.createElement('span');
    baseValue.textContent = baseForm;
    setStyles(baseValue, { color: 'var(--hltv-zh-card-text)' });
    base.append(baseLabel, baseValue);
    baseNode = base;
  }
  if (data.ukPronunciation !== undefined || data.usPronunciation !== undefined) {
    const pronunciation = document.createElement('div');
    setStyles(pronunciation, {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 'calc(16px * var(--hltv-zh-scale))',
      color: 'var(--hltv-zh-card-muted)',
      fontSize: 'calc(15px * var(--hltv-zh-scale))',
      marginBottom: 'calc(8px * var(--hltv-zh-scale))'
    });
    for (const [label, value] of [
      ['英', data.ukPronunciation],
      ['美', data.usPronunciation]
    ] as const) {
      if (value === undefined) {
        continue;
      }
      const item = document.createElement('span');
      setStyles(item, {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'calc(4px * var(--hltv-zh-scale))'
      });
      const labelNode = document.createElement('span');
      labelNode.textContent = value.startsWith('/') && value.endsWith('/')
        ? `${label} ${value}`
        : `${label} /${value}/`;
      const speaker = document.createElement('span');
      setStyles(speaker, { color: 'var(--hltv-zh-card-control)', display: 'inline-flex' });
      appendSpeakerButton(document, speaker, original, label === '英' ? 'en-GB' : 'en-US', label);
      item.append(labelNode, speaker);
      pronunciation.appendChild(item);
    }
    popover.append(header, divider, pronunciation);
  } else {
    popover.append(header, divider);
  }
  if (baseNode !== undefined) {
    popover.appendChild(baseNode);
  }

  const definitions = document.createElement('div');
  setStyles(definitions, {
    display: 'grid',
    gap: 'calc(8px * var(--hltv-zh-scale))'
  });
  for (const definition of data.definitions) {
    const row = document.createElement('div');
    setStyles(row, {
      display: 'grid',
      gridTemplateColumns: 'calc(70px * var(--hltv-zh-scale)) 1fr',
      gap: 'calc(10px * var(--hltv-zh-scale))'
    });
    const partOfSpeech = document.createElement('span');
    partOfSpeech.textContent = `${definition.partOfSpeech}.`;
    setStyles(partOfSpeech, { color: 'var(--hltv-zh-card-muted)', fontWeight: '600', letterSpacing: '-0.1px' });
    const meaning = document.createElement('span');
    meaning.textContent = definition.meaning;
    setStyles(meaning, { color: 'var(--hltv-zh-card-text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', letterSpacing: '-0.05px' });
    row.append(partOfSpeech, meaning);
    if (definition.englishMeaning !== undefined) {
      const english = document.createElement('span');
      english.textContent = definition.englishMeaning;
      setStyles(english, {
        gridColumn: '2',
        color: 'var(--hltv-zh-card-muted)',
        fontSize: '0.9em',
        lineHeight: '1.4',
        fontStyle: 'italic'
      });
      row.appendChild(english);
    }
    definitions.appendChild(row);
  }
  popover.appendChild(definitions);
  if (data.networkMeaning !== undefined) {
    const network = document.createElement('div');
    network.textContent = `网络  ${data.networkMeaning}`;
    setStyles(network, {
      color: 'var(--hltv-zh-card-muted)',
      marginTop: 'calc(12px * var(--hltv-zh-scale))'
    });
    popover.appendChild(network);
  }
  positionResultPopover(popover, anchorRect, document);
  mountSelectionPopover(document, body, popover, appearance);
  if (dictionaryStore !== undefined) {
    const dataEntry: DictionaryEntry = {
      query: original,
      translated,
      ...(baseForm === undefined ? {} : { baseForm }),
      englishMeaning: data.definitions.map((item) => item.englishMeaning).filter((item): item is string => item !== undefined).join('；'),
      savedAt: Date.now()
    };
    void dictionaryStore.recordHistory(dataEntry).catch(() => {});
  }
}

function isSelectionUiNode(node: Node | null): boolean {
  const element = node?.nodeType === 1
    ? node as Element
    : node?.parentElement;
  if (element === null || element === undefined) {
    return false;
  }
  return element.closest('[data-hltv-zh-selection-ui]') !== null;
}

function selectionRange(document: Document): { text: string; rect: DOMRect } | undefined {
  const view = document.defaultView;
  const selection = view?.getSelection();
  if (selection === null || selection === undefined || selection.rangeCount === 0) {
    return undefined;
  }
  if (isSelectionUiNode(selection.anchorNode) || isSelectionUiNode(selection.focusNode)) {
    return undefined;
  }
  const text = selection.toString().trim();
  if (text.length === 0) {
    return undefined;
  }
  const rect = selection.getRangeAt(0).getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return undefined;
  }
  return { text, rect };
}

function positionMagnifier(button: HTMLElement, rect: DOMRect, document: Document): void {
  const view = document.defaultView;
  const viewportWidth = view?.innerWidth ?? 1024;
  const viewportHeight = view?.innerHeight ?? 768;
  const left = Math.min(Math.max(rect.right + 6, 8), viewportWidth - 36);
  const above = rect.top - 36;
  const top = above >= 8
    ? above
    : Math.min(rect.bottom + 6, viewportHeight - 36);
  setStyles(button, { left: `${left}px`, top: `${Math.max(8, top)}px` });
}

async function lookupSelection(
  document: Document,
  translator: ContextualTranslationAdapter & {
    translateWithContextDetailed?: (
      texts: string[],
      context: 'prose' | 'structured' | 'comment',
      purpose: TranslationPurpose
    ) => Promise<DetailedTranslationResult>;
  },
  text: string,
  anchorRect?: DOMRect,
  dictionaryStore?: {
    recordHistory(entry: DictionaryEntry): Promise<void>;
    isFavorite(query: string): Promise<boolean>;
    toggleFavorite(entry: DictionaryEntry): Promise<boolean>;
  },
  appearance: { theme: ThemeMode; fontScale: number } = { theme: 'system', fontScale: 1 },
  appearanceStore?: { set(values: Record<string, unknown>): Promise<void> }
): Promise<void> {
  const purpose = classifySelectionPurpose(text);
  const context = purpose === 'dictionary' ? 'structured' : 'prose';
  let result: DetailedTranslationResult;
  try {
    result = translator.translateWithContextDetailed === undefined
      ? {
          translations: await translator.translateWithContext(
            [text],
            context,
            purpose
          )
        }
      : await translator.translateWithContextDetailed(
          [text],
          context,
          purpose
        );
  } catch {
    result = { translations: [text], errorCode: 'provider-failure' };
  }
  showSelectionTranslation(
    document,
    text,
    result.translations[0] ?? text,
    result.errorCode,
    anchorRect,
    (nextText) => void lookupSelection(document, translator, nextText, anchorRect, dictionaryStore),
    purpose,
    dictionaryStore,
    appearance,
    appearanceStore
  );
}

export interface SelectionMagnifierController {
  setAppearance(appearance: { theme: ThemeMode; fontScale: number }): void;
}

export function installSelectionMagnifier(options: {
  document: Document;
  translator: ContextualTranslationAdapter & {
    translateWithContextDetailed?: (
      texts: string[],
      context: 'prose' | 'structured' | 'comment',
      purpose: TranslationPurpose
    ) => Promise<DetailedTranslationResult>;
  };
  dictionaryStore?: {
    recordHistory(entry: DictionaryEntry): Promise<void>;
    isFavorite(query: string): Promise<boolean>;
    toggleFavorite(entry: DictionaryEntry): Promise<boolean>;
  };
  appearance?: { theme: ThemeMode; fontScale: number };
  appearanceStore?: { set(values: Record<string, unknown>): Promise<void> };
}): SelectionMagnifierController | undefined {
  const { document, translator, dictionaryStore } = options;
  let appearance = options.appearance ?? { theme: 'system' as const, fontScale: 1 };
  const view = document.defaultView;
  if (view === null || view === undefined || document.body === null) {
    return undefined;
  }

  let button: HTMLButtonElement | undefined;
  let selectedText: string | undefined;
  let updateTimer: number | undefined;

  const removeButton = (): void => {
    if (button?.parentElement !== null && button?.parentElement !== undefined) {
      button.parentElement.removeChild(button);
    }
    button = undefined;
    selectedText = undefined;
  };

  const scheduleUpdate = (): void => {
    if (updateTimer !== undefined) {
      view.clearTimeout(updateTimer);
    }
    updateTimer = view.setTimeout(() => {
      updateTimer = undefined;
      const current = selectionRange(document);
      if (current === undefined) {
        removeButton();
        return;
      }
      removeButton();
      selectedText = current.text;
      button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', '查询选中文本的中文词典释义');
      button.setAttribute('title', '查询中文词典释义');
      button.setAttribute('data-hltv-zh-selection-ui', '1');
      setStyles(button, {
        position: 'fixed',
        width: '28px',
        height: '28px',
        padding: '0',
        border: '1px solid rgba(60, 60, 67, 0.24)',
        borderRadius: '50%',
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        color: '#1d1d1f',
        cursor: 'pointer',
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.16), 0 1px 4px rgba(0, 0, 0, 0.08)',
        backdropFilter: 'blur(16px) saturate(180%)',
        zIndex: '2147483647',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center'
      });
      installIconButtonHover(button);
      appendSearchIcon(document, button, 17);
      positionMagnifier(button, current.rect, document);
      button.addEventListener('mousedown', (event) => event.preventDefault());
      button.addEventListener('click', () => {
        const text = selectedText;
        removeButton();
        if (text !== undefined) {
          void lookupSelection(document, translator, text, current.rect, dictionaryStore, appearance, options.appearanceStore);
        }
      });
      document.body?.appendChild(button);
    }, 0);
  };

  document.addEventListener('selectionchange', scheduleUpdate, true);
  document.addEventListener('mouseup', scheduleUpdate, true);
  document.addEventListener('keyup', scheduleUpdate, true);
  document.addEventListener('mousedown', (event) => {
    if (!isSelectionUiNode(event.target as Node | null)) {
      removeButton();
    }
  }, true);
  return {
    setAppearance(next) {
      appearance = {
        theme: next.theme,
        fontScale: Math.max(0.8, Math.min(1.25, next.fontScale))
      };
    }
  };
}
