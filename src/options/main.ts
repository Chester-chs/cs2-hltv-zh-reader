import browser from 'webextension-polyfill';
import { createIndexedDbCacheStore } from '../background/cache-store.ts';
import { loadSettings, type ExtensionSettingsStorage } from '../background/settings.ts';
import {
  PROVIDER_PRESETS,
  type ExtensionSettings,
  type ProviderPreset
} from '../shared/settings.ts';
import {
  authorizeProviderOrigin,
  getProviderPermissionStatus,
  saveOptionsSettings,
  type OptionalHostPermissions,
  type OptionsSettingsStorage
} from './settings-service.ts';
import { testProviderConnection } from './connection-test.ts';

const storage = browser.storage.local as unknown as ExtensionSettingsStorage & OptionsSettingsStorage;
const permissions = browser.permissions as unknown as OptionalHostPermissions & {
  onAdded: { addListener(listener: () => void): void };
  onRemoved: { addListener(listener: () => void): void };
};

const enabledInput = document.querySelector<HTMLInputElement>('#enabled')!;
const modeInput = document.querySelector<HTMLSelectElement>('#mode')!;
const presetInput = document.querySelector<HTMLSelectElement>('#provider-preset')!;
const baseURLInput = document.querySelector<HTMLInputElement>('#base-url')!;
const modelInput = document.querySelector<HTMLInputElement>('#model')!;
const apiKeyInput = document.querySelector<HTMLInputElement>('#api-key')!;
const jsonOutputInput = document.querySelector<HTMLInputElement>('#json-output')!;
const permissionStatus = document.querySelector<HTMLParagraphElement>('#permission-status')!;
const authorizeButton = document.querySelector<HTMLButtonElement>('#authorize')!;
const statusLine = document.querySelector<HTMLParagraphElement>('#status')!;
const saveButton = document.querySelector<HTMLButtonElement>('#save')!;
const testButton = document.querySelector<HTMLButtonElement>('#test-connection')!;
const clearButton = document.querySelector<HTMLButtonElement>('#clear-cache')!;
const toggleKeyButton = document.querySelector<HTMLButtonElement>('#toggle-key')!;
const cacheStore = createIndexedDbCacheStore();

let permissionCheckId = 0;

function readDraft(): ExtensionSettings {
  return {
    enabled: enabledInput.checked,
    mode: modeInput.value === 'B' ? 'B' : 'A',
    providerPreset: presetInput.value as ProviderPreset,
    baseURL: baseURLInput.value.trim(),
    model: modelInput.value.trim(),
    apiKey: apiKeyInput.value,
    useJsonOutputMode: jsonOutputInput.checked
  };
}

function renderSettings(settings: ExtensionSettings): void {
  enabledInput.checked = settings.enabled;
  modeInput.value = settings.mode;
  presetInput.value = settings.providerPreset;
  baseURLInput.value = settings.baseURL;
  baseURLInput.readOnly = settings.providerPreset !== 'custom';
  modelInput.value = settings.model;
  apiKeyInput.value = settings.apiKey;
  jsonOutputInput.checked = settings.useJsonOutputMode;
}

function missingPermissionText(origin: string): string {
  return `未授权访问 ${origin}，翻译将无法工作。`;
}

async function refreshPermissionStatus(): Promise<void> {
  const currentCheckId = ++permissionCheckId;
  const status = await getProviderPermissionStatus(baseURLInput.value, permissions);
  if (currentCheckId !== permissionCheckId) {
    return;
  }

  if (status.state === 'granted') {
    permissionStatus.textContent = `已授权：${status.origin}`;
    authorizeButton.hidden = true;
  } else if (status.state === 'missing') {
    permissionStatus.textContent = `当前配置缺少权限：${status.origin}`;
    authorizeButton.hidden = false;
  } else if (status.state === 'invalid') {
    permissionStatus.textContent = '请输入有效的 HTTPS 或回环 HTTP baseURL。';
    authorizeButton.hidden = true;
  } else {
    permissionStatus.textContent = '无法读取当前域名权限状态。';
    authorizeButton.hidden = true;
  }
}

