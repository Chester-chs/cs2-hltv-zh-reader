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
  classifySelectionPurpose,
  inferRegularPastBaseForm,
  nextThemeMode,
  parseDictionaryTranslation,
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
      { partOfSpeech: '形容词', meaning: '被安排替补' },
      { partOfSpeech: '动词', meaning: '让……坐替补席' }
    ],
    networkMeaning: '冷板凳'
  });
});

test('dictionary parser keeps Oxford-style Chinese and English explanations together', () => {
  assert.deepEqual(
    parseDictionaryTranslation('动词：把人换下场 || to replace a player during a game'),
    {
      definitions: [{
        partOfSpeech: '动词',
        meaning: '把人换下场',
        englishMeaning: 'to replace a player during a game'
      }]
    }
  );
});

test('selection purpose uses dictionary for one word and sentence translation otherwise', () => {
  assert.equal(classifySelectionPurpose('benched'), 'dictionary');
  assert.equal(classifySelectionPurpose('Sashi benched the player.'), 'sentence');
  assert.equal(classifySelectionPurpose(''), 'sentence');
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

test('regular past-form fallback derives a verb base form when the provider omits it', () => {
  assert.equal(
    inferRegularPastBaseForm('benched', [{ partOfSpeech: '动词', meaning: '让……坐替补席' }]),
    'bench'
  );
  assert.equal(
    inferRegularPastBaseForm('stopped', [{ partOfSpeech: '动词', meaning: '停止' }]),
    'stop'
  );
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
