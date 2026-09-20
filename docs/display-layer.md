# Gate 5 B1：显示层纯逻辑

## 范围

B1 只计算显示决策，不执行显示决策：

- 不操作真实 DOM；
- 不调用 `appendChild`、`textContent` 或其他节点 API；
- 不写 content script、观察器或设置界面；
- 不修改 manifest；
- 输入是纯数据，输出是 `RenderIntent`；
- 当前只覆盖 `/matches` 比赛列表页。

新闻页、文章正文、评论区、比赛详情页的 `match-page`/比分区暂不纳入本块。

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

所有比赛列表选择器位于 `src/core/display/selectors.ts`。每条 `SelectorDefinition` 包含 CSS 选择器、纯数据匹配器、页面区域、最后验证日期和证据引用。

当前证据日期为 `2026-09-20`，主要来源为 `docs/findings.md` 的 P0-3 `/matches` CSS 侦察小节；全局时间属性另引用新闻与文章页侦察小节。

选择器不散落在策略解析或渲染决策代码中。未来页面改版时，比赛列表选择器应只在该文件更新。

## 策略表

`ELEMENT_STRATEGIES` 是只读数据表。每条策略包含：

- `id`：策略标识；
- `selectorId`：对应的集中式选择器；
- `translation`：`never` 或 `allowed`；
- `allowedModes`：允许的显示模式；
- `priority`：多个规则同时命中时的优先级；
- `rationale`：策略原因。

当前比赛列表策略：

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
| 无匹配 | `never` | `[]` | 保守默认值 |

虽然 `/matches` 的 CSS 侦察显示 `.match-time` 没有固定宽度，B1 仍把它整体标为 `never`。这与全局 `data-time-format`/`data-unix` 禁翻规则在行为上等价，但由元素策略直接表达，更简单且不容易漏判动态时间值。

动态写入属性优先于普通 class 策略。未知元素不会因为默认模式或未来新增译文而自动翻译。

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

