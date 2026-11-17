# x-account-pitfalls 压力测试结果

> **测试方式**: 主流程自测 (fallback)
> **可信度**: 低于独立 sub-agent 盲测。当前环境无 sub-agent 能力, 按 `06-stage4-pressure-test.md` 退回主流程自测。
> **测试时间**: 2026-07-14

---

## 测试概览

| 类型 | 数量 | 通过 | 失败 | 通过率 |
|---|---|---|---|---|
| should_trigger | 4 | 4 | 0 | 100% |
| should_not_trigger | 3 | 3 | 0 | 100% |
| edge_case | 1 | 1 | 0 | 100% |
| **合计** | 8 | 8 | 0 | **100%** |

- **最低通过率要求**: 80% → 实际 100% ✓
- **诱饵容错要求**: 0 失败 → 实际 0 失败 ✓
- **跨skill混淆测试**: 2 条兄弟skill诱饵均通过 ✓

---

## 逐条分析

### should_trigger (4/4 通过)

| ID | Prompt 摘要 | 预期 | 实际判断 | 结果 |
|---|---|---|---|---|
| should-trigger-01 | "推文搜不到了, from:@搜不到" | 激活, 执行限流自检流程 | ✓ "推文搜不到了"+"from:@"是核心trigger词, 完美匹配限流自检。description中"推文搜不到了""被限流了"直接命中 | PASS |
| should-trigger-02 | "换节点后没流量, 提示异常, 临时标签vs限流" | 激活, 解释换IP风控+区分标签类型 | ✓ "触发风控""临时标签"是核心trigger词, 匹配7大坑第1条+标签区分。用户明确问"临时标签和限流有什么区别"=本skill的核心区分能力 | PASS |
| should-trigger-03 | "account suspended, how to appeal" (英文) | 激活, 给申诉流程+模板 | ✓ "account suspended""appeal"是英文trigger词, 匹配7大坑第7条+申诉流程。验证英文trigger覆盖 | PASS |
| should-trigger-04 | "每天关注取关几十个, 提示异常, 判脚本?" | 激活, 解释批量操作=脚本特征+处理 | ✓ "被判机器人""账号异常"是trigger词, 匹配7大坑第2条+ce03。用户描述的批量关注取关行为正是ce03的反模式 | PASS |

### should_not_trigger (3/3 通过, 诱饵容错=0)

| ID | Prompt 摘要 | 预期 | 实际判断 | 结果 |
|---|---|---|---|---|
| should-not-trigger-01 | "新号第一天, 装修/蓝V/养号" | 不激活, → x-account-setup | ✓ "新号第一天""装修主页""开蓝V""养号"是x-account-setup的核心trigger, 不是本skill。description明确排除"新号开业装修养号→x-account-setup"。用户是预防(开业准备), 不是治疗(限流恢复) | PASS |
| should-not-trigger-02 | "发了两周推文没流量没粉丝" | 不激活, → x-cold-start-playbook | ✓ "发了推文没流量"是cold-start的核心trigger。判断关键: 应用from:@搜索, 能搜到=没限流=不是本skill。description明确排除"没粉丝怎么起量→x-cold-start-playbook" | PASS |
| should-not-trigger-03 | "怎么写能火的推文, 选题怎么找" | 不激活, → 内容创作类skill | ✓ 用户问内容创作/选题, 与账号健康/风控/限流完全无关。description明确排除"正常发内容没出问题→内容创作skill" | PASS |

### edge_case (1/1 通过)

| ID | Prompt 摘要 | 预期 | 实际判断 | 结果 |
|---|---|---|---|---|
| edge-01 | "曝光降了但from:@还能搜到, 限流还是内容差?" | 部分激活(预防性自查), 同时指向cold-start | ✓ 核心判断: from:@搜得到=没被正式限流→不是本skill的主场景。但用户有"曝光降了"的担忧, 做预防性自查(检查近期操作风险)仍合理。同时应指向cold-start/data-review诊断曝光下降原因。edge在于: 本skill的排查部分可部分触发, 但核心问题(曝光降)不全靠本skill解决 | PASS |

