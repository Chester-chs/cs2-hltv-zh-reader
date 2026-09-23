# CS2 Chinese Match Reader

An open-source browser extension that provides Chinese reading support for hltv.org match, event, and news pages.

## User-visible states

- **Disabled** — the extension is installed but page translation is inactive.
- **Full translation (mode A)** — eligible English text is replaced with Chinese text.
- **Bilingual (mode B)** — eligible English text remains visible with Chinese text shown next to it.

## Supported browsers

- Google Chrome
- Microsoft Edge

Firefox is temporarily unsupported. Its content script injects, but the Firefox background event page did not start during validation; diagnosis is deferred, not abandoned.

## Development status

The extension can translate supported English text on HLTV pages using an OpenAI-compatible provider configured in its options page. Configure a provider and grant access to its domain before translation can run.

### Provider setup

The default preset is DeepSeek (`https://api.deepseek.com`, model `deepseek-chat`). OpenAI is also available (`https://api.openai.com`, model `gpt-4o-mini`), and Custom accepts an HTTPS base URL or an HTTP loopback URL (`localhost`, `127.0.0.1`, or `[::1]`) with a model name. External hosts must use HTTPS. The extension requests host access only for the configured origin when settings are saved.

The API Key is stored in `browser.storage.local` on this device. Translation and connection-test requests send it to the configured provider. It is not synchronized with a browser account or sent to the extension developer.

## Important disclaimer

This project is not affiliated with, endorsed by, sponsored by, or otherwise associated with HLTV or hltv.org.

The extension depends on the page structure of hltv.org. Changes to the site's markup, scripts, routes, or behavior may cause the extension to stop working or require maintenance.
