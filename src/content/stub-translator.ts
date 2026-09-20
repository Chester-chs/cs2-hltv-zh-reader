import type { TranslationService } from '../core/translate/index.ts';

function mark(texts: string[]): string[] {
  return texts.map((text) => `【译】${text}`);
}

/**
 * B2-only wiring stub. It implements the same two-method injection contract
 * used by TranslationService; B3 can replace this object without changing DOM
 * execution code. It never performs network I/O.
 */
export function createStubTranslationService(): TranslationService {
  return {
    translate(texts) {
      return Promise.resolve(mark(texts));
    },
    translateEventNames(texts) {
      return Promise.resolve(mark(texts));
    }
  };
}
