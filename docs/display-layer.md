# Gate 5 B1：显示层纯逻辑

## 范围

B1 只计算显示决策，不执行显示决策：

- 不操作真实 DOM；
- 不调用 `appendChild`、`textContent` 或其他节点 API；
- 不写 content script、观察器或设置界面；
- 不修改 manifest；
- 输入是纯数据，输出是 `RenderIntent`；
- 最初只覆盖 `/matches`；当前扩展还覆盖已侦察的新闻分区标题、新闻卡标题、文章标题和正文、比赛评论、五个静态比赛详情模块标题、地图统计标签、比赛筛选标签、已捕获的共享侧栏和页脚文案、玩家周卡片静态标签和部分侧栏操作按钮，以及全站主导航和登录标签。

这不代表所有 HLTV 路由均已覆盖。2026-09-26 的 `curl.exe` 请求遭 Cloudflare challenge 拦截，但普通 Chrome 页面成功显示 `/events`、`/results`、`/ranking/teams` 和 `/players/archive/active` 的部分内容。结果页和选手目录目前只增加了窄范围标题候选；筛选器 CSS 类与可见标签的实际绑定仍为 `Unable to confirm`。Terms 页只翻译共享界面，契约正文保留英文。比赛详情页的 maps/比分区也不纳入本阶段，整体布局证据为 `Unable to confirm`。

文章截图补充依据本地捕获的文章页源码：玩家周卡片仅翻译 `.playerOfTheWeekCategory` 和 `.playerOfTheWeekTitle`；`MINIGAME` 与 `Play` 按钮仅替换文字节点，CSS 生成的 `NEW` 徽标、游戏名、玩家身份和数值不变。左侧排行榜 CTA 的嵌套更新时间和日期由更具体的 `never` 策略保护，赛事日历链接仅替换显示标签。登录标签为 `.navsignin`。这批选择器没有扩展到未观察的页面区域。

## 节点抽象与生命周期

```ts
type DisplayNodeKey = string;

interface DisplayElementInfo {
  tagName: string;
  classes: readonly string[];
  attributes: Readonly<Record<string, string>>;
}

interface DisplayNodeInfo {
  key: DisplayNodeKey;
  parent: DisplayElementInfo;
}
```

节点信息是可用普通对象构造的纯数据。记录表只保存逻辑 key、父元素信息、原文、译文和策略，不保存真实 DOM 节点引用。

这样不会因为长生命周期记录表阻止节点回收。B2 负责维护短生命周期的 `key -> 真实节点` 映射，并在节点移除时调用记录表的 `remove`。如果将来需要由核心层持有真实节点，必须另行设计弱引用或明确释放机制。

## 选择器集中管理

所有页面选择器位于 `src/core/display/selectors.ts`。每条 `SelectorDefinition` 包含 CSS 选择器、纯数据匹配器、页面区域、最后验证日期、证据引用和可选的路由前缀或精确路径。内容层只在路径匹配时查询路由限定选择器，策略解析也使用同一路径，避免这些策略影响其他页面。页面区域目前包括比赛列表、赛事页、战队排名页、结果/选手目录标题、结果页筛选候选、Fantasy 概览标题、Live 全屏/影院控制、全局动态时间字段、全站主导航、新闻索引、新闻列表、新闻正文、比赛评论、共享侧栏/页脚和比赛详情标题/统计标签。

现有 CSS 与本地页面捕获证据日期为 `2026-09-20`；赛事、排名、结果、选手目录、Fantasy 和 Live 页的新增可见页面证据日期为 `2026-09-26`，见 `docs/findings.md` 的浏览器可见路由补充。事件标题的实际 DOM 类绑定、结果筛选器类与可见标签的对应关系，以及 Fantasy/Live 可访问性角色到 CSS 标签的对应关系仍为 `Unable to confirm`。结果页筛选候选仅限 `/results`；主标题候选仅限 `/results` 与 `/players/archive`；Fantasy 标题和 Live 控件使用精确路径白名单，避免进入游戏详情页或 Live 子路由。

选择器不散落在策略解析或渲染决策代码中。未来页面改版时，相关选择器应只在该文件更新。

## 策略表

`ELEMENT_STRATEGIES` 是只读数据表。每条策略包含：

