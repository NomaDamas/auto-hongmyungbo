# test-results — x-data-review

> **测试方式**: fallback 自测(主流程自评)
> **可信度声明**: 本结果由 skill 构造者自评,存在确认偏差风险。建议后续用独立 sub-agent 盲测复核——只给 sub-agent skill 内容 + 用户 prompt + 相邻 skill 列表,不让其看到 type / expected_behavior / notes。
> **测试时间**: 2026-07-14

---

## 逐条自评

### should-trigger-01 ✓ PASS

- **prompt**: "这周发了15条推文,只有2条过百,其他基本都是几十个互动。帮我复盘一下数据,看看哪些内容类型互动率最高,下周该怎么调整内容策略。"
- **预期**: 激活 x-data-review,执行四步闭环(按类型分组→对比分析→优化迭代→记录追踪)。
- **自评**: PASS。用户明确说"复盘数据""调整内容策略",是本 skill 最核心的 trigger。description 中"这周发了15条怎么复盘""下周内容策略怎么调"均为首要 trigger 词。激活后应执行四步:步1按类型分组拉数据;步2对比哪种类型互动高/收藏高;步3问"如果重来"找20%加倍投入;步4建 Notion 模板。
- **失败风险**: 低。trigger 词高度匹配,且用户已明确要复盘操作而非心态调整。

### should-trigger-02 ✓ PASS

- **prompt**: "上个月发了40多条推文,想做个月度复盘。整体互动率大概1.5%,收藏率也不高。帮我分析一下哪些类型的表现好,下个月要不要调整方向?"
- **预期**: 激活 x-data-review,区分月复盘深度(战略层面而非仅数据),互动率1.5%低于2%目标需诊断。
- **自评**: PASS。用户明确说"月度复盘""调整方向",是月复盘的典型 trigger。description 中"月复盘审视战略(变现路径)"覆盖此场景。互动率1.5%<2%目标是诊断信号,对应 E 步骤2的原因分析。
- **失败风险**: 低。但需注意 agent 可能只做数据级复盘而忽略月复盘的战略层面——E 步骤4已明确"月复盘审视战略",应覆盖。

### should-trigger-03 ✓ PASS

- **prompt**: "I've been posting for 3 weeks and want to review which content types get more saves vs likes. List posts seem to get bookmarked a lot but opinion posts get more replies. How should I optimize my content mix for next week?"
- **预期**: 激活 x-data-review,英文 prompt,用户已按类型分组分析且问"怎么优化下周内容组合"。
- **自评**: PASS。英文 prompt 含 "review""which content types""optimize next week" trigger 词,description 中英文双写覆盖此场景。用户已在做步2分析(列表型收藏高/观点型回复高),需要步3优化迭代和步4记录追踪。
- **失败风险**: 低。英文 trigger 词匹配度高。但 "content mix" 一词不在 description trigger 列表中,agent 可能依赖语义理解而非关键词匹配——这是合理的,因为 description 已覆盖"哪些类型互动高""下周策略怎么调"的语义场。

### should-trigger-04 ✓ PASS

- **prompt**: "最近互动率只有1.2%,低于2%的目标。帮我看看是哪里出了问题,是Hook不够吸引还是发布时间不对?"
- **预期**: 激活 x-data-review,执行步2原因分析(查Hook/Body/CTA+发布时间匹配)。
- **自评**: PASS。用户引用了具体指标(互动率1.2%<2%目标)并问原因分析,是 data-review 步2的核心场景。description 中"帮我分析数据"trigger 覆盖。用户自己已提出两个假设(Hook不够/时间不对),正好用四步中的步2逐条排查。
- **失败风险**: 中低。agent 可能误判为 x-short-content-craft(因为提到 Hook),但用户问的是"哪里出了问题"的诊断,不是"帮我写一条",更偏复盘诊断。description 已明确"单条内容生产用 x-short-content-craft"为不适用场景。

### should-not-trigger-01 ✓ PASS

- **prompt**: "我连发了20条推文,只有2条过百,其他基本没人理。我是不是不适合做X?要不要放弃?"
- **预期**: 不应激活 x-data-review,应激活 x-longtail-strategy。用户处于焦虑/自我怀疑状态。
- **自评**: PASS。用户的核心诉求是"该不该放弃"的心态调整,不是"帮我分析数据怎么优化"。虽然"20条只2条过百"表面像复盘场景,但用户的情绪信号("不适合""放弃")指向 x-longtail-strategy 的焦虑心态 trigger。description 已明确"帖子没爆焦虑心态(用x-longtail-strategy)"为不适用场景。
- **失败风险**: 中。这是最容易混淆的兄弟 skill 诱饵——"20条只2条过百"同时出现在 longtail 和 data-review 的 trigger 中。区分关键在用户后续诉求:"该放弃吗"=心态(longtail),"怎么优化"=复盘(data-review)。真实部署中 agent 可能两个都激活,合理做法是先 longtail 校准心态再引导 data-review。

