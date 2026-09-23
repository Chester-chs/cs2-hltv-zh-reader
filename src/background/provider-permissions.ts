import { parseProviderBaseURL } from '../shared/provider-url.ts';
import type { ExtensionSettings } from '../shared/settings.ts';
import type { ExtensionSettingsStorage } from './settings.ts';
import { loadSettings } from './settings.ts';

export interface ProviderPermissionDiagnostic {
  code: 'provider-permission-missing' | 'provider-settings-check-failed';
  origin?: string;
}

export interface ProviderPermissionApi {
  contains(details: { origins: string[] }): Promise<boolean>;
  onRemoved: {
    addListener(
      listener: (details: { origins?: string[] }) => void | Promise<void>
    ): void;
  };
}

export interface ProviderPermissionMonitorOptions {
  storage: ExtensionSettingsStorage;
  permissions: ProviderPermissionApi;
  onDiagnostic(diagnostic: ProviderPermissionDiagnostic): void;
}

export interface ProviderPermissionMonitor {
  install(): void;
  checkSavedSettings(): Promise<boolean>;
  hasProviderPermission(settings: ExtensionSettings): Promise<boolean>;
}

export function createProviderPermissionMonitor(
  options: ProviderPermissionMonitorOptions
): ProviderPermissionMonitor {
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
    try {
      const settings = await loadSettings(options.storage);
      const parsed = parseProviderBaseURL(settings.baseURL);
      if (parsed === undefined) {
        options.onDiagnostic({ code: 'provider-settings-check-failed' });
        return false;
      }
      const granted = await hasProviderPermission(settings);
      if (!granted) {
        options.onDiagnostic({
          code: 'provider-permission-missing',
          origin: parsed.origin
        });
      }
      return granted;
    } catch {
      options.onDiagnostic({ code: 'provider-settings-check-failed' });
      return false;
    }
  }

  return {
    install() {
      options.permissions.onRemoved.addListener(async (details) => {
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
            // Run the regular check so a settings read failure is diagnosed.
          }
        }
        await checkSavedSettings();
      });
    },
    checkSavedSettings,
    hasProviderPermission
  };
}
