import type { DisplayMode } from '../shared/settings.ts';

export interface LiveContentSettingsRuntime {
  setEnabled(enabled: boolean): Promise<void>;
  setMode(mode: DisplayMode): Promise<void>;
}

export interface ContentSettingsChange {
  newValue?: unknown;
}

export type ContentSettingsChanges = Partial<
  Record<'enabled' | 'mode', ContentSettingsChange>
>;

export async function applyContentSettingsChanges(
  runtime: LiveContentSettingsRuntime,
  changes: ContentSettingsChanges
): Promise<void> {
  const enabled = changes.enabled?.newValue;
  if (typeof enabled === 'boolean') {
    await runtime.setEnabled(enabled);
  }

  const mode = changes.mode?.newValue;
  if (mode === 'A' || mode === 'B') {
    await runtime.setMode(mode);
  }
}
