# test-results — x-cold-start-playbook

> **测试方式**: fallback 自测(主流程自评)
> **可信度声明**: 本结果由 skill 构造者自评,存在确认偏差风险。建议后续用独立 sub-agent 盲测复核——只给 sub-agent skill 内容 + 用户 prompt + 相邻 skill 列表(含 x-account-setup / x-comment-engagement / x-foryou-algorithm / x-longtail-strategy 等),不让其看到 type / expected_behavior / notes。
> **测试时间**: 2026-07-14

---

## 逐条自评

### should-trigger-01 ✓ PASS

- **prompt**: "我的X账号刚注册两周,发了十几条推文,粉丝还是个位数,每条推文只有几个曝光。新号没粉丝,发的内容没人看,到底该怎么办?"
- **预期**: 激活 x-cold-start-playbook,用涨粉四步漏斗诊断丢在哪步,再按边际回报排序推荐策略1+策略5为最高优先,提示前24h加热。
- **自评**: PASS。用户直接说了"没粉丝""没人看""几个曝光",是冷启动skill的核心触发信号。description 首句"新号没粉丝、发了推文没人看"精确匹配。激活后应先做漏斗诊断:推文只有几个曝光=漏斗第1步(曝光)就丢了,解决方案是策略1大V评论区抢占借大V流量。同时提示前24h加热机制——发完不能等。
- **失败风险**: 低。trigger 词高度匹配,场景典型。

### should-trigger-02 ✓ PASS

- **prompt**: "I just started on X two weeks ago, still 0 followers. My posts get basically no engagement. How do I get my first 100 followers and survive the cold start phase?"
- **预期**: 激活 x-cold-start-playbook,英文prompt含"0 followers""no engagement""cold start"三个trigger词。
- **自评**: PASS。description 中英文双写覆盖了"0 followers""no engagement""cold start""how to get first 100 followers"四个trigger词,匹配度极高。用户明确说"cold start phase",几乎是skill名称的直接引用。
- **失败风险**: 低。英文 trigger 词覆盖充分。

### should-trigger-03 ✓ PASS

- **prompt**: "我每天花两小时运营X,但粉丝涨不动,推文曝光一直上不去。时间有限,冷启动阶段到底应该优先做什么策略效果最好?"
- **预期**: 激活 x-cold-start-playbook,用户问"优先做什么策略效果最好",按边际回报排序六策略。
- **自评**: PASS。用户明确说"冷启动阶段""优先做什么策略效果最好",这正是六策略按边际回报排序的核心用例。description 中"按边际回报排序投入六策略"直接匹配。激活后应给出策略1+策略5最高优先(投60%时间)、策略2+策略6中优先(投30%)、策略3+策略4低优先(投10%)的组合。
- **失败风险**: 低。但需注意 agent 可能误判为 x-data-review(数据复盘)——用户说"粉丝涨不动"可能被理解为复盘需求。但用户问的是"优先做什么策略"而非"分析数据",更偏向策略选择。description 已明确"时间有限不知道优先做什么"为冷启动场景。

### should-trigger-04 ✓ PASS

- **prompt**: "我发了条推文,刚发完一个小时了,一个互动都没有。我该不该做点什么?还是就等着看它能不能自然跑起来?"
- **预期**: 激活 x-cold-start-playbook,用户问"发完推文要不要主动加热",前24h加热机制触发。
- **自评**: PASS。用户问"该不该做点什么还是等着",正是 ce05(发完不管错过黄金窗口)的反面场景。description 中"前24h主动加热突破初始流量池"直接匹配。激活后应明确告诉用户:不能等——前几小时安安静静,系统判定没人感兴趣,帖子就沉了。要主动找朋友转、社群加热、大V帮忙转。
- **失败风险**: 低。场景非常具体且直接对应E段步骤3和ce05反例。

### should-not-trigger-01 ✓ PASS

- **prompt**: "我的X账号刚注册第一天,头像和昵称都还没弄,简介也是空的。新号第一天到底应该先做什么?要不要先开蓝V?"
- **预期**: 不应激活 x-cold-start-playbook,应激活 x-account-setup。
- **自评**: PASS。用户说"第一天""头像昵称还没弄""简介空的""要不要开蓝V",这些都是开业前准备(装修四要素+蓝V+养号)的信号,指向 x-account-setup。description 已明确写"不适用:新号开业前装修/蓝V/养号(→x-account-setup)"。A2 区分口诀"用户说'新号第一天该干什么'→account-setup;用户说'发了推文没流量'→本skill"已覆盖。关键区分:用户还没发内容、还在准备阶段,不是"发了没人看"而是"还没开始发"。
- **失败风险**: 中。两者都涉及"新号",且 account-setup 的 description 也提到"cold-start"tag。但用户明确说"头像昵称还没弄""开蓝V"是 account-setup 的核心 trigger,而本skill的trigger是"帖子没人看"——用户还没发帖,不匹配。

