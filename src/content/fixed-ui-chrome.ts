import { createDisplayRecordTable, decideRenderIntent, FIXED_UI_CHROME_STRATEGY, isFixedUiElementProtected, type DisplayMode } from '../core/display/index.ts';
import { FIXED_UI_ATTRIBUTE_TARGETS, FIXED_UI_DECORATIONS, selectorMatchesPath } from '../core/display/selectors.ts';
import { translateFixedUiTexts, type GlossaryDocument } from '../core/translate/index.ts';

// Attribute originals are registered once and restored exclusively from this memory table.
// Typed values are neither read nor written. Decorations override CSS without changing its source.
export function createFixedUiChrome(document: Document, glossary: GlossaryDocument) {
  const records = createDisplayRecordTable();
  const targets = new Map<string, { element: Element; attribute: string }>();
  let keys = new WeakMap<Element, Map<string, string>>();
  let nextKey = 1;
  let style: Element | undefined;

  function isInProtectedSubtree(element: Element): boolean {
    let current: Element | null = element;
    while (current !== null) {
      const attributes: Record<string, string> = {};
      for (const attribute of Array.from(current.attributes)) {
        if (attribute.name !== 'value') {
          attributes[attribute.name] = attribute.value;
        }
      }
      if (isFixedUiElementProtected({ tagName: current.tagName, classes: Array.from(current.classList), attributes }, document.location.pathname)) {
        return true;
      }
      current = current.parentElement;
    }
    return false;
  }

  function removeStyle(): void {
    if (style?.parentElement !== null && style?.parentElement !== undefined) {
      style.parentElement.removeChild(style);
    }
    style = undefined;
  }

  function cssString(value: string): string {
    return '"' + Array.from(value, (character) => `\\${character.codePointAt(0)?.toString(16)} `).join('') + '"';
  }

  return {
    sync(enabled: boolean, mode: DisplayMode): void {
      if (!enabled || mode !== 'A') {
        for (const record of records.entries()) {
          const target = targets.get(record.node.key);
          if (target !== undefined && target.element.getAttribute(target.attribute) === record.translated) {
            target.element.setAttribute(target.attribute, record.original);
          }
        }
        removeStyle();
        if (!enabled) {
          records.clear();
          targets.clear();
          keys = new WeakMap();
        }
        return;
      }

      for (const definition of FIXED_UI_ATTRIBUTE_TARGETS) {
        if (!selectorMatchesPath(definition, document.location.pathname)) {
          continue;
        }
        const strategy = { ...FIXED_UI_CHROME_STRATEGY, glossaryCategories: definition.glossaryCategories };
        for (const element of Array.from(document.querySelectorAll(definition.selector))) {
          if (definition.protectSubtrees && isInProtectedSubtree(element)) {
            const priorKey = keys.get(element)?.get(definition.attribute);
            const prior = priorKey === undefined ? undefined : records.get(priorKey);
            if (prior !== undefined) {
              if (element.getAttribute(definition.attribute) === prior.translated) {
                element.setAttribute(definition.attribute, prior.original);
              }
              records.remove(prior.node.key);
              targets.delete(prior.node.key);
            }
            continue;
          }
          const current = element.getAttribute(definition.attribute);
          if (current === null) {
            continue;
          }
          const elementKeys = keys.get(element) ?? new Map<string, string>();
          const key = elementKeys.get(definition.attribute) ?? `fixed-attribute-${nextKey++}`;
          elementKeys.set(definition.attribute, key);
          keys.set(element, elementKeys);
          let existing = records.get(key);
          if (existing !== undefined && current !== existing.original && current !== existing.translated) {
            records.remove(key);
            targets.delete(key);
            existing = undefined;
          }
          const original = existing?.original ?? current;
          const translated = translateFixedUiTexts([original], glossary, definition.glossaryCategories)[0] ?? original;
          if (translated === original) {
            continue;
          }
          const node = { key, parent: { tagName: element.tagName, classes: Array.from(element.classList), attributes: {} } };
          if (existing === undefined) {
            records.register(node, original, strategy);
            targets.set(key, { element, attribute: definition.attribute });
          }
          records.updateTranslation(key, translated);
          const intent = decideRenderIntent(node, original, translated, mode, strategy);
          if (intent.kind === 'replace-text' && current !== intent.translatedText) {
            element.setAttribute(definition.attribute, intent.translatedText);
          }
        }
      }

      if (style === undefined && document.head !== null && document.head !== undefined) {
        const rules = FIXED_UI_DECORATIONS.flatMap((definition) => {
          const translated = translateFixedUiTexts([definition.term], glossary)[0] ?? definition.term;
          return translated === definition.term ? [] : [`${definition.selector}{content:${cssString(translated)} !important;}`];
        });
        if (rules.length > 0) {
          style = document.createElement('style');
          style.setAttribute('data-hltv-zh', '1');
          style.appendChild(document.createTextNode(rules.join('\n')));
          document.head.appendChild(style);
        }
      }
    }
  };
}
