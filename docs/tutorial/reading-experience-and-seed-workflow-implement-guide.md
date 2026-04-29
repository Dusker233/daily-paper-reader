# 阅读体验与 seed workflow 实施指南（给 implementer）

## 目标

本指南覆盖 6 个剩余问题：

1. **主链路 skim 正文颗粒度不够**：现在正文仍然基本只有摘要，不符合“优先全文”的目标；需要把正文升级到接近当前 deep 的信息密度。
2. **精读区颗粒度仍然不够细**：在 skim 正文升级之后，deep 还要继续向 `archive/mineshark_report.md` 靠齐。
3. **seed-paper related 页面仍可能退化成 abstract-only**：skim / deep 都要真正优先全文。
4. **速读文章页需要一个低风险的“转精读”入口**。
5. **评估是否要加 RSS，并给出优先级**。
6. **修复 / 收紧 `seed-paper-related` 最新失败对应的生成契约与诊断链路**。

这份指南**不重复**前一轮已经处理过的问题：

- seed index / related 页面 hash 路由修复：`src/seed_paper_processor.py`
- related page front matter evidence 回填：`src/seed_paper_processor.py`
- seed 页面发布后前端轮询与跳转：`app/subscriptions.manager.js`
- seed PDF `archive/seed-papers/...pdf` allowlist：`app/docsify-plugin.js`

这些点当前代码里已经有落地痕迹，不要重复返工。

---

## 已核实的当前代码事实

### 1. 主链路 skim 现在只有“速览”优先全文，**正文主体并没有**

`src/6.generate_docs.py` 里当前的行为其实分成了三层：

1. front matter + `## 速览`
2. 文章正文 body
3. `## 论文详细总结（自动生成）`

其中只有第 1 层已经部分吃到了全文，第 2 层并没有。

#### 已确认事实

- `generate_glance_overview(...)` 通过 `_prepare_glance_source_text(...)` 优先用 `paper_text`
- `process_paper(...)` 在 quick / normal 路径里都会尽量先准备 `.txt`，再生成 `## 速览`
- 但 `build_markdown_content(...)` 当前正文仍然只写：
  - `## 摘要`
  - `## Abstract`
- `process_paper(...)` 在 quick 分支里明确写着：
  - “速读区：不生成详细总结，只保留速览和摘要”

#### 结论

所以现在主链路所谓“优先全文”，实际上只落实在 `## 速览` 这一小块上；**文章正文本身仍然是 abstract-only**。这就是你现在看到 skim 页面“上面像读过全文，下面还是只有摘要”的根因。

这不是 seed-paper 特有问题，而是主链路正文契约本身还停留在旧设计。

### 2. 当前 deep 输出形状本身就不对

`src/6.generate_docs.py` 里的 `generate_deep_summary(...)` 现在明确要求：

- 用 5 段连续叙述
- 不要 bullet points
- 不要表格
- 不要分级标题

这与 `archive/mineshark_report.md` 的目标形状正好相反。现在不是“提示词再调一调”就够，而是**输出契约要换**。

### 3. seed-paper related 也还没有对齐全文链路

`src/seed_paper_processor.py` 当前仍然是：

- `_render_related_pages(...)` 先写 `.md`
- deep 模式下仅把 `abstract` 写入本地 `.txt`
- 然后 `generate_glance_overview(...)` / `generate_deep_summary(...)` 都消费这份 abstract-only 文本

所以 seed-paper 的 related 页面仍然会出现“配置上支持全文，实际效果像摘要”的问题。

### 4. 最新 workflow 校验脚本已经和当前 index 输出契约脱节

`src/seed_paper_processor.py` 现在 `index.md` 输出的是 hash 路由：

- `#/seed-papers/<request_id>/seed-paper`
- `#/seed-papers/<request_id>/related/<slug>`

但 `.github/workflows/seed-paper-related.yml` 的校验步骤还在 grep：

- `seed-paper.md`
- `related/`

这已经是旧契约。即使 related 页面都生成成功，后面也可能因为校验脚本没同步而失败。

### 5. 当前 workflow 对“为何没有 related 页面”仍然观测不足

`src/seed_paper_processor.py`：

- `process_request(...)` 会在 selection 为空时抛 `selection produced no related outputs`
- `render_seed_workspace(...)` 返回 `related_page_paths`
- 但 `main()` 最终打印的 JSON 里没有 `related_page_paths`

