---
name: x-foryou-algorithm
description: |
  用户想理解X推荐机制/为什么帖子被推荐或不被推荐/小号能不能被推荐时使用。触发词: For You算法, 推荐机制, OON, 为什么没流量, 小号能起吗, algorithm, recommendation, why no impressions。不用于: 纯写内容不问机制/心态焦虑"帖子没爆怎么办"(那是longtail-strategy)/怎么互动获曝光(那是comment-engagement)。
source_book: X秘籍 — xAI官方算法仓库 / AIP出海教程(@带队教练/GoSailGlobal)
source_chapter: X推荐算法.md · System Architecture / Scoring / Key Design Decisions; AIP出海教程.md · 3.1.2
tags: [algorithm, recommendation-system, scoring, engagement, for-you]
related_skills:
  - slug: x-cold-start-playbook
    relation: depends-on
  - slug: x-longtail-strategy
    relation: composes-with
---

# For You 算法推理结构 — 推导创作者行动

## R — 原文 (Reading)

> "We have eliminated every single hand-engineered feature and most heuristics. The Grok-based transformer does all the heavy lifting by understanding your engagement history. During transformer inference, candidates cannot attend to each other—only to the user context, making scores consistent and cacheable. Final Score = Σ (weight_i × P(action_i)). Positive actions (like, repost, share) have positive weights. Negative actions (block, mute, report) have negative weights, pushing down content the user would likely dislike."
>
> — xAI, X推荐算法.md · Key Design Decisions / Scoring and Ranking

自译：我们已消除所有手工特征和大部分启发式规则。Grok transformer从你的互动历史中自行学习相关性。排序时候选帖互不可见，只attend用户上下文，使分数稳定可缓存。最终分=各动作概率的加权和，正面动作（点赞/转发/分享）正权重，负面动作（拉黑/静音/举报）负权重，主动压低用户不喜欢的内容。

---

## I — 方法论骨架 (Interpretation)

X 的 For You 推荐流由一条流水线驱动：双源召回 → 水合过滤 → 多动作打分 → 多样性 → 选取。三个核心设计决策构成了理解"内容为什么被推荐"的推理骨架：

1. **无手工特征**：Grok transformer 从互动历史自行学习相关性，不靠人工定义"什么内容好"。内容是否相关由用户行为模式学习，而非预设规则。
2. **候选隔离**：打分时每条帖子独立评估，不能"看到"同 batch 其他帖子，只 attend 用户上下文。你的帖子按自身预测质量评分，不是"比同批帖子更好"——质量是唯一杠杆，非相对时机。
3. **多动作加权**：不预测单一"相关性"分数，而是预测 15+ 种动作概率（点赞/回复/转发/收藏/点击/停留/关注……），正动作正权重、负动作（拉黑/静音/举报）负权重，加权求和得最终分。

2025 年更新：OON 占比升至 60-70%，算法更依赖内容相关性与互动质量而非账号规模，利好中小号；主帖带链接降权已取消；rage-bait/负面内容被主动压低。对创作者的推论：单帖按自身质量评分（不靠粉丝量），应优化收藏/回复（高正权重）而非只追点赞，避免引发 block/mute/report。

---

## A1 — 书中的应用 (Past Application)

### 案例 1: xAI 开源 For You 源码架构

- **问题**: X 的 For You feed 如何决定哪些帖子被推荐给用户？
- **方法论的使用**: xAI 开源了完整推荐系统源码（github.com/xai-org/x-algorithm），展示了双源召回（Thunder 关注流 + Phoenix 全局发现）→ Phoenix Grok transformer 打分 → 多动作加权 → 候选隔离 → 作者多样性 → 选取的完整流水线，并明确标注三大设计决策（无手工特征/候选隔离/多动作预测）。
- **结论**: 算法完全依赖 transformer 从互动历史学习相关性，无人工特征工程；每条帖子独立评分，不与同批帖子竞争。
- **结果**: 这让创作者能从工程视角理解"为什么被推荐"——不是黑箱玄学，而是可分析的"预测互动概率 × 权重"模型。

### 案例 2: 2025 算法更新对中小号的影响