### should-not-trigger-02 ✓ PASS

- **prompt**: "X的For You算法是怎么决定推荐哪些内容给我的?我的帖子为什么没被推到For You信息流里?有没有什么技巧让算法多推我的内容?"
- **预期**: 不应激活 x-data-review,应激活 x-foryou-algorithm。用户问的是算法机制。
- **自评**: PASS。用户问"For You算法怎么决定推荐""没被推到For You信息流",是理解推荐算法机制的典型场景,应走 x-foryou-algorithm。description 已明确"理解推荐算法机制(用x-foryou-algorithm)"为不适用场景。
- **失败风险**: 低。用户直接问"For You算法",指向非常明确。虽然"帖子没被推荐"涉及数据表现,但用户问的是"为什么"(算法机制)而非"怎么复盘"(数据操作)。

### edge-01 ✓ PASS

- **prompt**: "最近一个月数据很平淡,没什么爆款也没有特别差的,大部分帖子都是几十个互动。这种情况需要复盘吗?还是说其实算正常的?"
- **预期**: 边界判断:用户同时问了"需要复盘吗"(data-review)和"算正常吗"(longtail)。应先 longtail 校准再引导 data-review。
- **自评**: PASS(合理处理)。用户问了两个问题——"需不需要复盘"和"算不算正常",是 longtail 和 data-review 的典型重叠场景。期望行为是先用 x-longtail-strategy 回答"算不算正常"(中位数42,几十个互动在正常范围),再引导到 x-data-review 做复盘(平淡也要复盘找20%)。description 已在 A2 区分中写明"longtail 回答'这正不正常',data-review 回答'怎么改'"。
- **失败风险**: 中。这是边界测试,不要求精确匹配某一 skill,只要求判断合理。若 agent 只激活 longtail 而不引导 data-review,或只激活 data-review 而忽略心态校准,都算部分通过。最合理做法是先给长尾基准再引导复盘。

---

## 通过率统计

| 类型 | 总数 | 通过 | 失败 | 通过率 |
|---|---|---|---|---|
| should_trigger | 4 | 4 | 0 | 100% |
| should_not_trigger | 2 | 2 | 0 | 100% |
| edge_case | 1 | 1 | 0 | 100% |
| **合计** | **7** | **7** | **0** | **100%** |

- **minimum_pass_rate**: 0.8
- **实际通过率**: 1.0 (7/7)
- **诱饵测试容错**: 0 (2/2 通过,全部 should_not_trigger 通过)

---

## 失败分析

无失败 case。

### 潜在风险点(虽通过但需关注)

1. **should-not-trigger-01 与 x-longtail-strategy 的边界**: "20条只2条过百"同时出现在两个 skill 的 trigger 中,是最容易混淆的场景。区分关键在用户后续诉求:"该放弃吗"=心态(longtail),"怎么优化"=复盘(data-review)。真实部署中 agent 可能两个都激活——合理做法是先 longtail 校准心态,用户情绪稳定后再引导 data-review 做复盘。建议阶段3建立 composes-with 关系。

2. **should-trigger-04 与 x-short-content-craft 的边界**: 用户提到"Hook不够吸引",可能被误判为内容生产问题。但用户问的是"哪里出了问题"的诊断(复盘),不是"帮我写一条"(生产)。区分关键在用户是在分析已发内容还是创作新内容。

3. **月复盘的战略层面深度**: should-trigger-02 测试了月复盘场景,但 E 步骤4中"月复盘审视战略"的指导较为简略。真实部署中 agent 可能只做数据级分析而忽略战略层面(变现路径/定位调整)。建议后续根据真实使用反馈扩充月复盘的执行指引。

4. **英文 trigger 覆盖**: should-trigger-03 测试了英文场景且通过,但 description 中的英文 trigger 词数量有限。"content mix""content strategy"等表述不在 trigger 列表中,依赖 agent 的语义理解能力。建议后续根据真实使用数据扩充英文 trigger 词。

5. **A2 区分为初稿**: 与相邻 skill 的区分(especially x-longtail-strategy)基于 verified.md 的单元列表推测,阶段3建立链接关系后需回填定稿。当前 longtail 和 data-review 的边界描述("心态 vs 操作")是准确的,但具体 composes-with 的串联顺序(先心态后复盘)需在阶段3确认。

---

## 建议

- 当前 7/7 通过(100%),超过 80% 门槛,skill 可进入交付。
- 建议后续用独立 sub-agent 盲测复核,尤其关注 should-not-trigger-01(x-longtail-strategy 诱饵)的真实抗干扰能力——这是最容易混淆的跨 skill 场景。
- 阶段3建立 related_skills 后,更新 A2 中"与相邻 skill 区分"为定稿,并回填 frontmatter 的 related_skills 字段。