`.github/workflows/seed-paper-related.yml`：

- 只在最后用 shell 检查 `related/*.md`
- 一旦失败，日志只有一句 `Seed workflow produced no related pages.`

所以当前失败信号太晚，也太粗。

### 6. 当前“速读转精读”不能简单靠跳另一个页面实现

主链路的文章路径由 `prepare_paper_paths(...)` 决定，路径不区分 quick/deep；同一篇文章最终是**同一个 markdown 文件**。这意味着：

- 现在没有一个天然的“quick page 对应 deep page”路由可以直接跳转
- “转精读”本质上是**把当前文章补生成 deep summary**，而不是单纯导航

所以这个按钮应该是“触发补生成 / 升级为精读”，不是“跳另一个现成页面”。

---

## 建议分 6 个 PR 做，不要一锅端

### PR1：先把 seed workflow 失败链路收紧

**目标**：让下一次失败能直接指向真正原因，而不是只看到末端报错。

#### 需要改的文件

- `.github/workflows/seed-paper-related.yml`
- `src/seed_paper_processor.py`
- `tests/test_seed_paper_workflow.py`
- `tests/test_seed_paper_processor.py`

#### 具体改法

1. `src/seed_paper_processor.py`
   - 在 `render_seed_workspace(...)` 返回前，新增一个**磁盘侧不变量检查**：
     - `related_dir` 下至少要有 1 个 `*.md`
     - `related_page_paths` 的数量要和实际生成文件数一致
   - 如果不满足，直接抛 `SeedPaperProcessingError`，不要把错误留到 workflow 末端再报。

2. `src/seed_paper_processor.py`
   - `main()` 输出的 JSON 增加：
     - `seed_page_path`
     - `related_page_paths`
     - `related_count`
   - 这样 hosted run log 至少能看出 processor 认为自己写了什么。

3. `.github/workflows/seed-paper-related.yml`
   - 更新校验脚本，不能再 grep 旧链接：
     - 把 `seed-paper.md` 改成 `#/seed-papers/${REQUEST_ID}/seed-paper`
     - 把 `related/` 改成 `#/seed-papers/${REQUEST_ID}/related/`
   - 在 `related_pages` 数量检查失败前，先打印：
     - `${WORKSPACE_DIR}`
     - `related/` 目录内容
     - `index.md` 内容
   - 这样线上再失败时，第一屏日志就够定位。

4. `tests/test_seed_paper_workflow.py`
   - 补一条测试，锁定新的 index 校验契约，不要让 workflow 继续依赖旧的 `.md` 相对链接。

5. `tests/test_seed_paper_processor.py`
   - 补一条测试，锁定 `process_request(...)` 返回值中的 `related_page_paths` 与磁盘实际文件一致。

#### PR1 验收标准

- workflow 校验不再使用旧的 `.md` 相对链接语义
- processor 一旦生成 related 失败，会在 Python 侧提前失败
- run log 能直接看到 `related_page_paths`

---

### PR2：重做主链路 skim 正文契约，不要再让正文只剩摘要

**目标**：让 skim 页面不只是“速览 + 摘要”，而是“速览 + 中粒度正文”；正文颗粒度提升到接近当前 deep 的信息密度。

#### 需要改的文件

- `src/6.generate_docs.py`
- `tests/test_generate_docs_meta_parse.py`
- 如有现成的 `process_paper(...)` 相关测试文件，也一起补

#### 具体改法

1. 在 `src/6.generate_docs.py` 里把“速览”和“正文”这两个概念拆开
   - `generate_glance_overview(...)` 继续负责 `## 速览`
   - 新增一个**正文级**的 skim 生成函数，例如：
     - `generate_skim_body(...)`
     - 或同等职责的 helper
   - 这个函数的输入应该至少包括：
     - `title`
     - `abstract`
     - `paper_text`
   - 它的职责不是生成一句 TLDR，而是生成**中粒度正文**。

2. 正文级 skim 的目标形状
   - 重点不是再复制一遍 abstract，而是输出一个比当前 `## 速览` 更厚、但又明显轻于未来 deep 的正文层。
   - 建议至少固定 4 个 section：
     1. `## 1. 问题与背景`
     2. `## 2. 核心思路 / 方法`
     3. `## 3. 结果与结论`
     4. `## 4. 局限与适用边界`
   - 可以允许短 bullet list，但不要写成 `archive/mineshark_report.md` 那种 full deep 结构。
   - 目标是：**skim 正文 ≈ 现在 deep 的粒度**。

