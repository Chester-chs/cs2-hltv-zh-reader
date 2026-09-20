import {
  createTranslationService,
  type CacheStore,
  type GlossaryDocument,
  type ProviderError,
  type ProviderResult,
  type TranslationProvider,
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function mapProviderError(error: ProviderError): BackgroundFailure {
  return {
    code:
      error.code === 'timeout'
        ? 'provider-timeout'
        : error.code === 'invalid-response'
          ? 'invalid-response'
          : 'provider-failure',
    message: error.message
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
    settings: ExtensionSettings
  ): Promise<BackgroundTranslationResult>;
} {
  return {
    async translate(texts, purpose, settings) {
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
          } catch (error) {
            observedFailures.push({
              code: 'transport-error',
              message: errorMessage(error)
            });
            throw error;
          }
        }
      };

      const service = createTranslationService({
        glossary: await options.glossary,
        provider: observingProvider,
        cacheStore: options.cacheStore
      });

      let translations: string[];
      try {
        translations =
          purpose === 'event-name'
            ? await service.translateEventNames(texts)
            : await service.translate(texts);
      } catch (error) {
        return {
          ok: false,
          translations: [...texts],
          error: {
            code: 'provider-failure',
            message: errorMessage(error)
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