- `id`：策略标识；
- `selectorId`：对应的集中式选择器；
- `translation`：`never` 或 `allowed`；
- `allowedModes`：允许的显示模式；
- `priority`：多个规则同时命中时的优先级；
- `rationale`：策略原因。

当前策略：

| 元素 | translation | allowedModes | 原因 |
|---|---|---|---|
| `.match-teamname` | `never` | `[]` | 队名保持 canonical name |
| `.match-event` | `allowed` | `['A', 'B']` | 无固定宽高约束，双语可行 |
| `.match-stage` | `allowed` | `['A']` | 固定宽高，插入可能裁切或溢出 |
| `.match-meta` | `allowed` | `['A']` | 固定宽度，插入可能裁切或溢出 |
| `.match-time` | `never` | `[]` | 动态/纯值，整体按不翻译处理 |
| `.current-map-score` | `never` | `[]` | Socket.IO 实时写入 |
| `.match-team-livescore` | `never` | `[]` | 实时比分写入 |
| `[data-time-format][data-unix]` | `never` | `[]` | 页面时区逻辑会重写文本 |
| `[data-countdown-target-timestamp]` | `never` | `[]` | 倒计时每秒覆写文本 |
| `.index .newsline.article .newstext` | `allowed` | `['A', 'B']` | 已检查的归档标题容器可伸缩 |
| `.newsdsl .newstext-con` | `allowed` | `['A', 'B']` | 已检查的正文容器无固定尺寸或隐藏溢出 |
| 正文中 `[data-tooltip-id]` 的元素 | `never` | `[]` | 带 tooltip 的队伍/选手实体保持原样 |
| `.forum .post .forum-middle` | `allowed` | `['A', 'B']` | 中文模式替换完整的可翻译评论；双语模式追加对照；语言不确定时保留原文 |
| `.index h2.newsheader` | `allowed` | `['A', 'B']` | 匹配已检查首页的三个新闻分区标题和新闻归档页标题 |
| 比赛详情指定模块的 `.headline` | `allowed` | `['A']` | 只替换五个已检查的静态标题；不插入双语兄弟节点 |
| `.navbar .navcon a.nav-link` | `allowed` | `['A']` | 仅替换主导航标签；保留链接属性和图标，避开会裁切插入节点的手机菜单布局 |
| 新闻文章 `h1.headline` | `allowed` | `['A', 'B']` | 中文模式替换样本文章标题；双语模式追加译文兄弟节点 |
| 捕获的共享侧栏 `h1` | `allowed` | `['A']` | 只替换已列入精确选择器的静态模块标题；排除动态统计和 CSS 徽标 |
| 比赛列表小节标题、筛选面板标题/标签 | `allowed` | `['A']` | 只替换已捕获的固定标签；地区计数和赛事名称不进入标签策略 |
| 比赛详情地图统计页签 | `allowed` | `['A']` | 只替换按钮中的 `Win %`、`Pick %`、`Ban %` 标签，不修改统计数据 |
| 共享页脚文案/链接 | `allowed` | `['A']` | 替换已捕获模板中的静态页脚文字，不添加节点，保留链接与责任博彩图标 |
| 无匹配 | `never` | `[]` | 保守默认值 |

纯数据匹配器支持 class、属性集合、标签名和“标签名 + class”组合。它们与对应 CSS 选择器一起保存在 `src/core/display/selectors.ts`；匹配器本身不读取 DOM。

虽然 `/matches` 的 CSS 侦察显示 `.match-time` 没有固定宽度，B1 仍把它整体标为 `never`。这与全局 `data-time-format`/`data-unix` 禁翻规则在行为上等价，但由元素策略直接表达，更简单且不容易漏判动态时间值。

动态写入属性优先于普通 class 策略。未知元素不会因为默认模式或未来新增译文而自动翻译。评论策略支持中文替换和双语追加，且沿用保守语言分类。

## RenderIntent

```ts
type RenderIntent =
  | {
      kind: 'noop';
      nodeKey: DisplayNodeKey;
      originalText: string;
      strategyId: string;
      reason:
        | 'policy-never'
        | 'mode-not-allowed'
        | 'same-text'
        | 'empty-original'
        | 'empty-translation';
    }
  | {
      kind: 'replace-text';
      nodeKey: DisplayNodeKey;
      originalText: string;
      translatedText: string;
      strategyId: string;
    }
  | {
      kind: 'append-sibling';
      nodeKey: DisplayNodeKey;
      originalText: string;
      translatedText: string;
      strategyId: string;
      attributes: {
        'data-hltv-zh': '1';
        translate: 'no';
      };
    };
```

