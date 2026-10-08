# CS2 HLTV Chinese Reader

<p align="center">
  <a href="#english">English</a> | <a href="#chinese">中文</a>
</p>

<a id="english"></a>

## English

An open-source Chrome and Edge extension that makes HLTV easier to read in Chinese. It translates confirmed interface labels offline and uses a configurable OpenAI-compatible provider for article prose and other eligible text.

### Features

- Full-Chinese mode and bilingual mode for supported HLTV pages.
- Offline glossary translation for confirmed navigation, filters, statistics, and fixed labels.
- Article and free-text translation through DeepSeek, OpenAI, or a custom OpenAI-compatible provider.
- Optional fallback provider and IndexedDB translation cache for network failures.
- Select a word to open an Oxford-style dictionary card with Chinese meanings, concise English explanations, parts of speech, verb base forms, UK/US IPA, pronunciation buttons, editing, favorites, and resizing.
- Select a sentence or phrase for a Chinese sentence translation, even when page translation is disabled.
- Separate dictionary history and favorites page.
- Card-level light, dark, system theme, and font-size controls.
- Custom extension logo and Chrome/Edge MV3 service worker.

### Installation

1. Download `CS2-HLTV-Chinese-Reader-v1.0.0.zip` from the [first release](https://github.com/Chester-chs/cs2-hltv-zh-reader/releases/tag/v1.0.0).
2. Extract the ZIP. `manifest.json` must be at the extracted folder's root.
3. Open `chrome://extensions` or `edge://extensions`.
4. Enable **Developer mode**, choose **Load unpacked**, and select the extracted folder.
5. Open the extension settings, choose a provider, enter an API key, authorize its origin, and test the connection.
6. Refresh an HLTV page. Use the toolbar popup to enable translation and choose full-Chinese or bilingual display.

### Provider and privacy

The default provider preset is DeepSeek. OpenAI and custom OpenAI-compatible HTTPS endpoints are also supported; HTTP is limited to local loopback addresses. The API key is stored in `browser.storage.local` on this device and is sent only to the provider you configure. It is not synchronized with a browser account or sent to the extension developer.

### Development

```bash
npm install
npm test
npm run typecheck
npm run build
```

The build produces a single MV3 background service worker, a single content bundle, the options and popup pages, the dedicated history page, the packaged glossary, and the extension icons.

### Scope and disclaimer

Firefox is deferred because its background event page did not start during validation. This project is not affiliated with, endorsed by, sponsored by, or otherwise associated with HLTV or hltv.org. The extension depends on HLTV's page structure and may need maintenance when the site changes.

<p align="right"><a href="#chinese">中文</a></p>

<a id="chinese"></a>

## 中文

这是一个开源的 Chrome 与 Edge 扩展，用中文帮助阅读 HLTV。已确认的界面词条使用内置词典离线翻译，新闻正文和其他可翻译文本使用可配置的 OpenAI 兼容翻译服务。

### 功能

- 支持完全中文和中英对照两种页面模式。
- 导航、筛选器、统计数据和固定界面词条支持离线翻译。
- 支持 DeepSeek、OpenAI 和自定义 OpenAI 兼容翻译服务。
- 支持备用翻译服务和 IndexedDB 离线缓存。
- 选中单词后显示牛津式词典卡片：中文释义、简明英文解释、词性、动词原形、英美音标、发音按钮、编辑查询、收藏和调整大小。
- 选中句子或短语后显示整句中文翻译；即使页面翻译关闭，选词功能仍然可用。
- 历史记录与收藏使用独立页面管理。
- 翻译卡片内可直接切换浅色、深色、跟随系统主题并调整字号。
- 使用自定义扩展图标，采用 Chrome/Edge MV3 Service Worker。

### 安装

1. 从[首个发布版本](https://github.com/Chester-chs/cs2-hltv-zh-reader/releases/tag/v1.0.0)下载 `CS2-HLTV-Chinese-Reader-v1.0.0.zip`。
2. 解压 ZIP，确保 `manifest.json` 位于解压目录的根目录。
3. 打开 `chrome://extensions` 或 `edge://extensions`。
4. 开启“开发者模式”，点击“加载已解压的扩展程序”，选择解压目录。
5. 打开扩展设置，选择翻译服务，填写 API Key，授权服务商域名并测试连接。
6. 刷新 HLTV 页面，在工具栏弹窗中开启翻译并选择完全中文或中英对照。

### 服务商与隐私

默认服务商为 DeepSeek，也支持 OpenAI 和自定义的 OpenAI 兼容 HTTPS 地址；HTTP 仅允许本机回环地址。API Key 只保存在本机浏览器的 `browser.storage.local` 中，只会发送给你配置的服务商，不会同步到浏览器账号，也不会发送给扩展开发者。

### 开发

```bash
npm install
npm test
npm run typecheck
npm run build
```

构建结果包含单一 MV3 后台 Service Worker、单一内容脚本、设置页、工具栏弹窗、独立历史页、内置词典和扩展图标。

### 范围与声明

Firefox 暂缓支持，因为验证时其后台事件页没有启动。本项目与 HLTV 或 hltv.org 没有任何隶属、认可、赞助或其他关联关系。扩展依赖 HLTV 的页面结构，网站改版后可能需要维护。

<p align="right"><a href="#english">English</a></p>
