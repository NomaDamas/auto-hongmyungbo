# x-longtail-strategy 测试结果

> **测试方式**: Fallback 自测 (主流程自评)
> **可信度**: 低于独立 sub-agent 盲测。当前环境未启动独立 sub-agent,由主流程对照 test-prompts.json 预期逐条自评。
> **测试时间**: 2026-07-14

---

## 测试结果汇总

| ID | 类型 | 预期 | 自评结果 | 通过 |
|---|---|---|---|---|
| should-trigger-01 | should_trigger | 激活 longtail,用中位数42校准+问题转换 | ✓ 通过 | ✓ |
| should-trigger-02 | should_trigger | 激活 longtail,转换"每条都爆"为"提高概率" | ✓ 通过 | ✓ |
| should-trigger-03 | should_trigger | 激活 longtail,校准+区分常态vs系统性问题 | ✓ 通过 | ✓ |
| should-not-trigger-01 | should_not_trigger | 不激活,应走 x-data-review | ✓ 通过 | ✓ |
| should-not-trigger-02 | should_not_trigger | 不激活,应走 x-foryou-algorithm | ✓ 通过 | ✓ |
| edge-01 | edge_case | 先 longtail 校准再引导 data-review | ✓ 通过 | ✓ |

**通过率**: 6/6 = 100%

---

## 逐条分析

### should-trigger-01: "连发20条只2条过百该放弃吗?"

- **判断**: 会触发。用户的核心情绪是"大部分帖表现普通→怀疑该不该放弃",正是长尾焦虑的典型场景。
- **description 匹配点**: trigger signal "我连发20条只2条过百该放弃吗"完全命中。description 明确列出此场景。
- **预期动作**: 用中位数 42 校准(2 条过百已高于中位),转换目标为"提高进前 10% 概率"。
- **风险**: 低。这是本 skill 最强的 trigger 场景。

### should-trigger-02: "怎么让每条推文都爆?"

- **判断**: 会触发。用户直接问出了长尾策略要转换的"错误问题"。
- **description 匹配点**: trigger signal "怎么让每条都爆"完全命中。
- **预期动作**: 指出这是不可能的问题,转换为"系统性提高进前 10% 概率"。
- **风险**: 低。"怎么让每条都爆"是高度特征性的措辞,不太会误激活到其他 skill。

### should-trigger-03: "做了快一个月,大部分帖子二三十互动,是不是不适合"

- **判断**: 会触发。持续中位数表现 + 与他人对比 + 自我怀疑,三重长尾焦虑信号。
- **description 匹配点**: trigger signal "是不是我不适合做X"和"发了这么多条都没什么水花"均命中。
- **预期动作**: 校准(二三十低于中位 42 但非异常低),区分长尾常态 vs 系统性问题,给出三个杠杆。
- **风险**: 中低。二三十低于中位数 42,可能被误判为"需要 data-review"。但用户的核心情绪是焦虑和自我怀疑(心态问题)而非"我要分析数据"(操作需求),longtail 优先。

### should-not-trigger-01: "帮我复盘数据,看哪些类型互动高,下周怎么调"

- **判断**: 不会触发本 skill。用户明确要"复盘数据"+"调整策略",是操作需求而非心态调整。
- **应激活**: x-data-review(80/20 数据复盘四步)。
- **区分依据**: description 明确排除"数据复盘操作(用 x-data-review)"。用户已接受要分析,不需要长尾心态校准。
- **风险**: 低。措辞"复盘""分析""调整策略"是 data-review 的强信号,与 longtail 的"焦虑/怀疑/定目标"信号区分清晰。

### should-not-trigger-02: "For You算法怎么决定推荐?为什么没被推到"

- **判断**: 不会触发本 skill。用户问的是算法机制,不是传播结果的心态调整。
- **应激活**: x-foryou-algorithm。
- **区分依据**: description 明确排除"理解推荐算法机制(用 x-foryou-algorithm)"。"为什么没被推荐"表面涉及传播,但用户要的是机制解释。
- **风险**: 低。"For You 算法""推荐"是 foryou-algorithm 的强信号。

### edge-01: "互动都一般,是选题问题还是算正常?"

- **判断**: 边界场景。用户同时问了两个方向:"是不是选题有问题"(data-review)和"这算不算正常"(longtail)。
- **合理判断**: 先激活 longtail 回答"算不算正常"(用中位数 42 校准),再视情况引导到 data-review 做选题分析。
- **区分依据**: 用户的前半句"这其实算正常的吗"是 longtail 的核心问题(基准校准),后半句"选题方向有问题"是 data-review 的操作需求。合理做法是先给基准(心态)再给操作(复盘)。
- **风险**: 中。如果 agent 只看到"选题方向有问题"可能直接走 data-review。但 description 中"评估一批内容表现"的场景描述应该能覆盖此 case。

---

## 失败 case 分析

无失败 case。

---

## 改进建议

1. **edge-01 的歧义**: 用户同时包含 longtail 和 data-review 两个信号。当前 description 已通过"评估一批内容表现"覆盖,但如果后续盲测发现 agent 倾向直接走 data-review,可在 description 中强化"先校准是否正常,再决定是否复盘"的优先级提示。
2. **should-trigger-03 的低于中位数场景**: 用户互动二三十低于中位数 42,严格说不在"中位数常态"范围内。E 段步骤 2 的判停条件(样本太小)和步骤 4 的区分(常态 vs 系统性问题)需要 agent 做出准确判断,而非简单安慰。如果盲测发现 agent 只安慰不给操作建议,需要强化 E 段。

---

## 结论

100% 通过(6/6)。所有 should_not_trigger 诱饵(2 条兄弟 skill 场景)均通过,容错为 0 满足。本 skill 可进入阶段 5 交付。

> 注: 本结果为 fallback 自测,建议后续在有 sub-agent 能力时做独立盲测验证。