- **问题**: 2025 年算法更新对中小号意味着什么？
- **方法论的使用**: AIP 教程 3.1.2 解读 2025 算法规则——OON 占比从早期 In-Network 主导倾斜至约 60-70%，算法更依赖内容相关性和互动质量而非账号规模；取消主帖带链接降权（利好知识分享型账号）；rage-bait/负面内容被主动降权（因引发 block/mute/report 负权重）。
- **结论**: 中小号单帖可凭自身质量进入推荐池，不必依赖粉丝基数；优化收藏/回复（高正权重）比只追点赞更有效；避免 rage-bait（负权重压低综合得分）。
- **结果**: 验证了候选隔离的推论——帖子按自身质量评分，OON 倾斜让小号内容有更多被全局发现的机会。

---

## A2 — 触发场景 (Future Trigger)

### 用户会在什么情境下需要这个 skill?

1. **小号能不能被推荐**：用户问"我只有 200 粉，内容能被推荐吗？算法会不会只推大号？"——想理解小号在算法中的机会。
2. **为什么没流量/没被推荐**：用户问"为什么我的帖子没有曝光""帖子发出去就沉了，算法是怎么判断的"——想用算法逻辑诊断。
3. **想理解推荐机制本身**：用户问"For You 算法是怎么工作的""X 的推荐机制是什么"——想理解底层逻辑。
4. **互动类型对算法的影响**：用户问"收藏和点赞哪个对算法更重要""为什么争议帖互动高但曝光反而降了"——想理解多动作权重差异。
5. **rage-bait/负面内容降权**：用户问"发争议内容为什么反而掉流量"——想理解负权重机制。

### 语言信号 (用户的话里出现这些就应激活)

- "For You 算法" / "推荐机制" / "为什么没流量" / "小号能起吗" / "OON" / "算法降权" / "收藏和点赞哪个重要"
- "For You algorithm" / "recommendation" / "why no impressions" / "algorithm penalty" / "how does the algorithm work"

### 与相邻 skill 的区分

- 与 `x-longtail-strategy` 的区别：longtail 讲"长尾分布心态/提高进前 10% 概率"是**战略层**；本 skill 讲"算法如何打分/为什么被推荐"是**机制层**。用户说"帖子没爆心态崩了"→ longtail；用户说"算法为什么没推我"→ 本 skill。
- 与 `x-comment-engagement` 的区别：comment-engagement 讲"怎么互动获曝光"是**行动层**；本 skill 讲"算法如何评估互动价值"是**机制层**。用户说"怎么在评论区互动"→ comment-engagement；用户说"收藏和回复对算法权重的影响"→ 本 skill。
- 与 `x-cold-start-playbook` 的区别：cold-start 讲"前 24h 主动加热突破初始池"是**执行层**；本 skill 讲"算法为什么依赖初始互动信号"是**机制层**。用户说"新号怎么起量"→ cold-start；用户说"算法怎么评分"→ 本 skill。

---

## E — 可执行步骤 (Execution)

当 skill 被激活后，agent 应按以下步骤执行：

1. **确认用户问题类型**
   - 判断用户是想"理解机制"（→ 讲解算法结构）还是"诊断为什么没流量"（→ 用算法逻辑反推可能原因）。
   - 完成标准：明确用户意图是"算法怎么工作"还是"我的帖子为什么没被推荐"。

2. **用三大设计决策逐一分析**
   - **双源召回**：帖子能否进入 OON（内容相关性强、可被全局发现）还是只在 In-Network（仅关注者可见）？OON 占比 60-70% 意味着小号也有机会。
   - **多动作加权**：帖子引发了哪些动作？有点赞但没收藏/回复（互动类型单一）？有负面信号（block/mute/report）？正动作正权重、负动作负权重——收藏/回复权重高于点赞，负面信号会主动压低。
   - **候选隔离**：帖子是按自身质量独立评分，不与同 batch 竞争——所以内容质量是唯一杠杆，不是"比你上面的帖子更好"的相对时机。
   - 完成标准：用三个设计决策逐一对应到用户的具体情况。
   - 判停条件：若用户只是想知道"算法怎么工作"而非诊断，跳到步骤 3 直接给推论。

