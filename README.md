# CS2 HLTV Chinese Reader

<p align="center">
  <a href="README.md">English</a> | <a href="README.zh-CN.md">中文</a>
</p>

An open-source Chrome and Edge extension that makes HLTV easier to read in Chinese. It translates confirmed interface labels offline and uses a configurable OpenAI-compatible provider for article prose and other eligible text.

## Features

- Full-Chinese mode and bilingual mode for supported HLTV pages.
- Offline glossary translation for confirmed navigation, filters, statistics, and fixed labels.
- Article and free-text translation through DeepSeek, OpenAI, or a custom OpenAI-compatible provider.
- Optional fallback provider and IndexedDB translation cache for network failures.
- Select a word to open an Oxford-style dictionary card with Chinese meanings, concise English explanations, parts of speech, verb base forms, UK/US IPA, pronunciation buttons, editing, favorites, and resizing.
- Select a sentence or phrase for a Chinese sentence translation, even when page translation is disabled.
- Separate dictionary history and favorites page.
- Card-level light, dark, system theme, and font-size controls.
- Custom extension logo and Chrome/Edge MV3 service worker.

## Installation

1. Download `CS2-HLTV-Chinese-Reader-v1.0.0.zip` from the [first release](https://github.com/Chester-chs/cs2-hltv-zh-reader/releases/tag/v1.0.0).
2. Extract the ZIP. `manifest.json` must be at the extracted folder's root.
3. Open `chrome://extensions` or `edge://extensions`.
4. Enable **Developer mode**, choose **Load unpacked**, and select the extracted folder.
5. Open the extension settings, choose a provider, enter an API key, authorize its origin, and test the connection.
6. Refresh an HLTV page. Use the toolbar popup to enable translation and choose full-Chinese or bilingual display.

## Provider and privacy

The default provider preset is DeepSeek. OpenAI and custom OpenAI-compatible HTTPS endpoints are also supported; HTTP is limited to local loopback addresses. The API key is stored in `browser.storage.local` on this device and is sent only to the provider you configure. It is not synchronized with a browser account or sent to the extension developer.

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
```

The build produces a single MV3 background service worker, a single content bundle, the options and popup pages, the dedicated history page, the packaged glossary, and the extension icons.

## Scope and disclaimer

Firefox is deferred because its background event page did not start during validation. This project is not affiliated with, endorsed by, sponsored by, or otherwise associated with HLTV or hltv.org. The extension depends on HLTV's page structure and may need maintenance when the site changes.
