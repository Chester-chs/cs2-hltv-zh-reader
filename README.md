# CS2 HLTV Chinese Reader

<p align="center">
  <a href="README.md">English</a> | <a href="README.zh-CN.md">中文</a>
</p>

An open-source Chrome and Edge extension that makes HLTV easier to read in Chinese. Confirmed interface labels are translated locally from the bundled glossary. News articles, forum prose, dictionary lookups, and other eligible free text use the translation provider configured by you.

> **Important:** this is an unpacked developer extension. It is not installed from the Chrome Web Store. Download the ZIP, extract it, and load the extracted folder from the browser's extension page.

## What it provides

- Full-Chinese mode and bilingual mode for supported HLTV pages.
- Offline glossary translation for confirmed navigation, filters, statistics, and fixed labels.
- Article, sentence, and free-text translation through DeepSeek, OpenAI, or a custom OpenAI-compatible provider.
- Optional fallback provider and IndexedDB translation cache for network failures.
- Select a word to open an Oxford-style dictionary card with Chinese meanings, concise English explanations, parts of speech, verb base forms, UK/US IPA, pronunciation buttons, editable lookup text, favorites, and resizing.
- Select a sentence or phrase to show a Chinese sentence translation, even when page translation is disabled.
- Separate dictionary history and favorites page.
- Card-level light, dark, system theme, and font-size controls.
- Custom extension icon and Chrome/Edge Manifest V3 service worker.

## Supported browsers and limits

- Chrome and Microsoft Edge desktop are supported.
- The current content script matches `https://www.hltv.org/*`.
- Firefox is not part of this release. Safari, mobile browsers, and general-purpose web translation are not targets.
- Fixed interface labels can work offline. News titles, article paragraphs, dictionary results, and sentence translations need a configured provider, an API key, permission for that provider's origin, and network access.

## Installation for first-time users

### 1. Download and extract the package

