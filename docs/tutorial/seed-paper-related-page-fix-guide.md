# Seed Paper 关联页修复指南（给 implementer）

## 目标

修复最新 seed paper 请求 `1776789841135` 的两个线上问题：

1. seed page 上的 related papers 链接点击后进入 `404.md` 兜底页。
2. seed page / related page 没有展示用户期待的“与 seed paper 的关联证据”和评分。

这份指南只覆盖这次线上问题，不复用之前那份 PDF allowlist / 前端轮询指南。

---

## 已核实的事实

### 1. 这不是“发布漏文件”问题

已核实最近两条 Actions：

- `seed-paper-related` run `24734803774`：success
- `seed-paper-publish` run `24735094517`：success

publish 日志里明确提交了本次页面产物：

- `docs/seed-papers/1776789841135/index.md`
- `docs/seed-papers/1776789841135/seed-paper.md`
- `docs/seed-papers/1776789841135/related/*.md`

因此，用户点击 related paper 进入 404，**不是因为文件没生成或没 publish**。

### 2. 最新 run 是“成功但降级”

`seed-paper-related` 日志里有：

```text
[WARN] seed rerank unavailable, falling back to retrieval order: rerank disabled
"rerank_status": "degraded_success"
```

这说明本次页面是在 **rerank 降级模式** 下发布的。

### 3. 当前 index.md 写的是相对 Markdown 链接

当前 seed index 的链接形态是：

```markdown
- [Open seed paper](seed-paper.md)
- [FAST: ...](related/2604.13453v1.md)
```

### 4. 当前 related page front matter 没有 `score:` / `evidence:`

已核实本次发布的 related 页面 front matter 中没有这些字段；但正文 `## 速览` 里有一段 `Evidence` 文案。

这说明：

- 页面正文后来补进去了“速览证据”
- 但前端顶部 meta 区消费的结构化 front matter 并没有拿到 `score` / `evidence`

---

## 根因 1：index 页面把 nested docs 链接写成了相对 `.md`，而当前 Docsify 配置并没有启用相对路径解析

### 证据链

#### A. 生成端当前写法

`src/seed_paper_processor.py` 现在在 index 中输出：

```python
"- [Open seed paper](seed-paper.md)"
f"- [{title}]({page['path']})"
```

同时 `page['path']` 也是：

```python
f"related/{md_path.name}"
```

#### B. 前端当前 Docsify 配置

`app/docsify-plugin.js` 里当前配置是：

```javascript
window.$docsify = {
  basePath: 'docs/',
  loadSidebar: '_sidebar.md',
  alias: {
    '/.*/_sidebar.md': '/_sidebar.md',
  },
}
```

当前没有显式设置 `relativePath: true`。

Docsify 官方文档说明：只有在 `relativePath: true` 时，文档内链接才会按当前目录解析；默认不是这个行为。

#### C. 本仓库插件只劫持了 sidebar 的 hash link，没有处理正文里的 seed-paper 相对链接

`app/docsify-plugin.js` 里现有的 `bindSidebarVirtualHashLinks()` 只绑定：

```javascript
nav.querySelectorAll('a[data-dpr-hash]')
```

而 seed page 正文里的 `[related/...md]` 链接不走这套逻辑。

### 结论

当前 seed index 里的：

- `seed-paper.md`
- `related/foo.md`

对 Docsify 来说不是稳定的 nested route 写法，在 `#/seed-papers/1776789841135/index` 这个页面里会被解析到错误位置，最终落到 `_404.md`。

### 建议修复

**不要依赖 Docsify 的默认相对链接行为。**

直接把 seed-paper 页面里的链接改成**显式 hash 路由**，例如：

- `#/seed-papers/<request_id>/seed-paper`
- `#/seed-papers/<request_id>/related/<slug>`

也就是说，`_build_index_content()` 不要再输出相对 `.md` 链接，而要输出 Docsify 能稳定消费的 route。

### 推荐落点

修改文件：

- `src/seed_paper_processor.py`
- `tests/test_seed_paper_processor.py`

### 不推荐的首选方案

全局打开 `window.$docsify.relativePath = true` 也可能让这组链接恢复正常，但它会影响整站 Markdown 链接解析规则，回归面太大，不建议作为第一修复手段。

---

## 根因 2：seed-paper 流程没有在写 Markdown 之前准备好“结构化关联证据”，而且 index 构建时读错了字段名

### 证据链

#### A. 前端顶部 meta 区只认 front matter 的 `evidence` / `score`

`app/docsify-plugin.js` 中：

