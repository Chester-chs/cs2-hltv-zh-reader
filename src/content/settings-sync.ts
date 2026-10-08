import type { DisplayMode } from '../shared/settings.ts';
import type { ContentScanOptions } from './runtime.ts';

export interface LiveContentSettingsRuntime {
  setEnabled(
    enabled: boolean,
    options?: { rescan?: boolean }
  ): Promise<void>;
  setMode(mode: DisplayMode, options?: { rescan?: boolean }): Promise<void>;
  requestScan(options?: ContentScanOptions): Promise<void>;
}

export interface ContentSettingsChange {
  newValue?: unknown;
}

export type ContentSettingKey =
  | 'enabled'
  | 'mode'
  | 'providerPreset'
  | 'baseURL'
  | 'model'
  | 'apiKey'
  | 'useJsonOutputMode'
  | 'theme'
  | 'fontScale'
  | 'permissionRevision';

export type ContentSettingsChanges = Partial<
  Record<ContentSettingKey, ContentSettingsChange>
>;

const providerSettingKeys: readonly ContentSettingKey[] = [
  'providerPreset',
  'baseURL',
  'model',
  'apiKey',
  'useJsonOutputMode'
];

export async function applyContentSettingsChanges(
  runtime: LiveContentSettingsRuntime,
  changes: ContentSettingsChanges
): Promise<void> {
  const requestedEnabled = changes.enabled?.newValue;
  const requestedMode = changes.mode?.newValue;
  let enabled: boolean | undefined;
  let hasModeChange = false;
  const hasProviderChange = providerSettingKeys.some((key) =>
    Object.hasOwn(changes, key)
  );
  const hasPermissionRecovery = Object.hasOwn(changes, 'permissionRevision');

  if (Object.hasOwn(changes, 'enabled') && typeof requestedEnabled === 'boolean') {
    enabled = requestedEnabled;
    await runtime.setEnabled(requestedEnabled, { rescan: false });
  }
  if (
    Object.hasOwn(changes, 'mode') &&
    (requestedMode === 'A' || requestedMode === 'B')
  ) {
    hasModeChange = true;
    await runtime.setMode(requestedMode, { rescan: false });
  }

  const hasEnabledChange = enabled !== undefined;
  if (
    enabled === false ||
    (!hasEnabledChange && !hasModeChange && !hasProviderChange && !hasPermissionRecovery)
  ) {
    return;
  }

  await runtime.requestScan({
    retryFailedTranslations: true,
    refreshTranslations: hasProviderChange || hasPermissionRecovery,
    reapplyRecords: hasModeChange
  });
}