3. `build_markdown_content(...)` 不要再把正文硬编码成“摘要 + Abstract”
   - 现在这个函数把 body 固定成：
     - `## 摘要`
     - `## Abstract`
   - 这正是当前主链路 skim 体验薄的根因。
   - 应改成：
     - front matter
     - `## 速览`（如果存在）
     - 新的 skim 正文 block
     - `## Abstract`（英文原摘要仍可保留作为原始参考）
   - 换句话说，`zh_abstract` 不应再是正文唯一中文内容来源。

4. 正文文本源必须优先全文
   - 对主链路 quick 页面：
     - 优先使用 `ensure_text_content(...)` 取得的全文
     - 失败时才退回 abstract
   - 但即使 fallback 到 abstract，也应沿用新的正文 skeleton，而不是回到旧的“只写摘要”格式。

5. deep 页面与 quick 页面的关系要理顺
   - quick 页面：`速览 + skim 正文 + Abstract`
   - deep 页面：`速览 + skim 正文 + Abstract + 论文详细总结（自动生成）`
   - 这样 deep 就是在 skim 的基础上继续加深，而不是 quick / deep 完全两张皮。

#### PR2 验收标准

- 主链路 skim 页面正文不再只是 `## 摘要`
- 在有全文的情况下，正文明显体现全文信息，而不再像 abstract 改写
- 正文颗粒度接近当前 deep 的阅读体验
- quick 与 deep 的差别开始收敛为“是否追加详细总结”，而不是“正文有/没有信息量”

---

### PR3：把 seed-paper related 的 skim / deep 全文链路补齐，并对齐 PR2 的正文契约

**目标**：让 seed related 页面和主链路使用同一套“全文优先 + 分层正文”逻辑，而不是停留在 abstract-only。

#### 需要改的文件

- `src/seed_paper_processor.py`
- `tests/test_seed_paper_processor.py`

#### 具体改法

1. 调整 `_render_related_pages(...)` 的顺序
   - 不要再在 deep 模式里把 `abstract` 直接写成 `.txt`
   - 统一先准备 `paper_text`
   - `glance`、`skim body`、`deep summary` 使用同一份文本源

2. 推荐策略
   - 只要 `record["include_quick"]` 或 `record["include_deep"]` 为真，就尝试准备文本
   - 优先调用 `generate_docs_module.ensure_text_content(pdf_url, txt_path)`
   - 如果：
     - 没有有效 `pdf_url`
     - 或下载 / 提取失败
     - 或提取结果为空
     - 再 fallback 到 `abstract`
   - 但 fallback 不能中断整个 workspace render

3. related 页面正文不要继续走 abstract-only 老路
   - 在 PR2 新增正文级 skim helper 之后，这里应直接复用
   - 也就是说 related 页面至少应具备：
     - `## 速览`
     - skim 正文 block
     - deep 模式下再补 `## 精读`
   - 不要再让 related 页面正文只靠 `build_markdown_content(..., zh_abstract=abstract)` 顶着。

4. 保持“单篇降级，不影响整批”
   - 单个 related paper 的全文获取失败，只降级这篇
   - 不要让整次 seed request 因一篇 related 的外链 PDF 不可达而失败

5. `tests/test_seed_paper_processor.py`
   - 现在已有测试把“只用 abstract”当成既有行为
   - 这些测试要改成新契约：
     - 优先尝试 `ensure_text_content(...)`
     - 成功时 `.txt` 来自全文
     - 失败时才回退 abstract
     - related 页面正文不再只是摘要

#### PR3 验收标准

- seed related 的 `## 速览`、正文、`## 精读` 使用同一份文本源
- 有全文时，related 页面不再表现得像 abstract-only
- 单篇 related 取全文失败时不会拖垮整个 request

---

### PR4：重做 deep 输出契约，让它真正对齐 `archive/mineshark_report.md`

**目标**：在 PR2 已经补厚正文之后，把 deep 再往上拉一个层级，而不是继续停留在“5 段叙述”。

#### 需要改的文件

- `src/6.generate_docs.py`
- 如有必要，补一个小的格式辅助函数并加测试
- `tests/test_generate_docs_meta_parse.py`