```javascript
if (meta.evidence) {
  lines.push(`<p><strong>Evidence</strong>: ...`)
}
if (meta.score !== undefined && meta.score !== null) {
  lines.push(`<p><strong>Score</strong>: ...`)
}
```

所以只要 front matter 里没有 `evidence:` / `score:`，顶部就不会显示。

#### B. `build_markdown_content()` 只会从固定结构化字段写入这些 front matter

`src/6.generate_docs.py` 中：

- `score` 来自 `paper["llm_score"]`
- `evidence` 来自 `paper["canonical_evidence"]`
- `tldr` 来自 `paper["llm_tldr_cn"] / llm_tldr / llm_tldr_en`

也就是说，想让页面顶部出现关联证据，生成端必须在写 Markdown 前就把这些结构化字段放到 `paper` 里。

#### C. 当前 seed-paper 流程并没有把 query-match evidence 准备好

`src/seed_paper_processor.py` 的 seed-paper 主链路目前是：

1. recall 召回候选 paper
2. rerank（成功时只给 `llm_score`）
3. 直接进入 `render_seed_workspace()`

当前链路里没有一个明确步骤去生成：

- `canonical_evidence`
- `llm_tldr_cn` / `llm_tldr`
- 维度分数（`relevance_score` / `quality_score` / ...）

也就是说，**与 seed query 相关的结构化解释字段根本没有被稳定产出**。

#### D. `_render_related_pages()` 还是先写 Markdown，再生成 quick skim

当前顺序是：

1. `build_markdown_content(...)`
2. `md_path.write_text(...)`
3. `generate_glance_overview(...)`
4. `upsert_auto_block(..., "速览", glance)`

这会导致：

- 速览里的 `Evidence` 只会进入正文 block
- 但 front matter 不会因此自动补出 `evidence:`

所以你看到的现象才会是：

- 页面正文有 `**Evidence**：...`
- 顶部 meta 区还是空的

#### E. index 页构建时还在读错字段名

`src/seed_paper_processor.py` 当前 index 记录使用的是：

```python
"score": paper.get("llm_score")
"evidence": paper.get("evidence") or paper.get("tldr") or ""
```

但整个仓库里更稳定的标准字段其实是：

- `canonical_evidence`
- `llm_tldr_cn` / `llm_tldr`

所以即使上游已有规范字段，这里也会把 evidence 丢掉。

### 结论

“页面没有展示关联证据”不是单点渲染 bug，而是两层问题叠加：

1. seed-paper 流程没有稳定产出 query-match 结构化证据字段
2. 即使后续 quick skim 生成了正文证据，front matter 和 index 也拿不到

### 建议修复

#### 修复 2A：在 seed-paper docs render 之前，先把结构化关联字段补齐

推荐不要把 quick skim 正文里的 `Evidence` 直接冒充“与 seed paper 的关联证据”。

更合理的做法是：在 `rank_related_papers()` 之后、`render_seed_workspace()` 之前，给入选 related papers 补齐与主链路一致的数据契约，例如：

- `canonical_evidence`
- `llm_tldr_cn` / `llm_tldr`
- `llm_relevance_score`
- `llm_quality_score`
- `llm_reliability_score`
- `llm_practicality_score`

这部分建议优先复用现有主链路已经在使用的字段规范，不要再定义一套 seed-paper 专有字段。

相关参考文件：

- `src/4.llm_refine_papers.py`
- `src/5.select_papers.py`
- `src/6.generate_docs.py`

#### 修复 2B：`_build_related_records()` / `written.append()` 改读规范字段

至少把 evidence / tldr 的读取对齐到现有标准字段，不要继续只读：

- `paper["evidence"]`
- `paper["tldr"]`

建议对齐到：

- `paper["canonical_evidence"]`
- `paper["llm_tldr_cn"]`
- `paper["llm_tldr"]`
- `paper["llm_tldr_en"]`

#### 修复 2C：如果仍保留 quick skim 生成，必须在首轮写 Markdown 前完成需要进入 front matter 的字段

如果 implementer 还想让 quick skim 的结构也反映到 front matter，必须把相关信息在第一次 `build_markdown_content()` 前准备好，或者在插入 quick skim 后重新生成 Markdown front matter。

否则永远只会出现“正文有，顶部没有”。

---

## 根因 3：这次页面没有 score，还有一层独立原因——本次 rerank 实际处于 degraded_success

### 证据链

`seed-paper-related` 日志明确写了：

```text
[WARN] seed rerank unavailable, falling back to retrieval order: rerank disabled
"rerank_status": "degraded_success"
```

