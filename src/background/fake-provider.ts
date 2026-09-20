import type {
  ProviderRequest,
  ProviderResult,
  TranslationProvider
} from '../core/translate/index.ts';

export type FakeProviderMode =
  | 'success'
  | 'provider-failure'
  | 'invalid-response'
  | 'never-resolve';

export interface FakeProviderOptions {
  mode?: FakeProviderMode;
}

function translateSuccessfully(request: ProviderRequest): ProviderResult {
  return {
    ok: true,
    translations: request.texts.map((text) => `【译】${text}`)
  };
}

export function createFakeProvider(
  options: FakeProviderOptions = {}
): TranslationProvider {
  const mode = options.mode ?? 'success';

  return {
    async translate(request) {
      if (mode === 'never-resolve') {
        return new Promise<never>(() => {});
      }
      if (mode === 'provider-failure') {
        return {
          ok: false,
          error: {
            code: 'transport-error',
            message: 'The B3a fake provider failed.'
          }
        };
      }
      if (mode === 'invalid-response') {
        return {
          ok: false,
          error: {
            code: 'invalid-response',
            message: 'The B3a fake provider returned an invalid response.'
          }
        };
      }
      return translateSuccessfully(request);
    }
  };
}
