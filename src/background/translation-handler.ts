import type { ExtensionSettingsStorage } from './settings.ts';
import { loadSettings } from './settings.ts';
import {
  decodeTranslateRequest,
  encodeTranslateResponse,
  type TranslateFailureCode,
  type TranslateResponse,
  type TranslationPurpose
} from './protocol.ts';
import type { ExtensionSettings } from '../shared/settings.ts';

export interface BackgroundFailure {
  code: TranslateFailureCode;
  message: string;
}

export type BackgroundTranslationResult =
  | { ok: true; translations: string[] }
  | { ok: false; translations: string[]; error: BackgroundFailure };

export interface BackgroundTranslationRunner {
  translate(
    texts: string[],
    purpose: TranslationPurpose,
    settings: ExtensionSettings
  ): Promise<BackgroundTranslationResult>;
}

export interface BackgroundMessageHandlerOptions {
  storage: ExtensionSettingsStorage;
  runner: BackgroundTranslationRunner;
  timeoutMs?: number;
}

export interface RuntimeMessageEvent {
  addListener(
    listener: (message: unknown) => Promise<TranslateResponse | undefined>
  ): void;
}

export const DEFAULT_BACKGROUND_TIMEOUT_MS = 5000;

class OperationTimeoutError extends Error {}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new OperationTimeoutError('Background translation timed out.')),
        Math.max(1, timeoutMs)
      );
    });
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isBackgroundFailureCode(value: unknown): value is BackgroundFailure['code'] {
  return (
    value === 'disabled' ||
    value === 'settings-failure' ||
    value === 'provider-failure' ||
    value === 'provider-timeout' ||
    value === 'invalid-response'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isBackgroundTranslationResult(
  value: unknown
): value is BackgroundTranslationResult {
  if (!isRecord(value) || typeof value.ok !== 'boolean' || !isStringArray(value.translations)) {
    return false;
  }
  if (value.ok) {
    return true;
  }
  return (
    isRecord(value.error) &&
    isBackgroundFailureCode(value.error.code) &&
    typeof value.error.message === 'string'
  );
}

function createFailure(
  request: {
    requestId: string;
    purpose: TranslationPurpose;
    texts: string[];
  },
  code: TranslateFailureCode,
  message: string
): TranslateResponse {
  return encodeTranslateResponse({
    type: 'hltv-zh-translate-response',
    requestId: request.requestId,
    purpose: request.purpose,
    ok: false,
    translations: [...request.texts],
    error: {
      code,
      fallback: 'original',
      message
    }
  });
}

function createSuccess(
  request: {
    requestId: string;
    purpose: TranslationPurpose;
  },
  translations: string[]
): TranslateResponse {
  return encodeTranslateResponse({
    type: 'hltv-zh-translate-response',
    requestId: request.requestId,
    purpose: request.purpose,
    ok: true,
    translations
  });
}

export function createBackgroundMessageHandler(
  options: BackgroundMessageHandlerOptions
): (message: unknown) => Promise<TranslateResponse | undefined> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_BACKGROUND_TIMEOUT_MS;

  return async (message) => {
    const request = decodeTranslateRequest(message);
    if (request === undefined) {
      return undefined;
    }

    let settings: ExtensionSettings;
    try {
      settings = await loadSettings(options.storage);
    } catch (error) {
      return createFailure(
        request,
        'settings-failure',
        `Settings could not be loaded: ${describeError(error)}`
      );
    }

    if (!settings.enabled) {
      return createFailure(request, 'disabled', 'Translation is disabled.');
    }

    let result: BackgroundTranslationResult;
    try {
      result = await withTimeout(
        options.runner.translate(request.texts, request.purpose, settings),
        timeoutMs
      );
    } catch (error) {
      return createFailure(
        request,
        error instanceof OperationTimeoutError
          ? 'provider-timeout'
          : 'provider-failure',
        describeError(error)
      );
    }

    if (
      !isBackgroundTranslationResult(result) ||
      result.translations.length !== request.texts.length
    ) {
      return createFailure(
        request,
        'invalid-response',
        'The background runner returned the wrong number or type of translations.'
      );
    }

    if (!result.ok) {
      return createFailure(request, result.error.code, result.error.message);
    }

    return createSuccess(request, result.translations);
  };
}

export function installBackgroundMessageHandler(
  event: RuntimeMessageEvent,
  handler: (message: unknown) => Promise<TranslateResponse | undefined>
): void {
  event.addListener((message) => handler(message));
}
