import { parseProviderBaseURL } from '../shared/provider-url.ts';
import type { ExtensionSettings } from '../shared/settings.ts';
import type { ExtensionSettingsStorage } from './settings.ts';
import { loadSettings } from './settings.ts';

export interface ProviderPermissionDiagnostic {
  code: 'provider-permission-missing' | 'provider-settings-check-failed';
  origin?: string;
}

export interface ProviderPermissionDetails {
  origins?: string[];
  permissions?: string[];
}

export interface ProviderPermissionEvent {
  addListener(
    listener: (details: ProviderPermissionDetails) => void | Promise<void>
  ): void;
}

export interface ProviderPermissionApi {
  contains(details: { origins: string[] }): Promise<boolean>;
  onAdded: ProviderPermissionEvent;
  onRemoved: ProviderPermissionEvent;
}

export interface ProviderStorageChangeEvent {
  addListener(
    listener: (
      changes: Record<string, unknown>,
      areaName: string
    ) => void | Promise<void>
  ): void;
}

export interface ProviderPermissionMonitorOptions {
  storage: ExtensionSettingsStorage;
  storageChanges: ProviderStorageChangeEvent;
  permissions: ProviderPermissionApi;
  onDiagnostic(diagnostic: ProviderPermissionDiagnostic | undefined): void;
}

export interface ProviderPermissionMonitor {
  install(): void;
  checkSavedSettings(): Promise<boolean>;
  hasProviderPermission(settings: ExtensionSettings): Promise<boolean>;
}

const extensionSettingKeys = new Set([
  'enabled',
  'mode',
  'providerPreset',
  'baseURL',
  'model',
  'apiKey',
  'useJsonOutputMode',
  'fallbackEnabled',
  'fallbackBaseURL',
  'fallbackModel',
  'fallbackApiKey'
]);

function sameDiagnostic(
  left: ProviderPermissionDiagnostic | undefined,
  right: ProviderPermissionDiagnostic | undefined
): boolean {
  return left?.code === right?.code && left?.origin === right?.origin;
}

export function createProviderPermissionMonitor(
  options: ProviderPermissionMonitorOptions
): ProviderPermissionMonitor {
  let currentDiagnostic: ProviderPermissionDiagnostic | undefined;
  let latestCheckId = 0;

  function publishDiagnostic(
    diagnostic: ProviderPermissionDiagnostic | undefined
  ): void {
    if (sameDiagnostic(currentDiagnostic, diagnostic)) {
      return;
    }
    currentDiagnostic = diagnostic;
    options.onDiagnostic(diagnostic);
  }

  async function hasProviderPermission(
    settings: ExtensionSettings
  ): Promise<boolean> {
    const parsed = parseProviderBaseURL(settings.baseURL);
    if (parsed === undefined) {
      return false;
    }
    try {
      return await options.permissions.contains({
        origins: [parsed.permissionPattern]
      });
    } catch {
      return false;
    }
  }

  async function checkSavedSettings(): Promise<boolean> {
    const checkId = ++latestCheckId;
    const isCurrentCheck = (): boolean => checkId === latestCheckId;

    try {
      const settings = await loadSettings(options.storage);
      if (!isCurrentCheck()) {
        return false;
      }

      const parsed = parseProviderBaseURL(settings.baseURL);
      if (parsed === undefined) {
        publishDiagnostic({ code: 'provider-settings-check-failed' });
        return false;
      }

      const granted = await hasProviderPermission(settings);
      if (!isCurrentCheck()) {
        return false;
      }

      if (granted) {
        publishDiagnostic(undefined);
        return true;
      }

      publishDiagnostic({
        code: 'provider-permission-missing',
        origin: parsed.origin
      });
      return false;
    } catch {
      if (isCurrentCheck()) {
        publishDiagnostic({ code: 'provider-settings-check-failed' });
      }
      return false;
    }
  }

  async function checkWhenPermissionChanges(
    details: ProviderPermissionDetails
  ): Promise<void> {
    if (details.origins !== undefined) {
      try {
        const settings = await loadSettings(options.storage);
        const parsed = parseProviderBaseURL(settings.baseURL);
        if (
          parsed !== undefined &&
          !details.origins.includes(parsed.permissionPattern)
        ) {
          return;
        }
      } catch {
        // Run the regular check so settings read failures become visible state.
      }
    }
    await checkSavedSettings();
  }

  return {
    install() {
      options.storageChanges.addListener(async (changes, areaName) => {
        if (
          areaName !== 'local' ||
          !Object.keys(changes).some((key) => extensionSettingKeys.has(key))
        ) {
          return;
        }
        await checkSavedSettings();
      });

      options.permissions.onAdded.addListener((details) => {
        return checkWhenPermissionChanges(details);
      });

      options.permissions.onRemoved.addListener((details) => {
        return checkWhenPermissionChanges(details);
      });
    },
    checkSavedSettings,
    hasProviderPermission
  };
}
