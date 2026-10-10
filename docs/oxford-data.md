# 牛津官方数据与核对入口

核查日期：2026-10-09。当前实现只提供官方网页入口，未接入牛津 API，也未打包官方词表、释义或音频。所有模型输出均须作为参考信息显示。

## 用户可用入口

- [Oxford Learner's Dictionaries](https://www.oxfordlearnersdictionaries.com/)：核对单词的词性、释义、音标和官网提供的录音。
- [Oxford 3000 / 5000 词表](https://www.oxfordlearnersdictionaries.com/wordlists/oxford3000-5000)：核对官网列出的 CEFR 等级。词表包含词性等筛选；不同词性或义项可能需要分别核对，不能把一个等级直接当成所有用法的难度。
- [词表说明](https://www.oxfordlearnersdictionaries.com/about/wordlists/oxford3000-5000)：Oxford 3000 覆盖 A1–B2，Oxford 5000 增加 B2–C1 的词汇。

词典卡片提供“牛津官方词典核对”和“牛津官方等级词表”，用户点击后在新标签页打开。即使模型翻译失败，单词卡片也保留这些链接。搜索词使用编码后的当前结果词，浏览器不会自动下载词条；未提交的输入不会改变旧结果对应的链接。

查词 URL 使用 `https://www.oxfordlearnersdictionaries.com/search/english/direct/?q=...`。此地址来自官网实际词条页的搜索表单 action 和名为 q 的字段；核查原始 HTML 留在不提交的 `raw-capture/oxford-exhaustion-page.html`。没有推测词条路径或绕过网站访问规则。

## 当前数据来源

| 项目 | 插件实际来源 | 展示方式 |
| --- | --- | --- |
| 中文释义、英文解释、例句、原形 | 用户配置的翻译模型；此前查询可能来自本机缓存 | 卡片标注模型来源；原形未知时省略，禁止按 ed 词尾删字猜测 |
| CEFR 难度 | 模型参考值，未通过官方词表核验 | “CEFR 参考等级（模型）”，不使用“牛津官方等级”字样 |
| UK/US 音标 | 模型参考值 | 模型来源说明；不确定时要求服务商省略 |
| 发音 | 浏览器系统语音合成 | 按钮提示“系统语音（非牛津录音）” |

本地 v1.0.3 使用设备可用语音列表优先匹配对应口音。缺少对应口音时明确提示后备语音；没有可用语音、初始化尚未完成或播放失败时给出提示。卡片关闭或更新结果时取消旧播放，不会悄悄把系统声音当成官方录音。实现参考 [getVoices](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/getVoices) 和 [utterance error 事件](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance/error_event)；实际声音仍由设备与浏览器决定，尚未进行浏览器听音验证。

旧缓存和历史不会被清空。带冒号或不带冒号的旧 `Oxford/CEFR 难度` 字段仍能被解析，显示时按模型信息标注；历史页和 CSV 导出的旧标题也改用参考等级。历史页及 CSV 的原形仅取自已保存的服务商原始响应；此前自动猜测、没有响应字段支持的原形不再显示，但原始记录保留。模型给出的原形也需要在官网核对。

## API 与授权边界

- [API 入门与认证](https://developer.oxforddictionaries.com/documentation/getting_started)：使用 App ID / App Key，不能把真实密钥提交到仓库或聊天中。
- [API FAQ](https://developer.oxforddictionaries.com/faq)：介绍词条和发音字段，并说明缓存/离线数据使用需要 Enterprise 许可。实际套餐及字段应以申请时的说明为准。
- [API 条款](https://developer.oxforddictionaries.com/api-terms-and-conditions?tab=noncommercial)：6.1.1 涉及与 AI 工具结合的限制；6.1.2 涉及保存/缓存限制；14 涉及来源及权利标识。
- [网站条款](https://www.oxfordlearnersdictionaries.com/terms-and-conditions)：官网可浏览不等于允许系统复制、打包和再分发内容。

所有者确认尚无 API 凭据及相关授权，选择先提供官方核对入口。因此本阶段没有新增 Oxford 请求权限、自动抓取器、离线官方词库或录音下载。未来接入需先确认具体数据产品是否提供所需的 CEFR/词性/义项字段，以及许可证是否覆盖本插件的 AI、缓存、历史、收藏和分发用途；本文件不作已获得授权的结论。
