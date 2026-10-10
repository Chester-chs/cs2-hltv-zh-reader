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
  clampFontScale,
  canTranslateSelection,
  classifySelectionPurpose,
  inferRegularPastBaseForm,
  nextThemeMode,
  parseDictionaryTranslation,
  shouldShowBaseForm,
  selectionFailureMessage
} from '../src/content/selection-translation.ts';
import { createBackgroundTranslationService } from '../src/content/background-translator.ts';
import { encodeTranslateResponse } from '../src/background/protocol.ts';

test('selection translation exposes actionable provider failure messages', () => {
  assert.equal(selectionFailureMessage('disabled'), '插件翻译已关闭，请先打开插件。');
  assert.equal(selectionFailureMessage('provider-failure'), '翻译服务请求失败，请检查 API 地址、密钥和网络权限。');
  assert.equal(selectionFailureMessage('provider-timeout'), '翻译服务响应超时，请检查网络或稍后重试。');
  assert.equal(selectionFailureMessage('invalid-response'), '翻译服务返回格式无效，请检查模型或响应格式设置。');
  assert.equal(selectionFailureMessage(undefined), undefined);
});

test('dictionary translation parser preserves pronunciations, parts of speech, and network meaning', () => {
  const result = parseDictionaryTranslation(
    '动词原形：bench；英式音标：/bent/；美式音标：/bɛnt/；形容词：被安排替补；动词：让……坐替补席；网络：冷板凳'
  );
  assert.deepEqual(result, {
    baseForm: 'bench',
    ukPronunciation: '/bent/',
    usPronunciation: '/bɛnt/',
    definitions: [
      { partOfSpeech: 'adj.', meaning: '被安排替补' },
      { partOfSpeech: 'v.', meaning: '让……坐替补席' }
    ],
    networkMeaning: '冷板凳'
  });
});

test('dictionary parser keeps Oxford-style Chinese and English explanations together', () => {
  assert.deepEqual(
    parseDictionaryTranslation('动词：把人换下场 || to replace a player during a game'),
    {
      definitions: [{
        partOfSpeech: 'v.',
        meaning: '把人换下场',
        englishMeaning: 'to replace a player during a game'
      }]
    }
  );
});

test('dictionary parser normalizes provider labels and Oxford difficulty', () => {
  assert.deepEqual(
    parseDictionaryTranslation('词性：动词；中文释义：宣布；宣告；公布；concise English definition：to make a public statement；Oxford/CEFR 难度：B1；网络：官宣'),
    {
      difficulty: 'B1',
      definitions: [{
        partOfSpeech: 'v.',
        meaning: '宣布；宣告；公布',
        englishMeaning: 'to make a public statement'
      }],
      networkMeaning: '官宣'
    }
  );
});

test('dictionary parser keeps inflected verb forms as separate Oxford-style rows', () => {
  assert.deepEqual(
    parseDictionaryTranslation('形容词：明确的；动词过去式：决定；动词过去分词：决定；副词：坚决地'),
    {
      definitions: [
        { partOfSpeech: 'adj.', meaning: '明确的' },
        { partOfSpeech: 'v.（过去式）', meaning: '决定' },
        { partOfSpeech: 'v.（过去分词）', meaning: '决定' },
        { partOfSpeech: 'adv.', meaning: '坚决地' }
      ]
    }
  );
});

test('dictionary parser recognizes combined past-tense labels as a peer definition', () => {
  assert.deepEqual(
    parseDictionaryTranslation('形容词：果断的 || clear and definite；动词过去式 / 过去分词：决定，解决 || past tense and past participle'),
    {
      definitions: [
        { partOfSpeech: 'adj.', meaning: '果断的', englishMeaning: 'clear and definite' },
        { partOfSpeech: 'v.（过去式/过去分词）', meaning: '决定，解决', englishMeaning: 'past tense and past participle' }
      ]
    }
  );
});

test('dictionary parser preserves Oxford difficulty, pinyin, and examples', () => {
  assert.deepEqual(
    parseDictionaryTranslation('拼音：bent；难度：B1；动词：弯曲 || to make something not straight；例句：He bent the wire.'),
    {
      pinyin: 'bent',
      difficulty: 'B1',
      definitions: [{
        partOfSpeech: 'v.',
        meaning: '弯曲',
        englishMeaning: 'to make something not straight'
      }],
      examples: ['He bent the wire.']
    }
  );
});

test('selection purpose uses dictionary for one word and sentence translation otherwise', () => {
  assert.equal(classifySelectionPurpose('benched'), 'dictionary');
  assert.equal(classifySelectionPurpose('Sashi benched the player.'), 'sentence');
  assert.equal(classifySelectionPurpose(''), 'sentence');
  assert.equal(classifySelectionPurpose('替补'), 'dictionary');
});

test('Chinese-only lookup does not offer reverse Chinese lookup for any stored audience', () => {
  assert.equal(canTranslateSelection('bench', 'zh-CN'), true);
  assert.equal(canTranslateSelection('替补', 'zh-CN'), false);
  assert.equal(canTranslateSelection('替补', null), false);
  assert.equal(canTranslateSelection('替补', 'en'), false);
});

test('dictionary-card appearance controls cycle themes and clamp font scale', () => {
  assert.equal(nextThemeMode('system'), 'light');
  assert.equal(nextThemeMode('light'), 'dark');
  assert.equal(nextThemeMode('dark'), 'system');
  assert.equal(clampFontScale(0.2), 0.8);
  assert.equal(clampFontScale(1.1), 1.1);
  assert.equal(clampFontScale(4), 1.25);
});

test('dictionary translation parser keeps unlabelled provider text readable', () => {
  assert.deepEqual(parseDictionaryTranslation('替补；坐冷板凳'), {
    definitions: [{ partOfSpeech: '释义', meaning: '替补；坐冷板凳' }]
  });
});

test('regular past-form fallback omits unverified base forms when the provider omits them', () => {
  assert.equal(
    inferRegularPastBaseForm('benched', [{ partOfSpeech: 'v.', meaning: '让……坐替补席' }]),
    undefined
  );
  assert.equal(
    inferRegularPastBaseForm('stopped', [{ partOfSpeech: 'v.', meaning: '停止' }]),
    undefined
  );
});

test('verb base form is shown only for an inflected selection', () => {
  assert.equal(shouldShowBaseForm('announced', 'announce'), true);
  assert.equal(shouldShowBaseForm('announce', 'announce'), false);
});

test('selection translation uses structured context so a single word reaches the provider', async () => {
  let requestContext: unknown;
  let requestPurpose: unknown;
  const translator = createBackgroundTranslationService({
    sendMessage: async (request) => {
      requestContext = request.context;
      requestPurpose = request.purpose;
      return encodeTranslateResponse({
        type: 'hltv-zh-translate-response',
        requestId: request.requestId,
        purpose: request.purpose,
        ok: true,
        translations: ['替补']
      });
    }
  });
  const result = await translator.translateWithContextDetailed(
    ['benched'],
    'structured',
    'dictionary'
  );
  assert.equal(requestContext, 'structured');
  assert.equal(requestPurpose, 'dictionary');
  assert.deepEqual(result, { translations: ['替补'] });
});