---

## Trigger 设计评估

### description 中的 trigger 信号覆盖

**正面 trigger (何时用):**
- "推文搜不到了" ✓ — should-trigger-01 匹配
- "被限流了" ✓ — should-trigger-01/02 匹配
- "账号异常" ✓ — should-trigger-02/04 匹配
- "触发风控" ✓ — should-trigger-02 匹配
- "临时标签" ✓ — should-trigger-02 匹配
- "怎么申诉" ✓ — should-trigger-03 匹配
- 英文 trigger: "shadowbanned", "account suspended", "appeal suspension", "tweets not showing up" — should-trigger-03 验证 "account suspended"+"appeal" ✓

**负面 trigger (何时不用):**
- "正常发内容没出问题→内容创作skill" ✓ — should-not-trigger-03 匹配
- "新号开业装修养号→x-account-setup" ✓ — should-not-trigger-01 匹配
- "没粉丝怎么起量→x-cold-start-playbook" ✓ — should-not-trigger-02 匹配

### 与兄弟 skill 的区分度

| 兄弟skill | 区分关键 | 测试验证 |
|---|---|---|
| x-account-setup | 本skill="治疗"(已出问题后的排查申诉); setup="预防"(发内容前的开业准备) | should-not-trigger-01 验证: "新号第一天装修蓝V养号"→setup ✓ |
| x-cold-start-playbook | 本skill="保命"(账号健康出问题); cold-start="获客"(没粉丝怎么起量) | should-not-trigger-02 验证: "发了推文没流量"→cold-start ✓ |
| x-comment-engagement | 本skill讲操作红线(批量回复=脚本); engagement讲评论策略(怎么写好回复) | 未直接测试, 但description中"被判机器人"与engagement的"怎么写好评论"语义距离足够 |

**区分关键点**: "搜不到推文"(from:@搜不到)是本skill的核心信号; "搜到推文但没流量"是cold-start的信号。edge-01 正好测试了这个分界线。

---

## 自评结论

- **通过率**: 100% (8/8), 超过 80% 门槛 ✓
- **诱饵容错**: 0 失败 ✓
- **跨skill混淆**: 2 条兄弟skill诱饵均正确排除 ✓
- **主要风险**:
  - edge-01 (曝光降但能搜到) 是真实部署中最可能误判的场景——用户可能混淆"没流量"和"被限流"。description 中"from:@搜不到即限流"这一判断标准已写入, 但用户不一定知道这个方法。建议在 skill 被激活时, 第一步就教用户用 from:@ 自检, 而非直接假设是限流。
  - should-trigger-02 (换IP后异常) 与 edge-01 (曝光降) 的区分依赖"能否搜到推文", 但用户提问时未必提供这个信息。agent 需要主动引导用户做 from:@ 搜索来区分。
  - 英文trigger词仅 should-trigger-03 验证了 "account suspended"+"appeal", "shadowbanned" 和 "tweets not showing up" 未经英文环境实测, 可信度待验证。
- **是否需要回炉**: 否。当前trigger设计在中文环境下区分度足够, 通过率达标。核心区分点(from:@搜不到=限流 vs 搜到但没流量=cold-start)已在description和E段步骤1中明确。

---

## fallback 声明

本次测试为主流程自测, 非独立 sub-agent 盲测。按方法论要求标注:

- 主流程自测存在**自我合理化风险**: 测试设计者和判断者是同一人, 可能无意识地让判断偏向"通过"。
- 特别是 edge_case 的判断, 独立 sub-agent 可能做出不同判断——例如 edge-01 中"部分激活预防性自查"的判断, 独立 agent 可能认为完全不激活更合理(因为能搜到推文=没限流)。
- 建议在具备 sub-agent 能力时, 用独立 agent 对这 8 条 prompt 重跑盲测, 以获得更高可信度的通过率。