3. **给出基于算法逻辑的行动推论**
   - 若是小号：OON 占比 60-70% 利好，单帖可凭质量进入推荐池，不靠粉丝量。
   - 若互动单一：优化收藏/回复（高正权重），而非只追点赞；收藏是"未来行动信号"，回复是"深度参与"。
   - 若有 rage-bait 倾向：避免引发 block/mute/report（负权重会主动压低内容，综合得分反而降低）。
   - 若带链接：2025 已取消主帖链接降权，可自由整合链接提升实用性。
   - 完成标准：给出基于算法逻辑的具体行动建议，而非泛泛的"发好内容"。

---

## B — 边界 (Boundary)

### 不要在以下情况使用此 skill

- **纯写内容不问机制时不用**："帮我写一条推文""这条 Hook 怎么改"是 `x-short-content-craft` 的职责，本 skill 不指导内容写作。
- **心态焦虑"帖子没爆怎么办"不用**：那是 `x-longtail-strategy` 的长尾分布心态（接受中位数 42 是常态，目标是提高进前 10% 概率），本 skill 讲机制不讲心态。
- **"怎么互动获曝光"不用**：那是 `x-comment-engagement` 的评论互动策略，本 skill 只解释"算法如何评估互动价值"而非"怎么互动"。
- **"新号怎么起量/前几小时怎么加热"不用**：那是 `x-cold-start-playbook` 的冷启动执行，本 skill 只解释"算法为什么依赖初始信号"。

### 作者在书中警告的失败模式

- **ce22 — Rage-bait 被算法主动降权**：rage-bait/负面内容虽引发回复（P(reply) 高），但同时引发大量 block/mute/report（负权重更高），综合得分反而降低。2025 年算法明确偏好正面/信息性内容。发争议内容换互动是短期高互动、长期被压制的陷阱。
- **ce21 — 博弈算法的打法在平台收紧后失效**：互关/评论区抢占/矩阵化本质是博弈当前算法漏洞。平台反作弊持续进化（2025 已取消链接降权、打击 rage-bait），今天有效的技巧明天可能被直接降权。算法会变，别钻漏洞，内容能力才是可跨算法周期迁移的资产。

### 作者的盲点 / 时代局限

- 高度依赖 2025-2026 算法状态（OON 占比 60-70%、取消链接降权），算法随时再变，具体阈值会漂移——OON 占比可能在未来版本再次调整。
- xAI 开源的是**架构**而非实时**权重值**，具体每个动作的 weight 是黑箱，无法精确量化"收藏比点赞重要几倍"。
- 2025 年 11 月起 Following Feed 也改为 Grok 排序，算法仍在持续演进，本文档结论有时效性。

### 容易混淆的邻近方法论

- **x-longtail-strategy（长尾心态）**是战略层"接受长尾、提高进前 10% 概率"；本 skill 是机制层"算法怎么打分"。两者互补：理解机制 → 调整打法 → 接受长尾结果。区分信号：问"心态/该不该放弃"→ longtail；问"算法怎么工作"→ 本 skill。
- **x-cold-start-playbook（冷启动）**是执行层"前几小时主动加热突破初始池"；本 skill 解释"为什么加热有效"（初始互动信号 → 算法判定质量 → 推入更大推荐池）。区分信号：问"我该怎么操作"→ cold-start；问"算法为什么这样做"→ 本 skill。

---

## 相关 skills

- **depends-on** `x-cold-start-playbook`: 冷启动策略依赖对算法机制的理解——先懂算法怎么打分(OON/候选隔离/多动作加权),再设计六策略破初始池。
- **composes-with** `x-longtail-strategy`: 算法机制(为什么被推荐)+长尾心态(接受大多数帖普通是常态),理解机制后调整打法,再用长尾心态管理预期。

---

## 审计信息

- **验证通过**: V1 跨域 ✓ / V2 预测力 ✓ / V3 独特性 ✓
- **测试通过率**: 待填 (详见 test-results.md)
- **蒸馏时间**: 2026-07-14
