# test-results.md — x-foryou-algorithm 压力测试结果

> **测试方式**: fallback 主流程自测（当前环境无独立 sub-agent 盲测能力）
> **可信度声明**: 本结果为 skill 构造者自评，可信度低于独立 sub-agent 盲测。建议在交付前用干净 agent 做独立盲测复验，尤其 edge-01。
> **测试时间**: 2026-07-14

---

## 逐条评估

### should-trigger-01: 小号能不能被推荐
- **prompt**: "我只有200个粉丝，发的内容真的能被推荐吗？X的算法会不会只推大号的帖子？小号还有机会吗？"
- **预期**: 激活 x-foryou-algorithm，用 OON 占比 60-70% + 候选隔离解释小号单帖可凭质量进入推荐池
- **自评**: ✓ PASS
- **理由**: prompt 直接命中 description 中的 trigger "小号能起吗"+"算法"。description 明确列出"用户想理解...小号能不能被推荐时使用"。这是本 skill 最核心的 V2 预测场景（200 粉小号能否被推荐）。激活后应讲解 OON 倾斜 + 候选隔离 → 单帖按自身质量评分不靠粉丝量。

### should-trigger-02: For You 算法机制
- **prompt**: "X的For You算法到底是怎么决定推什么内容的？为什么有的帖子几万曝光有的只有几十？推荐机制是怎样的？"
- **预期**: 激活 x-foryou-algorithm，讲解双源召回 + 多动作加权 + 候选隔离
- **自评**: ✓ PASS
- **理由**: prompt 直接命中 trigger "For You 算法"+"推荐机制"。这是最直接的"想理解推荐机制本身"场景。激活后应讲解三大设计决策和流水线结构。

### should-trigger-03: rage-bait 降权
- **prompt**: "我注意到发争议性内容互动很高但曝光反而下降了，是不是算法在压我？rage-bait是不是被降权了？"
- **预期**: 激活 x-foryou-algorithm，用多动作加权解释 rage-bait 虽 P(reply) 高但 block/mute/report 负权重更高
- **自评**: ✓ PASS
- **理由**: prompt 命中 trigger "算法降权"+"rage-bait"。description 将"rage-bait/负面内容为什么没流量"列为触发场景。激活后应讲解负权重机制——P(reply) 高但 P(block)/P(mute)/P(report) 负权重更高，综合分反而降低。

### should-trigger-04: 收藏 vs 点赞权重
- **prompt**: "收藏和点赞对X算法来说权重一样吗？我应该优化哪个指标来提升推荐？"
- **预期**: 激活 x-foryou-algorithm，用多动作加权模型解释收藏权重高于点赞
- **自评**: ✓ PASS
- **理由**: prompt 命中 trigger "收藏和点赞"+"算法权重"+"推荐"。用户明确问动作权重差异，这是多动作加权模型的核心应用。激活后应讲解收藏是"未来行动信号"权重高于点赞。

### should-not-trigger-01: 帖子没爆心态焦虑（兄弟 skill 诱饵）
- **prompt**: "我连发了20条只有2条过百，是不是该放弃了？感觉自己不适合做X，一条没爆就怀疑人生。"
- **预期**: 不应激活本 skill，应激活 x-longtail-strategy
- **自评**: ✓ PASS（正确不触发）
- **理由**: prompt 是心态焦虑"帖子没爆怎么办"，是 longtail-strategy 的长尾分布心态场景（中位数 42 是常态，目标是提高进前 10% 概率）。description 明确排除"心态焦虑'帖子没爆怎么办'(那是 longtail-strategy)"。用户问的是"该不该放弃"而非"算法怎么工作"，不触发本 skill 正确。

