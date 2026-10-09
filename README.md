# CS2 HLTV Chinese Reader

<p align="center">
  <a href="README.md">English</a> | <a href="README.zh-CN.md">中文</a>
</p>

An open-source Chrome and Edge extension that makes HLTV easier to read in Chinese. Confirmed interface labels are translated locally from the bundled glossary. News articles, forum prose, dictionary lookups, and other eligible free text use the translation provider configured by you.

> **Important:** this is an unpacked developer extension. It is not installed from the Chrome Web Store. Download the ZIP, extract it, and load the extracted folder from the browser's extension page.

## v1.0.1 changes (2026-10-09)

This update saves the current Chinese reading and dictionary experience. Compared with v1.0.0:

- **Chinese-reader interface:** the popup returns to the original release layout. Popup, options, and history open in Chinese without a language or native-language selection step. Legacy English interface settings are normalized to Chinese-reader settings.
- **Dictionary layout:** parts of speech use abbreviations such as `n.`, `v.`, `adj.`, and `adv.`. A different verb base form appears at the bottom. Cards can display provider-returned CEFR levels, examples, and concise English definitions.
- **Card settings:** font size, system/light/dark appearance, and five card colors are grouped behind the gear button. Color-choice text remains readable in dark mode.
- **Separate settings close button:** the settings panel's × closes that panel; the header's × closes the entire dictionary card.
- **Consistent controls:** settings, search, and close share button and icon sizes and stroke weight. The selection magnifier has a translucent frosted-glass appearance. Favorites sit at the right of the pronunciation row.
- **Search without dismissing the card:** search and Enter show a loading message and update the same card, preserving its size and position. The 12-second automatic dismissal is removed. Superseded responses are ignored, and a closed card is not reopened by its pending request.
- **History and study tools:** the dedicated history page adds favorites review and CSV export; entries can retain levels and examples.
- **Translation style:** options offer natural Chinese or a more literal style for ordinary page text.

Word and sentence lookup continue to work when page translation is off. Fallback providers, cached translations, and full-Chinese/bilingual modes remain available. The issues listed under **Known issues** remain outstanding; this release does not claim exhaustive coverage of every HLTV page in a real browser.

## What it provides

- Full-Chinese mode and bilingual mode for supported HLTV pages.
- Chinese-reader workflow focused on Chinese page translation, English word lookup, and bilingual/full-Chinese display.
- The popup, settings page, and history page use a Chinese-only interface for Chinese-native HLTV readers.
- Offline glossary translation for confirmed navigation, filters, statistics, and fixed labels.
- Article, sentence, and free-text translation through DeepSeek, OpenAI, or a custom OpenAI-compatible provider.
- Optional fallback provider and IndexedDB translation cache for network failures.
- Select a word to open an Oxford-style dictionary card with Chinese meanings, concise English explanations, parts of speech, verb base forms, UK/US IPA, pronunciation buttons, Oxford/CEFR levels such as B1, examples, editable lookup text, favorites, and resizing.
- Select a sentence or phrase to show a Chinese sentence translation, even when page translation is disabled.
- Separate dictionary history and favorites page with review mode and CSV export.
- Card-level light, dark, system theme, and font-size controls.
- Custom extension icon and Chrome/Edge Manifest V3 service worker.

## Supported browsers and limits

- Chrome and Microsoft Edge desktop are supported.
- The current content script matches `https://www.hltv.org/*`.
- Firefox is not part of this release. Safari, mobile browsers, and general-purpose web translation are not targets.
- Fixed interface labels can work offline. News titles, article paragraphs, dictionary results, and sentence translations need a configured provider, an API key, permission for that provider's origin, and network access.

## Detailed installation steps

Choose either Chrome or Edge. Extract the package before loading it: the browser needs a folder, not the ZIP file. The following instructions use Windows.

### 1. Download and extract the package