### should-not-trigger-02 ✓ PASS

- **prompt**: "在大V的帖子下面评论,怎么写才能获得曝光又不被当成蹭流量的?有没有什么评论互动的技巧和模板?"
- **预期**: 不应激活 x-cold-start-playbook,应激活 x-comment-engagement。
- **自评**: PASS。用户问的是"怎么评论""评论互动的技巧和模板",这是评论互动方法论的全面咨询,指向 x-comment-engagement。description 已明确写"不适用:纯评论互动技巧(→x-comment-engagement)"。A2 区分写明"本skill把评论区抢占作为策略之一使用,不展开评论技巧本身"。关键区分:用户问"怎么评论"(技巧)→comment-engagement;用户问"冷启动该做什么策略"(策略选择)→本skill。
- **失败风险**: 中。本skill策略1就是"大V评论区抢占",与评论技巧高度相关。但用户问的是"怎么写评论"而非"冷启动该做什么",且要求"技巧和模板"指向方法论展开而非策略选择。description 的区分已覆盖。

### edge-01 ✓ PASS

- **prompt**: "我的账号有500粉丝了,但每条推文还是只有几十个曝光,互动也很少。这算不算还在冷启动期?该怎么突破?"
- **预期**: 边界模糊,期望agent先做漏斗诊断再判断,而非机械按粉丝数一刀切。
- **自评**: PASS(合理处理)。500粉已不算严格意义上的新号冷启动(0→1阶段),但帖子低曝光+互动少说明存在冷启动类似问题(初始流量池未突破)。期望行为是agent先做漏斗诊断:如果是推文没曝光→可能仍可用策略1+策略5;如果是门面接不住流量→转x-account-setup修门面;如果是内容质量问题→转x-short-content-craft。关键是不机械套用六策略,而是先诊断再选工具。description 中"有少量粉丝(几十到几百)但帖子曝光仍然很低"已覆盖此灰色地带,但500粉略超此范围,属合理边界。
- **失败风险**: 这条是边界测试,不要求精确匹配某一skill,只要求判断合理。若agent直接激活本skill并说明"500粉虽不算新号但低曝光说明初始流量池未突破,先用漏斗诊断",或先追问"你的推文曝光是一直很低还是最近下降",都算通过。

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
- **诱饵测试容错**: 0 (2/2 通过,全部 should_not_trigger 通过,含2条跨skill混淆诱饵)

---

## 失败分析

无失败 case。

### 潜在风险点(虽通过但需关注)

1. **should-not-trigger-01 与 x-account-setup 的边界**: "新号第一天"这个场景,account-setup(开业准备)和 cold-start(开业后获客)最易混淆。当前区分口诀是"还没发内容→account-setup;发了没人看→cold-start"。但真实部署中用户可能同时处于两个阶段(刚装修完准备发第一条),此时两个skill都可能被激活。建议阶段3建立 composes-with 关系:account-setup完成后衔接cold-start,两者时序串联。

2. **should-not-trigger-02 与 x-comment-engagement 的边界**: 本skill策略1"大V评论区抢占"与comment-engagement的评论方法论高度相关。当前区分是"策略选择→本skill;技巧展开→comment-engagement"。但用户可能同时需要两者(冷启动期想知道策略优先级+具体怎么评论)。建议阶段3建立 composes-with 关系:本skill决定"做不做评论区抢占",comment-engagement决定"怎么做"。

3. **edge-01 的500粉边界**: description 写"有少量粉丝(几十到几百)但帖子曝光仍然很低"为冷启动场景,但500粉已超出"几十到几百"范围。当前处理方式(先漏斗诊断再判断)是合理的,但如果用户有5000粉但推文仍只有几十曝光,更可能是内容质量或算法限流问题而非冷启动。description 的 B 段已写"已有稳定粉丝(500+)的日常内容运营→不属于冷启动",edge-01 的500粉正好踩在这条线上。这是合理的边界测试。

4. **英文 trigger 覆盖**: should-trigger-02 测试了英文场景且通过,但 description 中的英文 trigger 词集中在"0 followers""no engagement""cold start"等。若用户用英文问"my posts are getting zero impressions"或"how to grow from scratch"而非"cold start",匹配度可能下降。建议后续根据真实使用数据扩充英文 trigger 词。

---

## 建议

- 当前 7/7 通过(100%),超过 80% 门槛,skill 可进入交付。
- 建议后续用独立 sub-agent 盲测复核,尤其关注 should-not-trigger 两条诱饵的真实抗干扰能力——account-setup 和 comment-engagement 是最易与本skill抢调用的两个兄弟skill。
- 阶段3建立 related_skills 后,更新 A2 中"与相邻skill区分"为定稿,并回填 frontmatter 的 related_skills 字段。
