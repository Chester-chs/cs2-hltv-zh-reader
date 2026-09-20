import type { TranslationPurpose } from '../core/translate/index.ts';

export type { TranslationPurpose };

export const TRANSLATE_REQUEST_TYPE = 'hltv-zh-translate-request' as const;
export const TRANSLATE_RESPONSE_TYPE = 'hltv-zh-translate-response' as const;

export type TranslateFailureCode =
  | 'disabled'
  | 'settings-failure'
  | 'provider-failure'
  | 'provider-timeout'
  | 'invalid-response';

export interface TranslateRequest {
  type: typeof TRANSLATE_REQUEST_TYPE;
  requestId: string;
  purpose: TranslationPurpose;
  texts: string[];
}

export interface TranslateSuccessResponse {
  type: typeof TRANSLATE_RESPONSE_TYPE;
  requestId: string;
  purpose: TranslationPurpose;
  ok: true;
  translations: string[];
}

export interface TranslateFailureResponse {
  type: typeof TRANSLATE_RESPONSE_TYPE;
  requestId: string;
  purpose: TranslationPurpose;
  ok: false;
  translations: string[];
  error: {
    code: TranslateFailureCode;
    fallback: 'original';
    message: string;
  };
}

export type TranslateResponse =
  | TranslateSuccessResponse
  | TranslateFailureResponse;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPurpose(value: unknown): value is TranslationPurpose {
  return value === 'plain' || value === 'event-name';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isFailureCode(value: unknown): value is TranslateFailureCode {
  return (
    value === 'disabled' ||
    value === 'settings-failure' ||
    value === 'provider-failure' ||
    value === 'provider-timeout' ||
    value === 'invalid-response'
  );
}

export function encodeTranslateRequest(
  request: TranslateRequest
): TranslateRequest {
  return {
    type: TRANSLATE_REQUEST_TYPE,
    requestId: request.requestId,
    purpose: request.purpose,
    texts: [...request.texts]
  };
}

export function decodeTranslateRequest(
  value: unknown
): TranslateRequest | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  if (
    value.type !== TRANSLATE_REQUEST_TYPE ||
    typeof value.requestId !== 'string' ||
    value.requestId.length === 0 ||
    !isPurpose(value.purpose) ||
    !isStringArray(value.texts)
  ) {
    return undefined;
  }

  return {
    type: TRANSLATE_REQUEST_TYPE,
    requestId: value.requestId,
    purpose: value.purpose,
    texts: [...value.texts]
  };
}

export function encodeTranslateResponse(
  response: TranslateResponse
): TranslateResponse {
  if (response.ok) {
    return {
      type: TRANSLATE_RESPONSE_TYPE,
      requestId: response.requestId,
      purpose: response.purpose,
      ok: true,
      translations: [...response.translations]
    };
  }

  return {
    type: TRANSLATE_RESPONSE_TYPE,
    requestId: response.requestId,
    purpose: response.purpose,
    ok: false,
    translations: [...response.translations],
    error: {
      code: response.error.code,
      fallback: 'original',
      message: response.error.message
    }
  };
}

export function decodeTranslateResponse(
  value: unknown
): TranslateResponse | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  if (
    value.type !== TRANSLATE_RESPONSE_TYPE ||
    typeof value.requestId !== 'string' ||
    !isPurpose(value.purpose) ||
    !isStringArray(value.translations)
  ) {
    return undefined;
  }

  if (value.ok === true) {
    return {
      type: TRANSLATE_RESPONSE_TYPE,
      requestId: value.requestId,
      purpose: value.purpose,
      ok: true,
      translations: [...value.translations]
    };
  }

  if (value.ok !== false || !isRecord(value.error)) {
    return undefined;
  }

  if (
    value.error.fallback !== 'original' ||
    !isFailureCode(value.error.code) ||
    typeof value.error.message !== 'string'
  ) {
    return undefined;
  }

  return {
    type: TRANSLATE_RESPONSE_TYPE,
    requestId: value.requestId,
    purpose: value.purpose,
    ok: false,
    translations: [...value.translations],
    error: {
      code: value.error.code,
      fallback: 'original',
      message: value.error.message
    }
  };
}
