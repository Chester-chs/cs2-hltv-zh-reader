import {
  createOpenAICompatibleProvider,
  type ChatCompletionsTransport,
  type ChatCompletionsTransportRequest,
  type ChatCompletionsTransportResponse,
  type ProviderError
} from '../core/translate/index.ts';
import { parseProviderBaseURL } from '../shared/provider-url.ts';
import type { ExtensionSettings } from '../shared/settings.ts';
import type { OptionalHostPermissions } from './settings-service.ts';

export type ConnectionTestResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'invalid-base-url'
        | 'permission'
        | 'timeout'
        | 'unauthorized'
        | 'network'
        | 'response-format-unsupported'
        | 'http-error'
        | 'invalid-response';
      status?: number;
    };

export type ConnectionTestTransport = ChatCompletionsTransport;

async function fetchRequest(
  request: ChatCompletionsTransportRequest
): Promise<ChatCompletionsTransportResponse> {
  const response = await fetch(request.url, {
    method: 'POST',
    headers: request.headers,
    body: request.body
  });
  return {
    status: response.status,
    json: () => response.json() as Promise<unknown>
  };
}

function mapProviderError(error: ProviderError): ConnectionTestResult {
  if (error.code === 'timeout') {
    return { ok: false, reason: 'timeout' };
  }
  if (error.code === 'transport-error') {
    return { ok: false, reason: 'network' };
  }
  if (error.code === 'invalid-response') {
    return { ok: false, reason: 'invalid-response' };
  }
  if (error.status === 401) {
    return { ok: false, reason: 'unauthorized', status: 401 };
  }
  if (
    error.status !== undefined &&
    error.status >= 400 &&
    error.status < 500 &&
    error.message.includes('response_format')
  ) {
    return { ok: false, reason: 'response-format-unsupported' };
  }
  return {
    ok: false,
    reason: 'http-error',
    ...(error.status === undefined ? {} : { status: error.status })
  };
}

export async function testProviderConnection(
  settings: ExtensionSettings,
  permissions: Pick<OptionalHostPermissions, 'contains'>,
  transport: ConnectionTestTransport = { send: fetchRequest },
  timeoutMs = 5000
): Promise<ConnectionTestResult> {
  const parsed = parseProviderBaseURL(settings.baseURL);
  if (parsed === undefined) {
    return { ok: false, reason: 'invalid-base-url' };
  }

  try {
    const hasPermission = await permissions.contains({
      origins: [parsed.permissionPattern]
    });
    if (!hasPermission) {
      return { ok: false, reason: 'permission' };
    }
  } catch {
    return { ok: false, reason: 'permission' };
  }

  let provider;
  try {
    provider = createOpenAICompatibleProvider({
      baseURL: settings.baseURL,
      model: settings.model,
      apiKey: settings.apiKey,
      timeoutMs,
      useJsonOutputMode: settings.useJsonOutputMode,
      transport
    });
  } catch {
    return { ok: false, reason: 'invalid-base-url' };
  }

  try {
    const result = await provider.translate({
      texts: ['Hello.'],
      purposes: ['plain'],
      protectedFragments: [[]]
    });
    return result.ok ? { ok: true } : mapProviderError(result.error);
  } catch {
    return { ok: false, reason: 'network' };
  }
}
