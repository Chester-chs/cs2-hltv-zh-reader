import type { TranslationService } from '../core/translate/index.ts';
import {
  decodeTranslateResponse,
  encodeTranslateRequest,
  type TranslateRequest,
  type TranslationPurpose
} from '../background/protocol.ts';

export interface ContentMessageSender {
  (message: TranslateRequest): Promise<unknown>;
}

export interface BackgroundTranslationServiceOptions {
  sendMessage: ContentMessageSender;
  timeoutMs?: number;
  requestId?: () => string;
}

export const DEFAULT_CONTENT_TIMEOUT_MS = 6000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: T): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(
      () => finish(undefined as T),
      Math.max(1, timeoutMs)
    );
    promise.then(finish, () => finish(undefined as T));
  });
}

function defaultRequestIdFactory(): () => string {
  let nextId = 1;
  return () => `content-request-${nextId++}`;
}

export function createBackgroundTranslationService(
  options: BackgroundTranslationServiceOptions
): TranslationService {
  const timeoutMs = options.timeoutMs ?? DEFAULT_CONTENT_TIMEOUT_MS;
  const requestId = options.requestId ?? defaultRequestIdFactory();
  const sessionResults = new Map<string, string>();

  async function translateBatch(
    texts: string[],
    purpose: TranslationPurpose
  ): Promise<string[]> {
    if (texts.length === 0) {
      return [];
    }

    const results = new Array<string>(texts.length);
    const missing = new Map<string, number[]>();
    for (let index = 0; index < texts.length; index += 1) {
      const text = texts[index] as string;
      const sessionKey = `${purpose}\u0000${text}`;
      const cached = sessionResults.get(sessionKey);
      if (cached !== undefined) {
        results[index] = cached;
        continue;
      }
      const indexes = missing.get(sessionKey) ?? [];
      indexes.push(index);
      missing.set(sessionKey, indexes);
    }

    if (missing.size === 0) {
      return results;
    }

    const missingEntries = Array.from(missing.entries());
    const request: TranslateRequest = encodeTranslateRequest({
      type: 'hltv-zh-translate-request',
      requestId: requestId(),
      purpose,
      texts: missingEntries.map(([, indexes]) => texts[indexes[0] as number] as string)
    });

    let translated: string[] | undefined;
    try {
      const response = await withTimeout(options.sendMessage(request), timeoutMs);
      const decoded = decodeTranslateResponse(response);
      if (
        decoded !== undefined &&
        decoded.requestId === request.requestId &&
        decoded.purpose === request.purpose &&
        decoded.translations.length === request.texts.length
      ) {
        translated = decoded.ok ? decoded.translations : [...request.texts];
      }
    } catch {
      translated = undefined;
    }

    const resolved = translated ?? request.texts;
    for (let index = 0; index < missingEntries.length; index += 1) {
      const [sessionKey, indexes] = missingEntries[index] as [string, number[]];
      const value = resolved[index] as string;
      sessionResults.set(sessionKey, value);
      for (const originalIndex of indexes) {
        results[originalIndex] = value;
      }
    }

    return results;
  }

  return {
    translate(texts) {
      return translateBatch(texts, 'plain');
    },
    translateEventNames(texts) {
      return translateBatch(texts, 'event-name');
    }
  };
}