### should-not-trigger-02: 评论区互动技巧（兄弟 skill 诱饵）
- **prompt**: "怎么在大V的评论区获得曝光又不像蹭流量？评论区互动有什么技巧可以快速涨粉？"
- **预期**: 不应激活本 skill，应激活 x-comment-engagement
- **自评**: ✓ PASS（正确不触发）
- **理由**: prompt 问"怎么互动获曝光"是行动层，本 skill 只解释"算法如何评估互动价值"是机制层。description 明确排除"怎么互动获曝光(那是 comment-engagement)"。用户要的是互动技巧（重述观点+补充经验模板、Repost vs Quote），不是算法权重分析，不触发本 skill 正确。

### should-not-trigger-03: 纯写内容（诱饵）
- **prompt**: "帮我写一条介绍Raycast这个工具的推文，要有点击欲的那种。"
- **预期**: 不应激活本 skill，应激活 x-short-content-craft
- **自评**: ✓ PASS（正确不触发）
- **理由**: prompt 是纯内容写作请求，description 明确排除"纯写内容不问机制"。虽然"点击欲"表面上与 P(click) 相关，但用户要的是 Hook-Body-CTA 起草（x-short-content-craft），不是算法理解。不触发本 skill 正确。

### edge-01: 帖子沉了 + 算法判断（边界）
- **prompt**: "我的帖子发出去前1小时没什么互动然后就沉了，这正常吗？算法是怎么判断要不要继续推的？"
- **预期**: 边界判断——因用户明确问"算法是怎么判断要不要继续推的"侧重机制，可触发本 skill；但若追问"我该怎么办"应转交 x-cold-start-playbook
- **自评**: ✓ PASS（合理判断，但标为高风险）
- **理由**: prompt 同时涉及算法机制（"算法怎么判断"）和冷启动执行（"前1小时没互动就沉了"）。用户后半句"算法是怎么判断要不要继续推的"明确问机制，倾向触发本 skill 讲解"初始互动信号 → 算法判定质量 → 推入更大推荐池"。但前半句"这正常吗"带心态色彩，且"前1小时"是 cold-start 黄金窗口的经典场景，独立盲测时有可能被判为 x-cold-start-playbook。
- **风险标注**: 这是全量测试中最高风险的 case。建议独立盲测时重点验证。若独立 agent 选择 cold-start 而非本 skill，不算硬失败——两者的区分信号确实模糊，需要看用户后续追问方向。

---

## 通过率统计

| 类型 | 总数 | 通过 | 失败 | 通过率 |
|---|---|---|---|---|
| should_trigger | 4 | 4 | 0 | 100% |
| should_not_trigger | 3 | 3 | 0 | 100% |
| edge_case | 1 | 1 | 0 | 100% |
| **合计** | **8** | **8** | **0** | **100%** |

- **minimum_pass_rate**: 0.8
- **实际通过率**: 1.0 (100%)
- **诱饵容错**: should_not_trigger 全部通过（容错为 0），其中 2 条是兄弟 skill 场景（longtail-strategy / comment-engagement）

## 失败分析

无硬失败。

### 潜在风险（独立盲测可能暴露的问题）

1. **edge-01 高风险**：帖子沉了 + 算法判断的边界场景，独立 agent 可能选择 x-cold-start-playbook 而非本 skill。这不是 description 的缺陷，而是场景本身模糊——用户同时问了机制和行动。建议在 description 中进一步强化"问'算法为什么这样做'→本 skill；问'我该怎么操作'→cold-start"的区分信号（已在 B 段写明，但 description 字段中未显式展开）。

2. **should-trigger-04 与 x-data-review 的潜在混淆**：用户问"我应该优化哪个指标"可能被 data-review skill 抢调用（data-review 讲 80/20 复盘和指标体系）。但本 prompt 明确问"对算法来说权重一样吗"，侧重算法权重而非数据复盘，区分度足够。若独立盲测暴露混淆，可在 description 中补充"问指标复盘→x-data-review；问算法权重→本 skill"。

### 改进建议（若有独立盲测失败时回炉方向）

- 若 edge-01 失败：在 description 中加入更明确的"算法为什么这样做 vs 我该怎么操作"区分信号。
- 若 should-not-trigger 失败：检查是否是 description 中 trigger 词过宽导致误激活，收窄措辞。
