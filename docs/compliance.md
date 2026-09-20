# Gate 3 Compliance and Third-Party Notes

Access date: 2026-09-20. This is a source-recording and risk document, not legal advice and not a permission to bypass any site rule.

## 1. HLTV robots.txt

Source: `https://www.hltv.org/robots.txt`.

The project owner's capture was HTTP 200 and 1,646 bytes. The relevant recorded rule is:

```text
Disallow: /matches?*
```

The supplied capture also records similar query-parameter patterns for `/stats` and `/results`, and a sitemap declaration pointing to `sitemap_index.xml`.

### Crawler perspective

The recorded `/matches?*` rule targets `/matches` requests with a query string. It does not disallow the bare `/matches` path used for the match-list reconnaissance. This is a narrow observation of the captured rule, not a general statement that all HLTV paths are crawlable or that automated fetching is authorized.

The sitemap index and news sitemap were requested only to resolve a current, concrete news URL. They returned HTTP 200 and were not treated as permission to crawl the full site.

### Browser-extension perspective

`robots.txt` is a crawler-facing convention. It does not grant a browser extension permission to modify the page, collect content, call a translation provider, or redistribute translated output. Conversely, a content script that reads the DOM already loaded by the user's browser is a different access pattern from a standalone crawler, but that distinction does not override the Terms of Use below.

The current scaffold performs no automated fetching or translation. Any later design that sends page text to a provider or stores/redistributes translated output needs a separate compliance decision.

## 2. HLTV Terms of Use

Source: `https://www.hltv.org/terms`.

The page was captured with HTTP 200 and `Content-Type: text/html;charset=utf-8`; local evidence is `raw-capture/gate3/terms.html` and `terms.headers.txt`.

Relevant short excerpts from section 2.2:

> conduct, facilitate or organize data mining or web scraping in relation to the Website and/or any of the content;

The same prohibited-use list also includes commercially exploiting the Website/content and modifying the Website/content. Section 2.1 describes the grant as a personal limited license to use and access the Website only as permitted by the Terms.

Section 3.1 states that the Website and original content, features, and functionality are owned by HLTV or its licensors. Section 3.2 states that Website materials must not be used for business purposes without a license from HLTV or its licensors.

### Risk assessment

- The Terms use broad language covering data mining/web scraping and modification. It is `Unable to confirm` whether a user-controlled translation extension that reads already-rendered DOM text falls inside those clauses.
- The fact that the extension runs in a browser, rather than as a crawler, is not a safe-harbor conclusion.
- Translating and displaying text locally is a different risk profile from collecting pages centrally or redistributing a translated corpus, but the captured Terms do not establish a blanket permission for either.
- A future provider/API route, user-supplied key, cache, telemetry path, or public translation export needs owner/legal review. No bypass or compliance exception is selected here.

## 3. Third-party projects and licenses

These are the actual repository dependencies observed in `package.json` and the installed package metadata:

| Project | Version | Role | License | MIT-distribution assessment |
|---|---:|---|---|---|
| Mozilla `webextension-polyfill` | 0.12.0 | Runtime browser API compatibility layer | MPL-2.0 | Usable as an unmodified dependency alongside this MIT project, provided the MPL notice/license obligations are preserved. Any modification or source combination must be reviewed under MPL-2.0. |
| DefinitelyTyped `@types/webextension-polyfill` | 0.12.6 | TypeScript declarations, dev-only | MIT | Compatible with this repository's MIT license. |
| Vite | 8.3.0 | Build tool, dev-only | MIT | Compatible; not shipped as extension runtime code. |
| TypeScript | 7.0.2 | Compiler, dev-only | Apache-2.0 | Compatible for this use; not shipped as extension runtime code. |

Source/license references recorded from installed metadata:

- `webextension-polyfill`: https://github.com/mozilla/webextension-polyfill
- `@types/webextension-polyfill`: https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/webextension-polyfill
- Vite: https://github.com/vitejs/vite
- TypeScript: https://github.com/microsoft/TypeScript

The HLTV page also serves an htmx bundle and a Socket.IO-based livescore module. They were inspected as remote page assets, not copied into this repository, bundled into the extension, or redistributed by this Gate 3 work. Their source URLs and observed use are recorded in `docs/findings.md`; no third-party page asset is currently a project dependency.

## 4. Distribution boundary and unresolved items

- Raw HTML, headers, and downloaded page scripts remain under ignored `raw-capture/` and are not committed.
- No HLTV page content, htmx code, Socket.IO code, API key, or provider response is included in the extension source or this documentation commit.
- The repository's own code remains MIT-licensed, subject to the dependency notices above.
- The legal status of local translation, provider transmission, caching, and redistribution remains unresolved. Gate 3 records the risk without choosing a bypass or claiming compatibility with HLTV's Terms.