function connectionFailureMessage(reason: string, status?: number): string {
  switch (reason) {
    case 'permission':
      return '当前配置缺少权限，请先点击“授权”。';
    case 'timeout':
      return '连接测试超时，请检查服务商响应时间。';
    case 'unauthorized':
      return `连接失败：HTTP ${status ?? 401}，身份验证未通过。`;
    case 'network':
      return '网络不可达，请检查网络和服务商地址。';
    case 'response-format-unsupported':
      return '服务商不支持 response_format。请取消勾选“使用 JSON 输出模式”后重试。';
    case 'http-error':
      return `连接失败：服务商返回 HTTP ${status ?? '错误'}。`;
    case 'invalid-response':
      return '服务商返回了无法识别的响应。';
    default:
      return '请填写有效的 HTTPS 或回环 HTTP baseURL。';
  }
}

function applyPreset(): void {
  const preset = presetInput.value as ProviderPreset;
  baseURLInput.readOnly = preset !== 'custom';
  if (preset === 'deepseek' || preset === 'openai') {
    baseURLInput.value = PROVIDER_PRESETS[preset].baseURL;
    modelInput.value = PROVIDER_PRESETS[preset].model;
  }
  void refreshPermissionStatus();
}

presetInput.addEventListener('change', applyPreset);
baseURLInput.addEventListener('input', () => void refreshPermissionStatus());

toggleKeyButton.addEventListener('click', () => {
  const show = apiKeyInput.type === 'password';
  apiKeyInput.type = show ? 'text' : 'password';
  toggleKeyButton.textContent = show ? '隐藏' : '显示';
});

authorizeButton.addEventListener('click', async () => {
  authorizeButton.disabled = true;
  const result = await authorizeProviderOrigin(baseURLInput.value, permissions);
  authorizeButton.disabled = false;
  if (result.state === 'granted') {
    statusLine.textContent = `已授权 ${result.origin}。`;
  } else if (result.state === 'denied' && result.origin !== undefined) {
    statusLine.textContent = missingPermissionText(result.origin);
  } else {
    statusLine.textContent = '授权未完成，请检查 baseURL 后重试。';
  }
  await refreshPermissionStatus();
});

document.querySelector<HTMLFormElement>('#settings-form')!.addEventListener(
  'submit',
  async (event) => {
    event.preventDefault();
    saveButton.disabled = true;
    const result = await saveOptionsSettings(readDraft(), storage, permissions);
    saveButton.disabled = false;

    if (result.ok) {
      statusLine.textContent = '设置已保存。';
      await refreshPermissionStatus();
      return;
    }

    if (result.reason === 'permission-denied' && result.origin !== undefined) {
      statusLine.textContent = missingPermissionText(result.origin);
    } else if (result.reason === 'invalid-base-url') {
      statusLine.textContent = '请填写有效的 HTTPS 或回环 HTTP baseURL。';
    } else {
      statusLine.textContent = '设置未保存，请检查权限状态后重试。';
    }
    await refreshPermissionStatus();
  }
);

testButton.addEventListener('click', async () => {
  testButton.disabled = true;
  statusLine.textContent = '正在测试连接…';
  const result = await testProviderConnection(readDraft(), permissions);
  testButton.disabled = false;
  statusLine.textContent = result.ok
    ? '连接成功。'
    : connectionFailureMessage(result.reason, result.status);
});

clearButton.addEventListener('click', async () => {
  clearButton.disabled = true;
  try {
    const deletedCount = await cacheStore.clear();
    statusLine.textContent = `已清除 ${deletedCount} 条翻译缓存。`;
  } catch {
    statusLine.textContent = '清空翻译缓存失败，请稍后重试。';
  } finally {
    clearButton.disabled = false;
  }
});

permissions.onAdded.addListener(() => void refreshPermissionStatus());
permissions.onRemoved.addListener(() => void refreshPermissionStatus());

void (async () => {
  try {
    renderSettings(await loadSettings(storage));
  } catch {
    renderSettings({
      enabled: true,
      mode: 'A',
      providerPreset: 'deepseek',
      baseURL: PROVIDER_PRESETS.deepseek.baseURL,
      model: PROVIDER_PRESETS.deepseek.model,
      apiKey: '',
      useJsonOutputMode: true
    });
    statusLine.textContent = '设置读取失败，已显示默认值。';
  }
  await refreshPermissionStatus();
})();
