import {
  loadSettings,
  type ExtensionSettingsStorage
} from '../background/settings.ts';
import type { ProviderPermissionStatus } from '../options/settings-service.ts';
import { getProviderPermissionStatus } from '../options/settings-service.ts';
import type { DisplayMode } from '../shared/settings.ts';

export type PopupReadiness =
  | { kind: 'api-key-missing' }
  | { kind: 'permission-missing'; origin: string }
  | { kind: 'invalid-base-url' }
  | { kind: 'permission-unavailable' }
  | { kind: 'ready'; origin: string };

export interface PopupState {
  enabled: boolean;
  mode: DisplayMode;
  readiness: PopupReadiness;
}

export interface PopupPermissionReader {
  contains(details: { origins: string[] }): Promise<boolean>;
}

export function resolvePopupReadiness(
  apiKey: string,
  permission: ProviderPermissionStatus
): PopupReadiness {
  if (apiKey.trim().length === 0) {
    return { kind: 'api-key-missing' };
  }

  switch (permission.state) {
    case 'granted':
      return { kind: 'ready', origin: permission.origin };
    case 'missing':
      return { kind: 'permission-missing', origin: permission.origin };
    case 'invalid':
      return { kind: 'invalid-base-url' };
    case 'unavailable':
      return { kind: 'permission-unavailable' };
  }
}

export async function loadPopupState(
  storage: ExtensionSettingsStorage,
  permissions: PopupPermissionReader
): Promise<PopupState> {
  const settings = await loadSettings(storage);
  const permission = await getProviderPermissionStatus(
    settings.baseURL,
    permissions
  );

  return {
    enabled: settings.enabled,
    mode: settings.mode,
    readiness: resolvePopupReadiness(settings.apiKey, permission)
  };
}

export async function setPopupEnabled(
  storage: Pick<ExtensionSettingsStorage, 'set'>,
  enabled: boolean
): Promise<void> {
  await storage.set({ enabled });
}

export async function setPopupMode(
  storage: Pick<ExtensionSettingsStorage, 'set'>,
  mode: DisplayMode
): Promise<void> {
  await storage.set({ mode });
}