而 `src/seed_paper_processor.py` 在 fallback 路径里会把 `llm_score` 置为 `None`。

所以本次发布页面里缺少 `score:`，**并不是 publish 丢字段**，而是上游根本没有真实 score 可写。

### 结论

“分数没显示”这件事，这次至少有两层原因：

1. 结构化字段传播本来就不完整
2. 最新线上 run 本身就是 rerank 降级，没有可写入的真实 score

### 建议修复

这部分不要伪造 fallback score。

可选方案只有两类：

#### 方案 A：修好 hosted rerank 配置，让 seed-paper run 回到 `full_success`

当前 workflow 已经把这些 env 接进去了：

- `RERANK_ENABLED`
- `RERANK_API_KEY`
- `RERANK_BASE_URL`
- `RERANK_MODEL`

所以如果线上仍然是 `rerank disabled`，更像是 **GitHub secrets / hosted config** 问题，而不是 repo 内的 YAML 缺变量。

#### 方案 B：代码侧显式暴露 degraded 状态，而不是静默发布“空分数”页面

如果产品要求“有分才发布”，可以考虑在 seed-paper 链路里把 `rerank_status != full_success` 当成阻断条件。

如果产品允许降级发布，那至少也应在页面或 index 中明确标注：

- score unavailable
- rerank degraded

不要让用户误以为这是前端渲染问题。

---

## implementer 建议修改范围

### P0：修 404 路由问题

修改文件：

- `src/seed_paper_processor.py`
- `tests/test_seed_paper_processor.py`

目标：index 页面不再生成相对 `.md` 链接，改为稳定的 hash 路由。

### P0：修结构化 evidence 传播

修改文件：

- `src/seed_paper_processor.py`
- 如需复用现有 refine/select 逻辑，可能涉及：
  - `src/4.llm_refine_papers.py`
  - `src/5.select_papers.py`
- `tests/test_seed_paper_processor.py`

目标：related page front matter 和 seed index 都能拿到规范的 `evidence` / `tldr` / score 字段。

### P1：处理 rerank degraded 的产品行为

修改文件（视方案而定）：

- `src/seed_paper_processor.py`
- `.github/workflows/seed-paper-related.yml`（仅在你决定 fail closed 时）
- 以及对应测试

目标：不要再出现“页面发布成功，但用户看见空 score 且不知道是 rerank degraded”的状态。

---

## 建议补的测试

### 1. `tests/test_seed_paper_processor.py`

至少补这几类断言：

#### 路由相关

- `index.md` 里的 seed 链接是 `#/seed-papers/demo-request/seed-paper`
- `index.md` 里的 related 链接是 `#/seed-papers/demo-request/related/p1`
- 不再输出 `seed-paper.md` / `related/p1.md` 这种相对 Markdown 链接

#### 结构化字段传播相关

构造一个 related paper fixture，包含：

- `llm_score`
- `canonical_evidence`
- `llm_tldr_cn`
- 维度分数

断言生成的 related markdown front matter 中包含：

- `score:`
- `evidence:`
- `tldr:`
- `relevance_score:` 等分数字段

同时断言 `index.md` 会把 evidence / score 带出来。

#### degraded 状态相关

如果你决定保留降级发布：

- 断言 `rerank_status=degraded_success` 时页面会出现明确的 degraded 提示
- 但不会伪造 score

如果你决定 fail closed：

- 断言 rerank 降级时 workflow / processor 会直接失败，不会继续 publish

---

## 建议的本地验证命令

```bash
python3 -m unittest tests.test_seed_paper_processor -q
python3 -m unittest tests.test_seed_paper_workflow -q
node tests/test_docsify_plugin.js
```

如果你引入了新的 seed-paper 专项测试文件，再把它们一起加进来。

---

## 线上回归口径

修复后至少验证一次完整链路：

1. 上传新的 seed PDF
2. 观察 `seed-paper-related` run
3. 确认 `seed-paper-publish` run 成功
4. 打开 `#/seed-papers/<new_request_id>/index`
5. 点击 seed / related 链接，不再进入 `_404.md`
6. seed index 能看到结构化 evidence（如果本次 run 有）
7. related page 顶部 meta 区能看到 `Evidence` / `Score`（如果本次 run 有）
8. 如果 rerank 仍 degraded，页面上会明确显示 degraded，而不是静默空白

---

## 一句话判断标准

这轮修复完成的标准不是“文件成功 publish”，而是：

- seed index 里的链接能打开正确页面
- 关联证据通过结构化字段真正传到页面
- score 的有无与 rerank 状态一致，且对用户透明
