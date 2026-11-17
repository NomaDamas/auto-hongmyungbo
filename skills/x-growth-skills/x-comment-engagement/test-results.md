# x-comment-engagement 测试结果

> **测试方式**: fallback 自测 (当前环境未启动独立 sub-agent 盲测)
> **测试时间**: 2026-07-14
> **可信度说明**: 以下为主流程自评结果，可信度低于独立 sub-agent 盲测。建议后续用独立 agent 重测验证。

---

## 测试汇总

| 指标 | 数值 |
|---|---|
| 总测试数 | 8 |
| should_trigger | 4 (全部通过) |
| should_not_trigger | 2 (全部通过，含 2 条跨 skill 诱饵) |
| edge_case | 2 (全部通过) |
| **通过率** | **8/8 = 100%** |
| 最低通过率要求 | 80% |
| **结论** | **通过** |

---

## 逐条分析

### should_trigger (4/4 通过)

#### should-trigger-01 ✓
- **prompt**: "我是新号，想在大V的帖子下面评论获取曝光，但怕被当成蹭流量的，评论应该怎么写?"
- **预期**: 激活 x-comment-engagement，提供"重述观点+补充经验"模板或六法策略，做质量门槛检查
- **自评**: 通过。"大V帖下评论获取曝光"=场景1，"怕被当蹭流量"=用户已意识到ce06风险。description 中"怎么在别人帖下获曝光又不被当蹭流量"直接命中。应选"重述观点+补充经验"模板（策略1变体）并检查增量价值。
- **置信度**: 高

#### should-trigger-02 ✓
- **prompt**: "看到一条好帖，我应该Repost还是Quote?这两个有什么区别?"
- **预期**: 激活 x-comment-engagement，区分Repost vs Quote，建议新人优先Quote+增量观点
- **自评**: 通过。用户直接命中trigger词"Repost还是Quote"。description 中"Quote还是Repost"和"quote vs repost"中英双写均覆盖。应区分Repost=替人筛选vs Quote=展示思考，建议新人优先Quote。
- **置信度**: 高

#### should-trigger-03 ✓
- **prompt**: "I want to get noticed by replying under big accounts' posts without looking like I'm clout-chasing. How should I write my replies?"
- **预期**: 激活 x-comment-engagement，英文trigger，提供高质量回复策略
- **自评**: 通过。英文提问但"get noticed by replying"=评论获曝光，"clout-chasing"=蹭流量。description 中英文trigger词"how to reply for exposure"覆盖此场景。应提供增量价值型回复策略并避免硬蹭。
- **置信度**: 高

#### should-trigger-04 ✓
- **prompt**: "自己发的推文评论区好冷清，有什么互动技巧能让评论区热闹起来?"
- **预期**: 激活 x-comment-engagement，从六法中选择策略激活评论区
- **自评**: 通过。"评论区冷清""互动技巧"=场景4（激活自己评论区）。description 中"怎么引发互动"覆盖。应从六法中选择：价值型（提问/请教）建形象，争议型（引战/坎宁汉姆）冲量但控频次，低门槛型（生活日常）破冰。
- **置信度**: 高

---

### should_not_trigger (2/2 通过，诱饵容错为 0)

#### should-not-trigger-01 ✓ (跨 skill 诱饵)
- **prompt**: "我是新号没粉丝，应该怎么起量?发什么内容能火?"
- **预期**: 不激活本 skill，应激活 x-cold-start-playbook
- **自评**: 通过。"新号没粉丝怎么起量"=整体冷启动策略排序（六策略按边际回报排序），不是评论/Quote的具体战术。用户问的是"把有限时间投到哪"（策略排序），不是"投了之后怎么执行"（战术执行）。A2明确区分：冷启动playbook解决策略排序，本skill专注评论互动和Quote/Repost的具体战术。
- **诱饵类型**: 跨 skill 混淆 — x-cold-start-playbook 的冷启动策略排序场景
- **置信度**: 高

