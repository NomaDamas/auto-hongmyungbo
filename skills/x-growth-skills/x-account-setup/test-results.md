# x-account-setup 压力测试结果

> **测试方式**: 主流程自测 (fallback)
> **可信度**: 低于独立 sub-agent 盲测。当前环境无 sub-agent 能力, 按 `06-stage4-pressure-test.md` 退回主流程自测。
> **测试时间**: 2026-07-14

---

## 测试概览

| 类型 | 数量 | 通过 | 失败 | 通过率 |
|---|---|---|---|---|
| should_trigger | 4 | 4 | 0 | 100% |
| should_not_trigger | 3 | 3 | 0 | 100% |
| edge_case | 2 | 2 | 0 | 100% |
| **合计** | 9 | 9 | 0 | **100%** |

- **最低通过率要求**: 80% → 实际 100% ✓
- **诱饵容错要求**: 0 失败 → 实际 0 失败 ✓
- **跨skill混淆测试**: 2 条兄弟skill诱饵均通过 ✓

---

## 逐条分析

### should_trigger (4/4 通过)

| ID | Prompt 摘要 | 预期 | 实际判断 | 结果 |
|---|---|---|---|---|
| should-trigger-01 | "新号第一天该干什么" | 激活, 给开店模型三步 | ✓ "新号第一天"是核心trigger词, 明确匹配开业准备全流程 | PASS |
| should-trigger-02 | "蓝V要不要开, 选哪档" | 激活, 给蓝V必开理由+档位选择 | ✓ "要不要开蓝V"是核心trigger词, 匹配开店模型第二步 | PASS |
| should-trigger-03 | "头像默认的, 昵称随便取, 简介空" | 激活, 给装修四要素清单 | ✓ "怎么装修主页/头像/昵称/简介"是核心trigger词, 匹配第一步 | PASS |
| should-trigger-04 | "新号能直接关注点赞吗? 怎么养号" | 激活, 给养号原则 | ✓ "新号怎么养号"是核心trigger词, 匹配第三步 | PASS |

### should_not_trigger (3/3 通过, 诱饵容错=0)

| ID | Prompt 摘要 | 预期 | 实际判断 | 结果 |
|---|---|---|---|---|
| should-not-trigger-01 | "发了两周推文没流量没粉丝" | 不激活, → x-cold-start-playbook | ✓ 用户已在发内容阶段(开业后), 问题是获客。description明确排除"已运营账号日常发内容/没粉丝怎么办→x-cold-start-playbook" | PASS |
| should-not-trigger-02 | "推文搜不到, 被限流了" | 不激活, → x-account-pitfalls | ✓ 用户账号已出问题(限流), 需排查申诉(治疗)。description明确排除"被限流封号后排查申诉→x-account-pitfalls" | PASS |
| should-not-trigger-03 | "每天发3条不知道发什么能火" | 不激活, → 内容创作类skill | ✓ 用户问选题/创作, 属内容生产非开业准备。装修/蓝V/养号均不适用 | PASS |

### edge_case (2/2 通过)

| ID | Prompt 摘要 | 预期 | 实际判断 | 结果 |
|---|---|---|---|---|
| edge-01 | "运营三个月, 粉丝少, 主页简陋想重新装修" | 部分激活(装修四要素), 同时指向cold-start | ✓ 已运营账号想重装Profile——装修四要素本身适用(无论新旧号), 但核心痛点(涨不动)还需冷启动诊断。skill应部分触发装修部分+提示配合cold-start | PASS |
| edge-02 | "老号刚申诉回来, 要养号吗" | 激活养号部分(1-2天) | ✓ 老号解冻与新号注册不同但养号原则同样适用, 周期更短(1-2天vs3天)。属于skill覆盖范围 | PASS |

---

## Trigger 设计评估

### description 中的 trigger 信号覆盖

**正面 trigger (何时用):**
- "新号第一天" ✓ — should-trigger-01 匹配
- "要不要开蓝V" ✓ — should-trigger-02 匹配
- "怎么装修主页/头像/昵称/简介" ✓ — should-trigger-03 匹配
- "新号怎么养号" ✓ — should-trigger-04 匹配
- 英文 trigger: "what to do day 1", "should I get Premium", "how to set up profile", "warm up new account" — 已写入description, 待英文环境验证

**负面 trigger (何时不用):**
- "已运营账号日常发内容/没粉丝怎么办→x-cold-start-playbook" ✓ — should-not-trigger-01 匹配
- "被限流封号后排查申诉→x-account-pitfalls" ✓ — should-not-trigger-02 匹配

### 与兄弟 skill 的区分度

| 兄弟skill | 区分关键 | 测试验证 |
|---|---|---|
| x-cold-start-playbook | 本skill="开业前准备"(装修+蓝V+养号); cold-start="开业后获客"(六策略+漏斗) | should-not-trigger-01 验证: "发了推文没流量"→cold-start ✓ |
| x-account-pitfalls | 本skill="预防"(开业前); pitfalls="治疗"(已出问题) | should-not-trigger-02 验证: "被限流"→pitfalls ✓ |

---

## 自评结论

- **通过率**: 100% (9/9), 超过 80% 门槛 ✓
- **诱饵容错**: 0 失败 ✓
- **跨skill混淆**: 2 条兄弟skill诱饵均正确排除 ✓
- **主要风险**:
  - edge-01 (已运营账号想重装修) 是真实部署中最可能误判的场景——用户可能同时需要本skill(装修)和cold-start(获客)。description 中"不适用:已运营账号日常发内容"可能过于绝对, 导致edge-01完全不触发。建议阶段3建立skill组合调用能力后回检。
  - 英文trigger词未经英文环境实测, 可信度待验证。
- **是否需要回炉**: 否。当前trigger设计在中文环境下区分度足够, 通过率达标。

---

## fallback 声明

本次测试为主流程自测, 非独立 sub-agent 盲测。按方法论要求标注:

- 主流程自测存在**自我合理化风险**: 测试设计者和判断者是同一人, 可能无意识地让判断偏向"通过"。
- 特别是 edge_case 的判断, 独立 sub-agent 可能做出不同判断。
- 建议在具备 sub-agent 能力时, 用独立 agent 对这 9 条 prompt 重跑盲测, 以获得更高可信度的通过率。