1. Open the [v1.0.0 release page](https://github.com/Chester-chs/cs2-hltv-zh-reader/releases/tag/v1.0.0).
2. Download **`CS2-HLTV-Chinese-Reader-v1.0.0.zip`** from the **Assets** section. Do not download the source-code ZIP.
3. Extract the ZIP to a normal folder that you will not delete later, for example `Documents\\HLTV Chinese Reader`.
4. Open the extracted folder and check that **`manifest.json` is directly inside it**. The correct layout is:

   ```text
   CS2-HLTV-Chinese-Reader-v1.0.0\\
   ├─ manifest.json
   ├─ background.js
   ├─ content.js
   ├─ options.html
   ├─ popup.html
   ├─ history.html
   └─ icons\\
   ```

   If `manifest.json` is inside another nested folder, select that inner folder in the next step. Do not select the ZIP file itself.

### 2. Load it in Chrome

1. In Chrome's address bar, open **`chrome://extensions`**.
2. Turn on **Developer mode** in the upper-right corner.
3. Click **Load unpacked**.
4. Select the extracted folder whose top level contains `manifest.json`, then click **Select Folder**.
5. Confirm that **CS2 HLTV Chinese Reader** appears in the extension list and that its switch is enabled.
6. Optional: click the puzzle-piece button in the toolbar and pin the extension so its icon is always visible.

### 3. Load it in Microsoft Edge

1. In Edge's address bar, open **`edge://extensions`**.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select the extracted folder containing `manifest.json`.
4. Enable the extension. Pin it from the Extensions button if you want quick access.

### 4. Configure a translation provider

The extension can translate confirmed fixed labels without an API key. To translate news prose, sentences, and dictionary results, complete this setup:

1. Open an HLTV page, click the extension icon, and choose **Provider and first-use setup**. You can also open the extension's **Details** page and choose **Extension options**.
2. In **Provider preset**, choose **DeepSeek**, **OpenAI**, or **Custom**.
   - DeepSeek preset: `https://api.deepseek.com`, model `deepseek-chat`.
   - OpenAI preset: `https://api.openai.com`, model `gpt-4o-mini`.
   - Custom: enter your provider's HTTPS base URL and model name. The extension appends `/v1/chat/completions`; enter the base URL, not the complete chat-completions URL.
3. Paste your own API key into **API Key**. Never send the key to anyone in a chat or issue report.
4. Leave **Use JSON output mode** enabled unless your provider explicitly rejects `response_format`. If it rejects it, turn this option off and test again.
5. Click **Authorize** in the provider permission section and approve the browser permission prompt. The permission is for the provider origin you entered, not for all websites.
6. Click **Save**.
7. Click **Test connection** and wait for **Connection succeeded**. Fix the address, key, model, or permission if the test fails.
8. If you enabled a fallback provider, fill in its base URL, model, and key. Save it and authorize its origin as well.

### 5. Turn on HLTV translation

1. Return to an `https://www.hltv.org/` tab and refresh the page after changing settings.
2. Click the extension icon.
3. Turn on **Enable page translation**.
4. Choose **Full Chinese** to replace eligible English labels, or **Bilingual** to keep the original and show Chinese beside it.
5. Open another HLTV page or refresh the current page if some content was already rendered before the extension was enabled.

The extension does not translate team names, player names, scores, dates, live-score widgets, or other data that should remain exact. News prose and other dynamic text are translated only after the provider setup succeeds.

## Word lookup, sentence translation, history, and favorites

- Drag over a word. A small magnifier appears beside the selection; click it to open the dictionary card.
- Drag over a sentence or phrase to request a sentence translation. This works even if page translation is switched off.
- The card can show Chinese meanings, a short English explanation, parts of speech, a verb base form, UK/US IPA, and pronunciation buttons. The lookup text can be edited before searching again.
- Use the star button to save a word. Use **Open dictionary history** in the popup to open the dedicated history and favorites page.
- Theme and font-size controls are inside the dictionary card. They can be changed while the card is open.

## Updating an existing installation

1. Download the newest release ZIP and extract it to a new folder.
2. Open `chrome://extensions` or `edge://extensions`.
3. If the extension is loaded from the same folder, replace the files and click **Reload** on its card. If you extracted to a new folder, remove the old unpacked copy and click **Load unpacked** for the new folder.
4. Refresh every open HLTV tab.
5. Open settings and run **Test connection** again if the provider address or extension version changed.

Keep the extracted folder. The browser loads the extension from that folder; deleting it makes the extension unavailable. Browser storage normally keeps settings for the same unpacked extension, but keep your provider address, model, and API key available in case the browser asks you to configure it again.

## Troubleshooting

### “`background.scripts` requires manifest version of 2 or lower”

You loaded an old package. Remove that copy and download the current release again. The current Manifest V3 package uses `background.service_worker` and does not contain `background.scripts`.

### “Cannot create item with duplicate id …”

That message comes from an old build that registered browser context-menu items more than once. Remove the old unpacked copy, load only the current extracted folder, and click **Reload**. The current release does not register those old context-menu IDs.

### The page is still partly English

Refresh the HLTV tab after enabling the extension. Confirm that the popup says **Translation enabled**, then check that the provider permission is **Granted** and **Test connection** succeeds. Fixed labels use the bundled glossary; changing news articles and other free text requires a working provider.

### “Translation service request failed” or “No Chinese translation found”

Open the options page and check the base URL, model, API key, network connection, and provider-origin permission. For a custom provider, use HTTPS (HTTP is accepted only for `localhost`, `127.0.0.1`, or `[::1]`) and enter a base URL rather than a full `/chat/completions` URL.

### “Load unpacked” rejects the folder

Select the folder containing `manifest.json` directly. Do not select the downloaded ZIP, the GitHub repository root, or a parent folder that contains the real extension folder.

### The extension icon or popup is missing

Open the browser's extensions page and check that the extension is enabled. Pin it from the Extensions menu. If the browser reports an error, open the extension's **Errors** panel and reload the current release folder after removing older copies.

## Provider and privacy

The API key is stored in `browser.storage.local` on this device. It is sent only to the provider you configure and is not synchronized with a browser account or sent to the extension developer. Provider responses may contain the text you selected or the article text requested for translation; review your provider's privacy policy before use. The local glossary and IndexedDB translation cache remain on the device.

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
```

The build produces a single MV3 background service worker, a single content bundle, the options and popup pages, the dedicated history page, the packaged glossary, and the extension icons.

## Scope and disclaimer

This project is not affiliated with, endorsed by, sponsored by, or otherwise associated with HLTV or hltv.org. The extension depends on HLTV's page structure and may need maintenance when the site changes.
