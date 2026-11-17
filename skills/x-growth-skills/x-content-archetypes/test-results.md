# test-results.md — x-content-archetypes

> **测试方式**: 主流程自测 (fallback)
> **说明**: 当前环境未启动独立 sub-agent 盲测,以下为主流程对照 test-prompts.json 自评结果。可信度低于独立 sub-agent 盲测,建议后续补充盲测。
> **测试时间**: 2026-07-14

---

## 测试结果汇总

| 指标 | 结果 |
|---|---|
| 总测试数 | 7 |
| should_trigger | 4/4 通过 |
| should_not_trigger | 2/2 通过 |
| edge_case | 1/1 通过 |
| **通过率** | **100%** |
| **状态** | 接受(自评) |

---

## 逐条分析

### should-trigger-01 ✓

- **prompt**: "我最近一个月发了20多条帖子,大部分是AI相关的观点和感受,互动都很低,是不是内容类型有问题?"
- **预期**: 激活本skill,审计内容原型占比,指出普通表达型过多
- **自评**: trigger信号命中——"互动低+内容类型有问题"直接指向原型审计。description中"为什么没人互动""内容方向有问题"均覆盖此场景。会激活并执行步骤1(审计结构)+步骤2(诊断瓶颈)。
- **判定**: 通过

### should-trigger-02 ✓

- **prompt**: "我发了条'AI太强了,GPT又升级了'这种感叹,为什么完全没人理?"
- **预期**: 激活本skill,判定为普通表达型(中位16),建议转化
- **自评**: 这是V2经典测试用例。纯感叹=普通表达型,trigger"为什么没人理"命中。description明确包含"困惑发了感叹/观点帖没人理"场景。会激活并直接给出原型分类+转化建议。
- **判定**: 通过

### should-trigger-03 ✓

- **prompt**: "我想做AI工具赛道,资源入口型和工具教程型哪个传播上限更高?该怎么选?"
- **预期**: 激活本skill,对比两原型中位互动数据
- **自评**: trigger"传播上限"和原型名称"资源入口型/工具教程型"直接命中description中的中英双写trigger词。会激活并执行数据对比(2965 vs 2035)。
- **判定**: 通过

### should-trigger-04 ✓

- **prompt**: "帮我看一下这条帖子的content archetype,看看viral ceiling怎么样。帖子里就是分享了一个观点,没有任何链接或工具。"
- **预期**: 激活本skill,归类为普通表达型
- **自评**: 英文trigger词"content archetype"和"viral ceiling"直接命中description中英双写trigger。帖子无链接无工具=普通表达型。会激活并分类。
- **判定**: 通过

### should-not-trigger-01 ✓

- **prompt**: "我想写一条教程型的短内容,Hook该怎么写才能3秒抓住眼球,Body用bullet points还是短句组织?"
- **预期**: 不应激活本skill,应激活x-short-content-craft
- **自评**: 用户已确定写"教程型"短内容,问的是结构生产(Hook-Body-CTA组织),不是分类预测。description明确排除"已确定写某种短内容类型并需要组织结构"。应路由到x-short-content-craft。
- **判定**: 通过

### should-not-trigger-02 ✓

- **prompt**: "帮我检查这条推文五件套是否完备:价值承诺、场景、入口、证据、收藏理由,缺哪件补哪件。"
- **预期**: 不应激活本skill,应激活x-five-piece-checklist
- **自评**: 用户问的是要素完备性检查,不是原型分类。description明确排除"检查帖子五件套完备性"。trigger词"五件套""完备"指向x-five-piece-checklist。应路由到x-five-piece-checklist。
- **判定**: 通过

### edge-01 ✓

- **prompt**: "我的内容一半是资源分享(带链接带工具),一半是个人观点和感受,这种混合型算什么原型?可以混着发吗?"
- **预期**: 可激活,逐条分类而非笼统归为"混合型",建议控制比例
- **自评**: 边界场景。用户问"混合型算什么原型"——正确处理是拆开逐条分类(带入口的归资源入口型,纯观点的归普通表达型),而非把"混合"当成第五类。会激活并执行审计步骤,给出比例建议(资源入口型>50%,普通表达型<20%)。
- **判定**: 通过

---

## 失败分析

无失败案例。

---

## 风险提示

1. **自评偏差风险**: 本结果为主流程自评,存在自我合理化倾向。description中的trigger词是我自己写的,自评时天然容易匹配。建议后续用独立sub-agent盲测验证。

2. **兄弟skill边界**: should-not-trigger-01(x-short-content-craft诱饵)和should-not-trigger-02(x-five-piece-checklist诱饵)的区分依赖description中的"不适用于"排除条款。如果宿主只读name+description前几句,排除信息可能被截断。建议阶段3建立related_skills链接后验证路由准确性。

3. **edge-01的合理性**: "混合型"是真实用户高频问题,处理方式(拆开逐条分类)合理但依赖agent理解力。如果agent简单把"混合"当第五类,则该case会失败。盲测时需重点关注。

4. **数据时效性**: description和I段中的中位互动数据(2965/2035/94/16)来自向阳乔木2023-2026个人样本,B段已标注ce15(过拟合)作为边界提醒。但trigger机制本身不依赖数据精确性——"按读者行动分类"的视角是可迁移的。