```ts
decideRenderIntent(
  node: DisplayNodeInfo,
  original: string,
  translated: string | undefined,
  mode: 'A' | 'B',
  strategy: ElementStrategy
): RenderIntent;
```

决策规则：

- `never` 策略始终返回 `noop`；
- 原文为空、译文为空/未定义或译文等于原文时返回 `noop`；
- 模式 A 返回 `replace-text`；
- 模式 B 返回 `append-sibling`，并携带 `data-hltv-zh="1"` 与 `translate="no"`；
- 模式 B 请求仅允许模式 A 的元素时返回 `noop`，原因是 `mode-not-allowed`。

选择 `noop` 而不是自动降级到模式 A，是为了避免页面出现“部分双语、部分仅中文”的不一致。用户明确请求了双语模式时，静默替换原文会隐藏失败原因；`mode-not-allowed` 可以让 B2 或后续日志观察到该决策，同时避免破坏固定尺寸布局。

渲染器返回意图而不是直接操作 DOM，是为了让所有规则在 Node 环境中独立测试，并把 DOM 生命周期、节点解析和实际执行集中留给后续 B2。

## 记录表

```ts
interface DisplayRecord {
  node: DisplayNodeInfo;
  original: string;
  translated?: string;
  strategy: ElementStrategy;
}

interface DisplayRecordTable {
  register(
    node: DisplayNodeInfo,
    original: string,
    strategy: ElementStrategy
  ): boolean;
  get(key: DisplayNodeKey): DisplayRecord | undefined;
  updateTranslation(key: DisplayNodeKey, translated: string | undefined): boolean;
  remove(key: DisplayNodeKey): boolean;
  clear(): void;
  size(): number;
  entries(): readonly DisplayRecord[];
  decideAll(mode: 'A' | 'B'): RenderIntent[];
}
```

`register` 的语义是：返回 `true` 表示记录已写入；返回 `false` 表示未写入。空 key 或重复 key 都返回 `false`，重复 key 时已有记录保持不变。调用方若要替换原文，必须先 `remove` 再 `register`。

B2 不得忽略 `register` 的返回值。忽略失败会使记录表继续保留过期原文；由于原文是唯一权威来源，这会造成 no-noise 判断错误和译文对照错位。

`updateTranslation` 只能改变译文，不能改变原文。`decideAll` 只遍历已有记录并重新计算意图，不重新翻译，也不接收 Provider。


## 0.0.3 内容兜底与界面属性

已确认的固定文字通过 `body` 策略和完整词库匹配进入显示记录表；统计、资料页词条按路径隔离。未知短文本不注册。已知公开页面中满足四个 Latin 词及 prose 分类的正文，可使用单独的 `page-prose` 兜底策略。策略、路径、排除项和选择器均为集中数据，未推测具体页面的 class 绑定。

输入 placeholder 的首次可翻译值作为原文注册，随后恢复只使用内存记录；页面写入新提示时，旧记录失效并登记新的原文。输入 value 不读取、不修改。CSS 徽标使用可移除的词库样式覆盖。切换模式或关闭翻译时恢复提示、移除样式。DOM 操作仅在 content 层。

本地标签在等待 Provider 前渲染。Provider 文本按每批 20 项/6,000 字符处理，单个超长记录保持完整。各批完成后逐批显示；这不改变核心 TranslationService 每次调用内部的一批请求约定。页面写入新正文/标签时，兜底记录会失效并重新处理。

## 0.0.4 固定说明与辅助标签

统计路径上的标准 title、aria-label 使用集中定义的路径和词库类别，只替换完整已知文字。属性目标及其祖先遵循既有实时数据、时间、可编辑内容等保护；输入 placeholder 保留原有例外。页面使已翻译目标进入保护区域后，只有仍为插件译文的属性才从内存恢复，页面自己写入的新值不会被覆盖。属性观察范围由集中目标数据派生。真实说明与具体属性的绑定仍未确认。
