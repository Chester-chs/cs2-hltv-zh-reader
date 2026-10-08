# CS2 HLTV 中文阅读器

<p align="center">
  <a href="README.md">English</a> | <a href="README.zh-CN.md">中文</a>
</p>

这是一个开源的 Chrome 与 Edge 扩展，用中文帮助阅读 HLTV。已确认的界面词条使用内置词典离线翻译，新闻正文和其他可翻译文本使用可配置的 OpenAI 兼容翻译服务。

## 功能

- 支持完全中文和中英对照两种页面模式。
- 导航、筛选器、统计数据和固定界面词条支持离线翻译。
- 支持 DeepSeek、OpenAI 和自定义 OpenAI 兼容翻译服务。
- 支持备用翻译服务和 IndexedDB 离线缓存。
- 选中单词后显示牛津式词典卡片：中文释义、简明英文解释、词性、动词原形、英美音标、发音按钮、编辑查询、收藏和调整大小。
- 选中句子或短语后显示整句中文翻译；即使页面翻译关闭，选词功能仍然可用。
- 历史记录与收藏使用独立页面管理。
- 翻译卡片内可直接切换浅色、深色、跟随系统主题并调整字号。
- 使用自定义扩展图标，采用 Chrome/Edge MV3 Service Worker。

## 安装

1. 从[首个发布版本](https://github.com/Chester-chs/cs2-hltv-zh-reader/releases/tag/v1.0.0)下载 `CS2-HLTV-Chinese-Reader-v1.0.0.zip`。
2. 解压 ZIP，确保 `manifest.json` 位于解压目录的根目录。
3. 打开 `chrome://extensions` 或 `edge://extensions`。
4. 开启“开发者模式”，点击“加载已解压的扩展程序”，选择解压目录。
5. 打开扩展设置，选择翻译服务，填写 API Key，授权服务商域名并测试连接。
6. 刷新 HLTV 页面，在工具栏弹窗中开启翻译并选择完全中文或中英对照。

## 服务商与隐私

默认服务商为 DeepSeek，也支持 OpenAI 和自定义的 OpenAI 兼容 HTTPS 地址；HTTP 仅允许本机回环地址。API Key 只保存在本机浏览器的 `browser.storage.local` 中，只会发送给你配置的服务商，不会同步到浏览器账号，也不会发送给扩展开发者。

## 开发

```bash
npm install
npm test
npm run typecheck
npm run build
```

构建结果包含单一 MV3 后台 Service Worker、单一内容脚本、设置页、工具栏弹窗、独立历史页、内置词典和扩展图标。

## 范围与声明

Firefox 暂缓支持，因为验证时其后台事件页没有启动。本项目与 HLTV 或 hltv.org 没有任何隶属、认可、赞助或其他关联关系。扩展依赖 HLTV 的页面结构，网站改版后可能需要维护。
