import {
  createTranslationService,
  type CacheStore,
  type GlossaryDocument,
  type ProviderError,
  type ProviderResult,
  type TranslationProvider,
  type TranslationContext,
  type TranslationPurpose
} from '../core/translate/index.ts';
import type { ExtensionSettings } from '../shared/settings.ts';
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

export function createCoreBackgroundTranslationRunner(
  options: CoreTranslationRunnerOptions
): {
  translate(
    texts: string[],
    purpose: TranslationPurpose,
    settings: ExtensionSettings,
    context?: TranslationContext
  ): Promise<BackgroundTranslationResult>;
} {
  return {
    async translate(texts, purpose, settings, context = 'comment') {
      const observedFailures: ProviderError[] = [];
      const provider = options.providerFactory(settings);
      const observingProvider: TranslationProvider = {
        async translate(request): Promise<ProviderResult> {
          try {
            const result = await provider.translate(request);
            if (!result.ok) {
              observedFailures.push(result.error);
            }
            return result;
          } catch {
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
        context
      });

      let translations: string[];
      try {
        translations =
          purpose === 'event-name'
            ? await service.translateEventNames(texts)
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
    }
  };
}
