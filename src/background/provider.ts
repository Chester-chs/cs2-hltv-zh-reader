import {
  createOpenAICompatibleProvider,
  type ChatCompletionsTransport,
  type ChatCompletionsTransportRequest,
  type ChatCompletionsTransportResponse,
  type TranslationProvider
} from '../core/translate/index.ts';
import type { ExtensionSettings } from '../shared/settings.ts';
export const DEFAULT_PROVIDER_TIMEOUT_MS = 25000;

export interface BackgroundProviderFactoryOptions {
  timeoutMs?: number;
  temperature?: number;
  transport?: ChatCompletionsTransport;
}

async function fetchChatCompletions(
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

export function createBackgroundProviderFactory(
  options: BackgroundProviderFactoryOptions = {}
): (settings: ExtensionSettings) => TranslationProvider {
  const transport = options.transport ?? { send: fetchChatCompletions };
  const timeoutMs = options.timeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS;

  return (settings) =>
    createOpenAICompatibleProvider({
      baseURL: settings.baseURL,
      model: settings.model,
      apiKey: settings.apiKey,
      timeoutMs,
      useJsonOutputMode: settings.useJsonOutputMode,
      translationStyle: settings.translationStyle,
      ...(options.temperature === undefined
        ? {}
        : { temperature: options.temperature }),
      transport
    });
}