#### 具体改法

1. 把 `generate_deep_summary(...)` 从“5 段叙述”改成固定 section skeleton，至少包括：

   1. `## 1. TLDR`
   2. `## 2. 核心故事与贡献`
   3. `## 3. 相关工作与定位`
   4. `## 4. 方法详解`
   5. `## 5. 实验分析`
   6. `## 6. 局限性与风险`
   7. `## 7. 复现与后续问题`
   8. `## 8. 直接证据与待验证项`

2. prompt 约束同步调整
   - 允许小标题、bullet list、表格
   - 关键结论尽量引用 section / figure / table 编号
   - 缺证据时显式写 `[需验证]` 或“文中未明确说明”
   - 不要为了凑满 section 去编造实现细节

3. deep 的定位要重新定义清楚
   - PR2 之后，正文已经不再是薄摘要
   - 所以这里的 deep 不再负责“补一点信息量”
   - 而是负责提供：
     - 结构化证据
     - 方法细节展开
     - 实验解读
     - 局限与复现问题
   - 换句话说：**skim 正文解决“读得懂”，deep 解决“读得深”**。

4. 保持现有 heading 不变，避免先打断前端
   - 可以继续使用 `## 论文详细总结（自动生成）` 作为挂载点
   - 但这个 block 内部要换成新的多 section 结构
   - 不要一上来改前端样式，先只改 markdown 输出，让结果先接近 `archive/mineshark_report.md`

#### PR4 验收标准

- 新生成的 deep summary 结构明显接近 `archive/mineshark_report.md`
- deep 与 skim 的差异从“有没有信息量”转为“分析深度是否足够”
- deep block 内部不再是单纯 5 段叙述

---

### PR5：给速读页加“转精读”按钮，但方向必须是“补生成”而不是“跳页面”

**目标**：让用户在 skim 页面对感兴趣论文进行升级阅读，而不是被带到一个并不存在的 deep 页面。

#### 需要改的文件

- `app/docsify-plugin.js`
- `app/app.css`
- 可能新增一个极小的 workflow / CLI 入口
- `tests/test_docsify_plugin.js`
- 如涉及前端调度，再补 `tests/test_subscriptions_manager.js`

#### 具体改法

1. 后端新增一个很窄的“单篇补精读”入口
   - 优先复用 `process_paper(...)` 现有逻辑
   - 输入只需要：
     - 日期 / paper_id / md_path
   - 目标是在现有文章文件里补出 `## 论文详细总结（自动生成）`

2. 前端 `app/docsify-plugin.js`
   - 在文章页渲染时检测：
     - 当前页面有 `## 速览`
     - 但没有 `## 论文详细总结（自动生成）`
   - 满足时在 `paper-glance-section` 下方插一个 CTA：
     - 文案：`生成精读`
     - 点击后触发新的“单篇补精读”流程

3. 前端轮询成功条件
   - 不要新开路由
   - 轮询当前文章 markdown 是否已经包含 `论文详细总结（自动生成）`
   - 成功后直接刷新当前页面，并把视图滚到详细总结区

4. 样式层
   - CTA 只做一个轻量按钮行即可
   - 不要引入新弹窗 / 新抽屉 / 新页面

#### PR5 验收标准

- 速读文章页在“只有速览 / 正文、没有详细总结”时出现按钮
- 点击后能把当前文章升级为精读，而不是跳到不存在的页面
- 成功后刷新当前页面，并定位到详细总结区

---

### PR6：RSS 只先做日报，不做 seed-paper feed

## 结论先说

- **值得做**：日报 RSS
- **暂不建议做**：seed-paper RSS

### 为什么日报 RSS 值得做

当前 repo 已经有两个稳定产物：

- `build_day_report_markdown(...)` 产出的日报 README
- `papers.meta.json`

这意味着日报 feed 的数据源已经存在，只差 feed writer。

### 为什么 seed-paper RSS 现在不值得做

seed-paper 结果是：

- 临时请求驱动
- 频率不稳定
- 对外传播价值明显低于日报
- 很容易把 feed 变成噪音流

### 建议实现边界

#### 需要改的文件

- `src/6.generate_docs.py`
- 如有必要，抽一个很小的 `feed writer` helper
- 对应测试文件

#### 最小可交付版本

1. 只产出一个日报 feed，例如：
   - `docs/feed.xml`