1. Open the [v1.0.1 release page](https://github.com/Chester-chs/cs2-hltv-zh-reader/releases/tag/v1.0.1).
2. Expand **Assets** and download **`CS2-HLTV-Chinese-Reader-v1.0.1.zip`**. GitHub's **Source code** archives and **Code → Download ZIP** are source files, not the installable extension package.
3. Find the downloaded ZIP in File Explorer, usually under Downloads. Right-click it, select **Extract All**, choose a permanent location such as `C:\Users\YourName\Documents\HLTV-Chinese-Reader`, and click **Extract**. Simply opening the ZIP preview does not extract it.
4. Open the extracted folder and check that **`manifest.json` is directly inside it**. The correct layout is:

   ```text
   HLTV-Chinese-Reader\
   ├─ manifest.json
   ├─ background.js
   ├─ content.js
   ├─ options.html
   ├─ popup.html
   ├─ history.html
   ├─ glossary.json
   └─ icons\\
   ```

   If `manifest.json` is inside another nested folder, select that inner folder in the next step. Do not select the ZIP file itself.

### 2. Load it in Chrome

1. In Chrome's address bar, open **`chrome://extensions`**.
2. Turn on **Developer mode** in the upper-right corner.
3. Click **Load unpacked**.
4. Navigate to the extracted folder whose top level contains `manifest.json`, then click **Select Folder**. This dialog selects folders and may hide ZIPs and individual files; that is expected. You can paste the extracted folder's full path into its address bar, press Enter, and then select the folder.
5. Confirm that **CS2 HLTV Chinese Reader** appears in the extension list and that its switch is enabled.
6. Optional: click the puzzle-piece button in the toolbar and pin the extension so its icon is always visible.

### 3. Load it in Microsoft Edge

1. In Edge's address bar, open **`edge://extensions`**.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select the extracted folder containing `manifest.json`.
4. Enable the extension. Pin it from the Extensions button if you want quick access.

### 4. Configure a translation provider

The extension can translate confirmed fixed labels without an API key. To translate news prose, sentences, and dictionary results, complete this setup:

Create an API key with your chosen provider and confirm access to the selected model. Installing the extension does not supply a key or API credits.

1. Open an HLTV page, click the extension icon, and choose **服务商与首次设置**. You can also open the extension's **Details** page and choose **Extension options**.
   - The settings page opens directly in Chinese; there is no interface-language or English-native setup step.
2. In **Provider preset**, choose **DeepSeek**, **OpenAI**, or **Custom**.
   - DeepSeek preset: `https://api.deepseek.com`, model `deepseek-chat`.
   - OpenAI preset: `https://api.openai.com`, model `gpt-4o-mini`.
   - Custom: enter your provider's HTTPS base URL and model name. The extension appends `/v1/chat/completions`; enter the base URL, not the complete chat-completions URL.
3. Paste your own API key into **API Key**. Never send the key to anyone in a chat or issue report.
   - **翻译风格** selects natural Chinese (**自然中文**) or a literal style (**直译**) for ordinary page text.
4. Leave **Use JSON output mode** enabled unless your provider explicitly rejects `response_format`. If it rejects it, turn this option off and test again.
5. Click **Authorize** in the provider permission section and approve the browser permission prompt. The permission is for the provider origin you entered, not for all websites.
6. Click **Save**.
7. Click **Test connection** and wait for **Connection succeeded**. Fix the address, key, model, or permission if the test fails.
8. If you enabled a fallback provider, fill in its base URL, model, and key. Save it and authorize its origin as well.

### 5. Turn on HLTV translation

1. Return to an `https://www.hltv.org/` tab and refresh the page after changing settings.
2. Click the extension icon.
3. Turn on **启用页面翻译** (enable page translation).
4. Choose **完全中文** (full Chinese) to replace eligible English labels, or **双语对照** (bilingual) to keep the original and show Chinese beside it.
5. Open another HLTV page or refresh the current page if some content was already rendered before the extension was enabled.

The extension does not translate team names, player names, scores, dates, live-score widgets, or other data that should remain exact. News prose and other dynamic text are translated only after the provider setup succeeds.

### First-use setup

- The popup and settings page open directly in Chinese for Chinese-native readers.
- There is no English-native onboarding or interface-language selector.
- The workflow keeps English word lookup, Chinese meanings, Oxford/CEFR levels, and Chinese page translation. Chinese reverse lookup is not offered.

## Word lookup, sentence translation, history, and favorites

- Drag over a word. A small magnifier appears beside the selection; click it to open the dictionary card.
- Drag over a sentence or phrase to request a sentence translation. This works even if page translation is switched off.
- The card can show Chinese meanings, a short English explanation, parts of speech, a verb base form, UK/US IPA, and pronunciation buttons. The lookup text can be edited before searching again.
- Provider-returned levels can be A1, A2, B1, B2, C1, C2, or unknown. These are generated by the translation model and are not checked against an official Oxford word list.
- Use the star button to save a word. Use **打开词典历史** (open dictionary history) in the popup to open the dedicated history and favorites page.
- The history page includes **开始复习** (start review) for saved words and **导出 CSV** (export CSV) for Excel, Anki, or other study tools.
- Open the **gear** to adjust font size, theme, and card color. Its panel's × closes settings; the header's × closes the card.
- Edit the query, click **search**, or press **Enter**. The card stays visible while the request runs and updates when the result arrives.
- Drag the card's lower-right corner to resize it. Text and controls scale with its width.
- History keeps at most 50 distinct queries and favorites at most 100 entries. Older entries are removed beyond these limits; export CSV for longer-term retention.
- UK/US pronunciation uses browser system speech, not Oxford dictionary recordings. Available voices depend on the device.

## Updating an existing installation

1. Download the new installation ZIP and extract it to a temporary folder. Confirm that `manifest.json` is directly inside it.
2. Copy all new files and subfolders into the original folder your browser currently loads, replacing matching files. Keeping the same installation path normally preserves settings, history, and favorites.
3. Open `chrome://extensions` or `edge://extensions`, find **CS2 HLTV Chinese Reader**, and click its circular-arrow **Reload** button after file replacement finishes.
4. Confirm version **1.0.1**, then refresh every open HLTV tab. Refreshing a website alone does not reload extension code.
5. Open the popup and check the Chinese interface and display mode. If news translation fails, check permissions and run **测试连接** (test connection).

Changing the installation path can give an unpacked extension a different identity, so settings, history, and favorites may not migrate automatically. Export CSV and retain your provider configuration before changing paths or removing the extension. CSV is not a full settings backup, and automatic import is not implemented.

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

## Known issues

- Semicolons inside one definition can split later meanings into a generic supplementary section.
- If a provider omits the verb base form, the current fallback can infer an incorrect word, such as `liked` → `lik`. Base forms, IPA, and levels need checking.
- Simultaneous history or favorite writes from multiple tabs can overwrite records. Repeated fast favorite clicks can also give unexpected results.
- Editing a different query while a request is pending can lose those unsubmitted edits when its response arrives.
- Already-open cards do not immediately synchronize every appearance change after a system theme change or an update in another tab.
- Coverage depends on HLTV's page structure, and some pages may remain partly English. Offline cache reuse only covers previously cached content, not arbitrary new text.

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
