import {
  parseGlossaryJson,
  type GlossaryDocument,
  type GlossaryDiagnostic
} from '../core/translate/index.ts';

export interface TextResourceResponse {
  ok: boolean;
  text(): Promise<string>;
}

export type TextResourceLoader = (
  url: string
) => Promise<TextResourceResponse>;

const emptyGlossary: GlossaryDocument = { version: 1, entries: [] };

export async function loadPackagedGlossary(
  url: string,
  loader: TextResourceLoader = (resourceUrl) => fetch(resourceUrl),
  onDiagnostic: (diagnostic: GlossaryDiagnostic) => void = () => {}
): Promise<GlossaryDocument> {
  try {
    const response = await loader(url);
    if (!response.ok) {
      onDiagnostic({
        code: 'invalid-document',
        message: `Packaged glossary returned HTTP failure for ${url}.`
      });
      return emptyGlossary;
    }
    const result = parseGlossaryJson(await response.text());
    for (const diagnostic of result.diagnostics) {
      onDiagnostic(diagnostic);
    }
    return result.glossary;
  } catch (error) {
    onDiagnostic({
      code: 'invalid-document',
      message:
        error instanceof Error
          ? error.message
          : `Packaged glossary could not be loaded from ${url}.`
    });
    return emptyGlossary;
  }
}