2. item 级别只放“日报”而不是“单篇论文”
   - 每天一条 item
   - 标题、生成时间、deep/quick 数量、日报摘要都已在现有产物中可得

3. base URL 不要硬编码
   - RSS 需要绝对链接
   - 当前站点是 Docsify hash 路由，最终链接必须通过可配置 `site_url` 拼出来
   - 不要把域名写死在代码里

4. 先不做 seed-paper feed
   - 如果未来真要做，也应该单独 feed、单独开关，不要和日报混在一起

#### PR6 验收标准

- `docs/feed.xml` 能稳定生成
- 至少包含最近若干天日报
- item 链接使用可配置 `site_url + hash route`
- 不引入 seed-paper feed

---

## 推荐测试清单

### Python

- `tests/test_seed_paper_processor.py`
  - related 页面磁盘不变量
  - `related_page_paths` 与真实文件一致
  - related 全文优先、abstract fallback
  - related 页面正文不再只是摘要
  - degraded rerank 仍能写出 related 页面

- `tests/test_seed_paper_workflow.py`
  - workflow 校验使用新 hash 路由契约
  - 失败时输出足够诊断信息

- `tests/test_generate_docs_meta_parse.py`
  - skim 正文 skeleton 是否完整
  - deep summary skeleton 是否完整
  - `build_markdown_content(...)` 不再把正文固定为 abstract-only
  - 如有格式 helper，锁定 heading / block 顺序契约

- 如有 `process_paper(...)` 相关测试
  - quick 页面生成后，正文应包含新的 skim body block
  - deep 页面生成后，应在 quick 基础上再追加 detailed summary block

### JavaScript

- `tests/test_docsify_plugin.js`
  - 只有速览 / 正文、没有详细总结时显示 CTA
  - 已有详细总结时不显示 CTA
  - CTA 渲染位置稳定

- `tests/test_subscriptions_manager.js`
  - 如果前端需要调新的“单篇补精读”入口，补轮询和状态文案测试

---

## 本地验证顺序

建议 implementer 每个 PR 都按下面顺序验，不要最后一次性联调：

1. `python3 -m unittest tests.test_seed_paper_processor tests.test_seed_paper_workflow tests.test_generate_docs_meta_parse`
2. `node tests/test_docsify_plugin.js`
3. `node tests/test_subscriptions_manager.js`
4. 对一个主链路 fixture 跑一次本地 `process_paper(...)`：
   - quick 版本看正文是否已经不再只是摘要
   - deep 版本看是否在同一篇文章上追加详细总结
5. 对一个 seed-paper fixture 跑一次本地 `process_request(...)`
6. 再看生成出来的：
   - 主链路文章 markdown
   - `docs/seed-papers/<request_id>/index.md`
   - `docs/seed-papers/<request_id>/seed-paper.md`
   - `docs/seed-papers/<request_id>/related/*.md`

---

## 推荐落地顺序（不要乱）

1. **先做 PR1**：收紧 workflow 失败链路
2. **再做 PR2**：主链路 skim 正文升级
3. **再做 PR3**：seed related 全文链路和正文契约对齐
4. **再做 PR4**：deep summary 输出契约改造
5. **再做 PR5**：速读页“转精读”按钮
6. **最后再做 PR6**：日报 RSS

这个顺序的核心原因是：

- 现在先把错误定位链路补好，否则后面每一步出问题都不好查
- 先把 skim 正文补厚，才能让 deep 的定位真正上移，而不是拿 deep 去补正文的窟窿
- seed related 应该复用主链路的新正文 / 全文逻辑，而不是自己再搞一套
- CTA 必须等 deep summary 稳定后再接，不然按钮会把用户导向一个还不可靠的体验
- RSS 完全是增量项，优先级最低

---

## 一句话判断标准

如果实现完成后仍然出现下面任何一种情况，就说明没有做完：

- 主链路 skim 正文还是主要只有 `## 摘要`
- seed-paper related 页面还是主要靠 abstract 在写速览 / 正文 / 精读
- deep 输出仍然只是 5 段连续叙述
- workflow 失败时日志仍然只剩一句 `Seed workflow produced no related pages.`
- 速读页按钮只是跳了个页面，但并没有让当前文章真正变成精读
- RSS 先做成了 seed-paper feed，而日报 feed 反而没做