#### should-not-trigger-02 ✓ (跨 skill 诱饵)
- **prompt**: "我想写一条教人用 Claude Code 的推文，从零开始怎么写?"
- **预期**: 不激活本 skill，应激活 x-short-content-craft
- **自评**: 通过。"从零开始怎么写"=起草自己的原创帖（选类型+Hook-Body-CTA），不是在别人帖下评论/回复/Quote。A2明确区分：短内容工坊解决"怎么写自己的帖"，本skill解决"怎么在别人的帖下获取曝光"。用户没有提到评论、回复、Quote、Repost任何互动动作。
- **诱饵类型**: 跨 skill 混淆 — x-short-content-craft 的起草场景
- **置信度**: 高

---

### edge_case (2/2 通过)

#### edge-01 ✓
- **prompt**: "我Quote了一条大V的推文，加了句'说得好，深有同感'，这样行吗?"
- **预期**: 激活本skill，识别低质Quote(ce18风险)，建议补充增量观点
- **自评**: 通过。用户已选Quote（方向正确）但内容"说得好，深有同感"是低质感叹（ce18风险）。应激活本skill做质量门槛检查（E步骤3三问）：(1)有没有增量价值？无——只有感叹无新信息。(2)有没有硬蹭？不算硬蹭但无增量。(3)争议型？否。应建议用户补充具体观点/经验/新角度。这不是"不该激活"的场景，而是"激活后应做质量检查"的边界。
- **边界理由**: 用户已做Quote但质量不足，需要本skill的质量门槛检查
- **置信度**: 高

#### edge-02 ✓
- **prompt**: "我想用坎宁汉姆定律，故意在推文里把一个AI术语说错来引发纠正评论，这周已经用了两次了，还能再用吗?"
- **预期**: 激活本skill，触发频次警告(ce08)，建议换价值型策略
- **自评**: 通过。用户明确提到"坎宁汉姆定律"（本skill核心策略之一），应激活。但"这周已用两次"触发E步骤3判停条件：若近期已用≥2次争议型策略，提示"频次过高损专业形象"（ce08），建议换价值型策略（提问/请教）。这是skill内部的边界——策略可用但频次有上限，不是"不该激活"的场景。
- **边界理由**: 策略在skill范围内但频次触发ce08警告
- **置信度**: 高

---

## 失败分析

无失败 case。

---

## 风险与改进建议

1. **should-trigger-03 英文触发**: 当前 description 含英文 trigger 词("comment engagement / quote vs repost / how to reply for exposure")，但英文场景的实际触发准确率需独立盲测验证。特别是"clout-chasing"一词不在 description 显式列出，依靠语义匹配。建议后续用英文 sub-agent 重测。

2. **与 x-cold-start-playbook 的边界**: 本skill的评论互动策略（策略1大V评论区抢占）与冷启动playbook的策略1有重叠。当前靠"策略排序 vs 战术执行"区分，但在实际使用中用户可能同时需要两者。建议在阶段3建立 composes-with 关系：冷启动playbook决定"用评论互动"，本skill决定"评论怎么写"。

3. **edge-01 低质Quote的判断**: 用户Quote了内容但只加了"说得好，深有同感"。这里有一个微妙判断——用户已经在做Quote（互动场景），应激活本skill做质量检查。但agent可能误判为"用户已知道怎么做，不需要skill"。E步骤3的质量门槛检查(三问)应能覆盖此场景，但实际执行中agent是否会正确激活而非跳过需验证。

4. **争议型策略的频次控制**: ce08(坎宁汉姆/找骂用太频损形象)和ce22(rage-bait被算法负权重降权)都涉及频次/程度控制。当前E步骤3的判停条件写"≥2次"是初步阈值，实际安全频次取决于账号阶段和赛道。建议后续根据更多案例数据调整阈值。

5. **fallback 可信度**: 本次为自测，所有 case 由主流程自行评估，存在自我合理化风险。特别是 should_not_trigger 的 2 条诱饵，自评"通过"可能偏低估了实际混淆概率。**强烈建议**后续用独立 sub-agent 盲测重跑，尤其是"新号没粉丝怎么起量"与冷启动playbook的边界——这是最容易混淆的场景。

---

## 最终结论

**通过 (100% ≥ 80%)**。skill 可进入阶段 5 交付，但建议后续用独立 sub-agent 盲测重验，特别关注与 x-cold-start-playbook 的跨 skill 边界。
