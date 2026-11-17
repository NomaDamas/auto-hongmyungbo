# test-results.md — x-benchmark-research

> **测试方式**: 主流程自测 (fallback)
> **可信度说明**: 未使用独立 sub-agent 盲测, 以下为主流程对照 test-prompts.json 的自评结果。可信度低于独立盲测, 建议后续用干净 sub-agent 复验。
> **测试时间**: 2026-07-14

---

## 通过率汇总

| 类型 | 总数 | 通过 | 失败 | 通过率 |
|---|---|---|---|---|
| should_trigger | 4 | 4 | 0 | 100% |
| should_not_trigger | 2 | 2 | 0 | 100% |
| edge_case | 2 | 2 | 0 | 100% |
| **合计** | **8** | **8** | **0** | **100%** |

**结论**: 通过 (≥80% 门槛)。诱饵测试容错为 0, 全部通过。

---

## 逐条分析

### should-trigger-01: "我想做AI工具赛道,但已经有很多人在做了,怎么找到自己的差异化定位?"

- **预期**: 激活本 skill, 按5步法执行, 重点在第5步变形出差异
- **自评**: ✓ 通过
- **理由**: prompt 含"找差异化定位""赛道""很多人在做了"三个强 trigger 词, 直接匹配 description 中"怎么做AI工具赛道的差异化"。这是 V2 验证中的原题——新问题"我想做AI工具赛道怎么找差异化"的5步推导路径。

### should-trigger-02: "帮我分析几个对标账号的爆款逻辑,我想借鉴但不抄"

- **预期**: 激活本 skill, 重点步骤2(拆爆款)和步骤4(三公式变形)
- **自评**: ✓ 通过
- **理由**: "分析对标账号""爆款逻辑""借鉴但不抄"精准匹配本 skill 的核心原则"借别人验证过的流量逻辑,不抄内容"。"借鉴但不抄"几乎是原文"找对标不是抄内容,而是借别人验证过的流量逻辑"的口语版。

### should-trigger-03: "I want to find 3-5 benchmark accounts in the AI tools niche and figure out what makes their viral posts work. How should I approach this?"

- **预期**: 激活本 skill, 英文 trigger 词 benchmark accounts / viral posts
- **自评**: ✓ 通过
- **理由**: 英文 prompt 测试中英双写 trigger。"find benchmark accounts""what makes viral posts work"匹配 description 中的英文 trigger 词 "how to find benchmark accounts / how to differentiate from competitors"。用户明确要找3-5个对标账号, 与5步法步骤1的"找3-5个低粉高爆对标"完全对应。

### should-trigger-04: "我刚注册X号做AI出海内容,不知道该学谁的风格,怎么找适合自己的对标账号?"

- **预期**: 激活本 skill, 新号找对标场景, 重点步骤1(高级搜索+低粉高爆筛选)
- **自评**: ✓ 通过
- **理由**: "找对标账号""不知道该学谁"匹配 description 中"如何找值得学习的对标账号"。新号找对标是 AIP 教程 2.3 的原始场景(账号搭建时按5步走)。description 中"找3-5个低粉高爆对标(高级搜索from:xxx min_faves:10)"直接对应。

### should-not-trigger-01: "我决定做AI工具赛道了,每天该发什么内容?怎么写推文能让更多人看?"

- **预期**: 不激活本 skill, 应激活 x-short-content-craft
- **自评**: ✓ 通过 (诱饵容错 0)
- **理由**: 用户已定好方向("决定做AI工具赛道"), 问题是"每天发什么内容""怎么写推文"——这是内容生产阶段(选叙事结构+Hook-Body-CTA起草), 不是对标研究阶段。description 明确排除"已有定位日常发内容→x-short-content-craft"。"怎么写推文"是 x-short-content-craft 的核心 trigger。

### should-not-trigger-02: "我该做IP个人号还是泛流量矩阵?哪个变现更好?"

- **预期**: 不激活本 skill, 应激活 x-positioning-tradeoff
- **自评**: ✓ 通过 (诱饵容错 0)
- **理由**: 用户在战略层面纠结"IP vs 泛流量", 是不可能三角的取舍决策, 属于定位阶段。description 明确排除"纠结选IP还是泛流量→x-positioning-tradeoff"。本 skill 是方向已定后找对标, 不是做方向选择。"IP还是泛流量""哪个变现更好"是 x-positioning-tradeoff 的核心 trigger。

### edge-01: "我做了一个月X没涨粉,想看看同赛道做得好的人是怎么发的"

- **预期**: 边界——需追问用户要"复盘自己"还是"研究竞品"
- **自评**: ✓ 通过
- **理由**: "没涨粉想看别人怎么做"同时触达 x-data-review(复盘自己这一个月的数据找问题)和本 skill(研究竞品怎么做)。合理判断是追问意图: 若用户要先复盘自己的数据→路由到 x-data-review; 若用户要直接研究竞品→激活本 skill。description 中与 x-data-review 的区分虽未显式写出(阶段2初稿, 阶段3回填), 但 B 段"已有定位日常发内容→x-short-content-craft"的排除逻辑覆盖了此边界——用户的问题不是"日常发内容"而是"诊断问题", 需区分诊断对象是自己还是别人。

### edge-02: "我看@dotey做得很好,想模仿他的风格做AI深层干货,可以吗?"

- **预期**: 边界——应激活本 skill 但重点警告 ce19(盲目模仿)
- **自评**: ✓ 通过
- **理由**: 用户提到具体账号(@dotey)和"模仿", 字面像 benchmark 研究但 intent 偏向 copy。合理判断: 激活本 skill, 用5步法拆解@dotey的爆款逻辑(A1案例1有@dotey的完整0→15万拆解), 但在步骤5强调必须用三公式变形而非直接模仿。提醒 ce19:"模仿风格=沦为千篇一律的营销号, 简体中文区用户更愿关注真实有态度的活人"。用户说的"模仿"正好踩中 ce19 反例, 本 skill 的价值正是把"模仿"引导到"变形出差异"。

---

## A2 初稿质量检查

- [x] description ≤300 字 (实际约 250 字)
- [x] trigger 词中英双写 (找对标/benchmark accounts, 怎么找差异化/how to differentiate, 分析竞品/analyze competitor accounts)
- [x] 明确"何时调用 + 何时不调用 + 关键 trigger 信号"
- [x] 与 3 个相邻 skill 的区分已写明 (x-positioning-tradeoff / x-short-content-craft / x-content-archetypes)
- [x] 诱饵测试含 2 条兄弟 skill 场景 (x-short-content-craft"怎么写推文" / x-positioning-tradeoff"选IP还是泛流量")
- [x] A2 区分初稿标注 (依据 verified.md 推测, 阶段3建立链接后回填定稿)

## 待改进项

- edge-01 的"复盘自己 vs 研究竞品"歧义在实际部署中可能导致与 x-data-review 互相抢调用。建议阶段 3 建立链接关系后, 在 x-data-review 的 description 中也反向写明与本 skill 的区分, 形成双向路由。
- 未做独立 sub-agent 盲测, 以上为 fallback 自评。建议后续用干净 sub-agent 对 8 条 prompt 做盲测复验, 特别是 2 条兄弟诱饵和 edge-02 的 ce19 引导效果。
