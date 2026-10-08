import {
  createTranslationService,
  translateGlossaryCoveredText,
  type CacheStore,
  type GlossaryDocument,
  type ProviderError,
  type ProviderResult,
  type TranslationProvider,
  type TranslationContext,
  type TranslationPurpose
} from '../core/translate/index.ts';
import { DEFAULT_SETTINGS, type ExtensionSettings } from '../shared/settings.ts';
import type {
  BackgroundFailure,
  BackgroundTranslationResult
} from './translation-handler.ts';

export interface BackgroundProviderFactory {
  (settings: ExtensionSettings): TranslationProvider;
}

export interface CoreTranslationRunnerOptions {
  glossary: GlossaryDocument | Promise<GlossaryDocument>;
  cacheStore: CacheStore;
  providerFactory: BackgroundProviderFactory;
}

function mapProviderError(error: ProviderError): BackgroundFailure {
  const message =
    error.code === 'timeout'
      ? 'Provider request timed out.'
      : error.code === 'invalid-response'
        ? 'Provider returned an invalid response.'
        : error.code === 'transport-error'
          ? 'Network request failed.'
          : error.message === 'Provider rejected response_format.'
            ? 'Provider rejected response_format.'
            : error.status !== undefined
              ? `Provider returned HTTP ${error.status}.`
              : 'Provider request failed.';
  return {
    code:
      error.code === 'timeout'
        ? 'provider-timeout'
        : error.code === 'invalid-response'
          ? 'invalid-response'
          : 'provider-failure',
    message
  };
}

function invalidResult(): BackgroundFailure {
  return {
    code: 'invalid-response',
    message: 'The translation service returned an invalid result.'
  };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function providerCacheNamespace(settings: ExtensionSettings): string {
  if (
    settings.providerPreset === DEFAULT_SETTINGS.providerPreset &&
    settings.baseURL === DEFAULT_SETTINGS.baseURL &&
    settings.model === DEFAULT_SETTINGS.model &&
    settings.useJsonOutputMode === DEFAULT_SETTINGS.useJsonOutputMode
  ) {
    return 'default';
  }
  return JSON.stringify([
    settings.providerPreset,
    settings.baseURL,
    settings.model,
    settings.useJsonOutputMode
  ]);
}

export function createCoreBackgroundTranslationRunner(
  options: CoreTranslationRunnerOptions
): {
  translate(
    texts: string[],
    purpose: TranslationPurpose,
    settings: ExtensionSettings,
    context?: TranslationContext
  ): Promise<BackgroundTranslationResult>;
  translateGlossaryCovered(
    texts: string[],
    purpose: TranslationPurpose
  ): Promise<Array<string | undefined>>;
} {
  const inFlight = new Map<string, Promise<BackgroundTranslationResult>>();

  return {
    async translateGlossaryCovered(texts, purpose) {
      const glossary = await options.glossary;
      return texts.map((text) =>
        translateGlossaryCoveredText(text, glossary, purpose)
      );
    },
    async translate(texts, purpose, settings, context = 'comment') {
      const cacheNamespace = providerCacheNamespace(settings);
      const requestKey = JSON.stringify([cacheNamespace, context, purpose, texts]);
      const existing = inFlight.get(requestKey);
      if (existing !== undefined) {
        return existing;
      }

      const operation = (async (): Promise<BackgroundTranslationResult> => {
      const observedFailures: ProviderError[] = [];
      const provider = options.providerFactory(settings);
      const fallbackProvider = settings.fallbackEnabled === true &&
        settings.fallbackBaseURL !== undefined &&
        settings.fallbackBaseURL.trim().length > 0 &&
        settings.fallbackModel !== undefined &&
        settings.fallbackModel.trim().length > 0 &&
        settings.fallbackApiKey !== undefined &&
        settings.fallbackApiKey.trim().length > 0
        ? options.providerFactory({
            ...settings,
            providerPreset: 'custom',
            baseURL: settings.fallbackBaseURL,
            model: settings.fallbackModel,
            apiKey: settings.fallbackApiKey,
            fallbackEnabled: false
          })
        : undefined;
      const observingProvider: TranslationProvider = {
        async translate(request): Promise<ProviderResult> {
          try {
            const result = await provider.translate(request);
            if (result.ok || fallbackProvider === undefined) {
              if (!result.ok) {
                observedFailures.push(result.error);
              }
              return result;
            }
            const fallback = await fallbackProvider.translate(request);
            if (!fallback.ok) {
              observedFailures.push(fallback.error);
            }
            return fallback;
          } catch {
            if (fallbackProvider !== undefined) {
              try {
                const fallback = await fallbackProvider.translate(request);
                if (fallback.ok) {
                  return fallback;
                }
                observedFailures.push(fallback.error);
                return fallback;
              } catch {
                // Report a generic failure below when both providers fail.
              }
            }
            observedFailures.push({
              code: 'transport-error',
              message: 'The provider operation failed.'
            });
            throw new Error('The provider operation failed.');
          }
        }
      };

      const service = createTranslationService({
        glossary: await options.glossary,
        provider: observingProvider,
        cacheStore: options.cacheStore,
        context,
        cacheNamespace
      });

      let translations: string[];
      try {
        translations =
          purpose === 'event-name'
            ? await service.translateEventNames(texts)
            : purpose === 'dictionary' && service.translateDictionary !== undefined
              ? await service.translateDictionary(texts)
            : await service.translate(texts);
      } catch {
        return {
          ok: false,
          translations: [...texts],
          error: {
            code: 'provider-failure',
            message: 'The translation service failed.'
          }
        };
      }

      if (!isStringArray(translations) || translations.length !== texts.length) {
        return {
          ok: false,
          translations: [...texts],
          error: invalidResult()
        };
      }

      const providerFailure = observedFailures[0];
      if (providerFailure !== undefined) {
        return {
          ok: false,
          translations: [...texts],
          error: mapProviderError(providerFailure)
        };
      }

      return { ok: true, translations };
      })();
      inFlight.set(requestKey, operation);
      try {
        return await operation;
      } finally {
        if (inFlight.get(requestKey) === operation) {
          inFlight.delete(requestKey);
        }
      }
    }
  };
}
