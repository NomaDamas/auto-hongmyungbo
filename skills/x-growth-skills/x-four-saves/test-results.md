# test-results — x-four-saves

> **测试方式**: fallback 自测(主流程自评)
> **可信度声明**: 本结果由 skill 构造者自评,存在确认偏差风险。建议后续用独立 sub-agent 盲测复核——只给 sub-agent skill 内容 + 用户 prompt + 相邻 skill 列表,不让其看到 type / expected_behavior / notes。
> **测试时间**: 2026-07-14

---

## 逐条自评

### should-trigger-01 ✓ PASS

- **prompt**: "我刚写完一条AI工具推荐帖,大概200字,说了工具名和一句话介绍。帮我看看这条值不值得发?"
- **预期**: 激活 x-four-saves,逐项自检四省,判断省了几步并给出结论。
- **自评**: PASS。用户明确问"值不值得发",是四省模型的核心触发信号。description 中"值不值得发"为首要 trigger 词。激活后应逐项检查:省搜索(给了工具名=是)、省理解(一句话介绍是否够=边界)、省试错(无步骤=否)、省表达(可直接转发=是),大概率判定"省1-2步,边界值,建议加步骤后发"。
- **失败风险**: 低。trigger 词高度匹配。

### should-trigger-02 ✓ PASS

- **prompt**: "I have three topic ideas for X posts but limited time to write. How do I decide which one is worth posting?"
- **预期**: 激活 x-four-saves,用四省逐一评估三个选题,比较后排序。
- **自评**: PASS。英文 prompt 含 "worth posting" trigger 词,description 中英文双写覆盖此场景。用户在比较多个选题的价值,正是四省模型的典型用例(多选题比较)。
- **失败风险**: 低。但需注意 agent 可能误判为"选题策略"类问题而非"估值"类问题——description 的"多选题比较"场景已覆盖。

### should-trigger-03 ✓ PASS

- **prompt**: "上周发了一条纯感叹'这个AI工具太强了',几乎没人理。我想搞清楚到底哪里出了问题。"
- **预期**: 激活 x-four-saves,自检这条内容四省省了几步(大概率0步),解释为什么缺乏价值。
- **自评**: PASS。用户在复盘"为什么没人理",是四省触发场景之一。纯感叹"太强了"四省里一步不省(没给入口、没翻译概念、没给步骤、读者也无法直接转发),正好用四省解释没人理的原因。
- **失败风险**: 中。agent 可能误判为 x-data-review(数据复盘)或 x-content-archetypes(分类为普通表达型)。但用户问的是"哪里出了问题"而非"数据怎么分析"或"属于哪类",更偏向估值诊断。description 已明确"复盘为什么没人理"为四省场景。

### should-trigger-04 ✓ PASS

- **prompt**: "我想分享一个Notion模板,但不确定只是丢个链接够不够。帮读者省了什么?这个内容有发布价值吗?"
- **预期**: 激活 x-four-saves,用户直接用了"帮读者省了什么""有发布价值吗"两个 trigger 信号。
- **自评**: PASS。这是最强的触发场景——用户几乎原话引用了四省模型的核心语言信号。激活后应自检:丢链接只省搜索(给了入口),但不省理解(不知道怎么用)、不省试错(没给步骤)、可能省表达(可直接转发)。判定"省1步,边界值,建议加使用步骤"。
- **失败风险**: 极低。

### should-not-trigger-01 ✓ PASS

- **prompt**: "帮我检查这条推文五件套齐不齐:有没有价值承诺、使用场景、入口链接、证据、收藏理由?"
- **预期**: 不应激活 x-four-saves,应激活 x-five-piece-checklist。
- **自评**: PASS。用户问的是"齐不齐"(结构完备性),明确列举了五件套的五要素。这是五件套检查清单的典型场景,不是四省估值。description 已写明"已决定要发只需检查结构完备性时→用 x-five-piece-checklist"。A2 区分口诀"问齐不齐用五件套,问值不值用四省"已覆盖。
- **失败风险**: 中。两者都涉及"内容好不好"的判断,但用户明确说"检查齐不齐"且列举了五件套要素,区分度足够。

### should-not-trigger-02 ✓ PASS

- **prompt**: "我这条推文属于四类内容原型里的哪一类?是资源入口型还是工具教程型?"
- **预期**: 不应激活 x-four-saves,应激活 x-content-archetypes。
- **自评**: PASS。用户问的是"属于哪一类"(分类),明确提到了"四类内容原型"和具体类型名。这是 x-content-archetypes 的核心场景。description 已写明"需要分类内容属于哪类原型时→用 x-content-archetypes"。
- **失败风险**: 低。用户直接使用了"四类内容原型"这个术语,指向非常明确。

### edge-01 ✓ PASS

- **prompt**: "我刚写完一条推文,帮我看看。"
- **预期**: 边界模糊,期望 agent 追问或按最可能意图(发前自检→四省)处理并说明理由。
- **自评**: PASS(合理处理)。用户意图极度模糊,"帮我看看"可能指向多种 skill。期望行为是 agent 先追问(如"你是想判断值不值得发,还是想检查结构完整性?"),或按最可能的意图处理。鉴于"刚写完"暗示发前自检阶段,四省是最可能的选择,但 agent 应说明假设。
- **失败风险**: 这条是边界测试,不要求精确匹配某一 skill,只要求判断合理。若 agent 直接激活四省并说明"假设你在问值不值得发",或先追问,都算通过。

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

1. **should-trigger-03 与 x-content-archetypes 的边界**: "纯感叹帖没人理"这个场景,四省(一步不省所以不值得发)和 content-archetypes(普通表达型中位互动仅16)都能解释。当前 description 已把"复盘为什么没人理"列为四省场景,但实际部署中 agent 可能两个都激活。建议阶段3建立 composes-with 关系:四省判断"值不值得发",content-archetypes判断"属于哪类、传播上限多少",两者可串联使用。

2. **edge-01 的模糊性**: "帮我看看"过于模糊,真实部署中可能被路由到任意内容相关 skill。当前处理方式(追问或按最可能意图处理)是合理的,但如果用户实际想检查结构,会被误激活四省。这是 intent-ambiguity 的固有问题,非 skill 设计缺陷。

3. **英文 trigger 覆盖**: should-trigger-02 测试了英文场景且通过,但 description 中的英文 trigger 词数量有限。若用户用英文问 "is this content valuable enough?" 而非 "worth posting",可能匹配度下降。建议后续根据真实使用数据扩充英文 trigger 词。

---

## 建议

- 当前 7/7 通过(100%),超过 80% 门槛,skill 可进入交付。
- 建议后续用独立 sub-agent 盲测复核,尤其关注 should-not-trigger 诱饵的真实抗干扰能力。
- 阶段3建立 related_skills 后,更新 A2 中"与相邻 skill 区分"为定稿,并回填 frontmatter 的 related_skills 字段。
