# Seed Paper 页面修复指南（给 implementer）

## 目标

本指南用于修复 seed paper 上传后的两类线上问题，并形成前端到 Actions 再到发布页面的完整闭环：

1. `seed-paper-related` 成功运行后，日志里仍然出现 `未配置 LLM_CLIENT` / `未配置 workflow LLM` 告警。
2. 前端上传 seed paper 后，用户侧无法自动拿到一个可直接打开的 seed page；即使页面已发布，PDF 链接也可能不显示。

---

## 已核实的线上事实

### 1) 最新 workflow 不是失败，而是“成功但降级”

已确认最近线上运行：

- `seed-paper-related` run `24712596302`：success
- `seed-paper-publish` run `24712674719`：success

但 `seed-paper-related` 最新成功 run 的日志里仍有如下告警：

```text
[WARN] 未配置 LLM_CLIENT，跳过速览生成。 原因：缺少 workflow LLM model
[WARN] 未配置 workflow LLM，跳过精读总结。 原因：缺少 workflow LLM model
```

这说明当前问题不是 workflow 直接失败，而是 **workflow LLM 配置仍未闭环，导致 seed page 内容降级生成**。

### 2) 最新已发布 seed page 的 request_id 不是旧的 1776356624350

已确认 main 分支上最新发布的 seed page 为：

- `docs/seed-papers/1776760574807/index.md`
- `docs/seed-papers/1776760574807/seed-paper.md`

main 分支上的 sidebar / README 也已经指向该最新 request：

- `docs/_sidebar.md` 包含 `#/seed-papers/1776760574807/index`
- `docs/README.md` 包含 `/seed-papers/1776760574807/index`

### 3) 最新 seed-paper frontmatter 已写入 archive 路径

main 分支上最新发布的 `seed-paper.md` frontmatter 中：

```yaml
pdf: archive/seed-papers/1776760574807/wan-et-al-2025-cato-end-to-end-optimization-of-ml-based-traffic-analysis-pipelines.pdf
```

说明 **后端/工作流侧已经在用新的 `archive/seed-papers/...` 路径**。

### 4) 旧的 1776356624350 页面仍是 legacy 脏数据

当前仓库里还能看到旧页面：

- `docs/seed-papers/1776356624350/seed-paper.md`

其中 frontmatter 仍然是：

```yaml
pdf: requests/seed_papers/1776356624350/...
```

这是旧协议路径，不是当前 workflow 契约。这个旧页面不要作为修复目标基线。

---

## 根因拆解

### 根因 A：seed workflow 的 workflow LLM env 语义还没有彻底拉通

相关文件：

- `.github/workflows/seed-paper-related.yml`
- `src/llm.py`
- `src/6.generate_docs.py`
- `app/secret.session.js`

已确认：

- `src/llm.py` 优先读取 `WORKFLOW_LLM_*`，其次才回退到 `SUMMARY_*`。
- `src/6.generate_docs.py` 在 `LLM_CLIENT` 初始化失败时，只会跳过速览/精读，不会中断 seed page 基础页面生成。
- `app/secret.session.js` 会把会话配置同步为：
  - `WORKFLOW_LLM_API_KEY`
  - `WORKFLOW_LLM_BASE_URL`
  - `WORKFLOW_LLM_MODEL`
- 但 `seed-paper-related.yml` 当前显式注入的是 `SUMMARY_*`，workflow 语义不够直接，线上仍能出现 “缺少 workflow LLM model” 的告警。

**结论**：workflow 侧需要把 `WORKFLOW_LLM_*` 明确注入 seed-paper-related 运行环境，必要时再从 `SUMMARY_*` 兜底，而不是只靠运行时隐式回退。

### 根因 B：前端上传后只 dispatch，不等待“最终可打开页面”出现

相关文件：

- `app/subscriptions.manager.js`
- `app/workflows.runner.js`

当前实现里：

1. 上传 PDF
2. 上传 `archive/seed-papers/<request_id>/request.json`
3. dispatch `seed-paper-related`
4. 显示“已提交种子论文请求”

但缺失两个闭环动作：

- 没有等待 `seed-paper-publish` 产物真正出现在默认分支
- 没有自动跳转到 `#/seed-papers/<request_id>/index`

这就是为什么“workflow 实际成功发布了，但前端用户侧还是拿不到可直接打开页面”。

### 根因 C：Docsify 对 PDF 链接的安全白名单过严，拦掉了 archive 路径

相关文件：

- `app/docsify-plugin.js`

当前实现：

- `normalizeSafeUrl()` 默认只直接放行 `https://...`
- 相对路径只有在 `allowRelativeDocsAsset=true` 且命中 `docs/assets/...` 时才放行
- 但 seed page 的 PDF frontmatter 是 `archive/seed-papers/...pdf`

因此当前页面即使已经发布，`pdf:` 字段也可能因为安全白名单不匹配而 **不渲染链接**。

---

## implementer 修复范围

### 修复项 1：让 seed workflow 明确拿到 `WORKFLOW_LLM_*`

**目标**：消除最新成功 run 中的如下告警：

```text
缺少 workflow LLM model
```

**修改文件**：

- `.github/workflows/seed-paper-related.yml`
- `tests/test_seed_paper_workflow.py`

**建议改法**：

在 `Process seed paper request` 的 env 中，显式提供：

- `WORKFLOW_LLM_API_KEY`
- `WORKFLOW_LLM_BASE_URL`
- `WORKFLOW_LLM_MODEL`

推荐策略：

1. 优先使用 `WORKFLOW_LLM_*` secrets
2. 若未配置，再 fallback 到 `SUMMARY_*`
3. 不要只依赖 Python 运行时做隐式推断，workflow 层就要把语义写清楚

**验收标准**：

- 新的 seed-paper-related 成功 run 中，不再出现：
  - `未配置 LLM_CLIENT`
  - `未配置 workflow LLM`
  - `缺少 workflow LLM model`

---

### 修复项 2：前端提交后，轮询“已发布页面是否可见”，而不是只盯 workflow dispatch

**目标**：用户上传 PDF 后，前端最终应自动拿到并打开可访问的 seed page。

**修改文件**：

- `app/subscriptions.manager.js`
- 如有必要，可少量扩展 `app/workflows.runner.js`
- `tests/test_subscriptions_manager.js`

**推荐实现**：

不要只继续增强 workflow run 状态展示；**直接轮询最终产物是否已经落到默认分支**。这样颗粒度更准，闭环更直接。

推荐检查以下两个路径是否已在默认分支可见：

- `docs/seed-papers/<request_id>/index.md`
- `docs/seed-papers/<request_id>/seed-paper.md`

可以复用现有 GitHub API 访问能力，按如下思路实现：

1. `runSeedPaperWorkflow(...)` 返回后，进入“等待页面发布”阶段
2. 轮询 GitHub contents API，检查上述两个 docs 文件是否已可见
3. 一旦可见：
   - 更新前端提示文案
   - 自动跳转 `window.location.hash = "#/seed-papers/<request_id>/index"`
4. 若超时：
   - 在提示中给出明确页面路径，供用户手动打开
   - 但不要伪装成“已经完成”

**为什么选这个方案**：

- `seed-paper-related` 成功 != 页面已发布
- 真正用户要的是“页面可打开”，不是某个 run status 变成 success
- 轮询最终 docs 产物，比继续叠加 workflow_run 状态链更稳、更贴近结果

**验收标准**：

- 上传 seed paper 后，前端最终会自动进入 `#/seed-papers/<request_id>/index`
- 若发布较慢，页面上会显示“等待页面发布”而不是误报完成
- 超时后提示里带有明确的 seed 页面路径

---

### 修复项 3：放行已发布 seed PDF 的 repo 相对路径

**目标**：seed page 中的 PDF 链接可以正常显示并打开。

**修改文件**：

- `app/docsify-plugin.js`
- `tests/test_docsify_plugin.js`

**当前问题点**：

`renderPaperFromMeta()` 里对 `meta.pdf` 调用的是：

- `normalizeSafeUrl(meta.pdf)`

但当前安全规则只允许：

- `https://...`
- 或 `docs/assets/...`

而 seed 页面实际写入的是：

- `archive/seed-papers/<request_id>/<file>.pdf`

**推荐改法**：

保留现有安全边界，但扩展允许的 repo 相对静态资源范围，至少覆盖：

- `archive/seed-papers/<request_id>/*.pdf`

推荐不要粗暴放开所有相对路径，而是只精确允许：

- `docs/assets/...`
- `archive/seed-papers/...pdf`

可选实现方式：

1. 扩展 allowlist regex，并在 PDF 场景下显式允许这类 repo 相对路径
2. 或为论文 PDF 新增一个专用 helper，例如 `resolvePublishedPaperAssetUrl()`

**安全要求**：

以下仍必须拒绝：

- `javascript:`
- `data:`
- `../` 越级路径
- 任意非白名单 repo 相对路径

**验收标准**：

- seed page 渲染后，PDF 一栏会出现链接
- 链接指向 `archive/seed-papers/...pdf`
- 现有针对 `javascript:` / `data:` 的拦截测试继续通过

---

### 修复项 4：不要再把旧的 `requests/seed_papers/*` 当成当前链路基线

**目标**：避免 implementer 在错误数据上 debug。

**说明**：

当前最新线上链路已经使用：

- `archive/seed-papers/<request_id>/request.json`
- `archive/seed-papers/<request_id>/<file>.pdf`

仓库里遗留的：

- `requests/seed_papers/...`
- `docs/seed-papers/1776356624350/...`

属于旧数据。修复过程中：

- 不要为了兼容这份旧数据而反向污染新协议
- 只需要保证新的 upload → workflow → publish → open 流程通

这项不是必须第一时间删数据，但 **调试时不要围绕旧 request_id 继续打转**。

---

## 建议的测试补齐

### Python 测试

重点检查 workflow env 注入是否对齐：

- `tests/test_seed_paper_workflow.py`
- 如有必要，补充 `tests/test_llm_base_url.py`

建议新增/更新断言：

1. `seed-paper-related.yml` 的运行 env 中包含 `WORKFLOW_LLM_API_KEY`
2. 包含 `WORKFLOW_LLM_BASE_URL`
3. 包含 `WORKFLOW_LLM_MODEL`
4. 若 workflow secret 缺失，允许从 `SUMMARY_*` 回退到 workflow env

### JS 测试

#### `tests/test_docsify_plugin.js`

新增至少两类断言：

1. `archive/seed-papers/demo/paper.pdf` 可以被渲染成安全链接
2. `javascript:` / `data:` 仍然不允许渲染

#### `tests/test_subscriptions_manager.js`

新增至少三类断言：

1. 上传成功后，会进入“等待页面发布”逻辑
2. 当 `docs/seed-papers/<request_id>/index.md` / `seed-paper.md` 可见时，会自动跳转到 `#/seed-papers/<request_id>/index`
3. 当页面长时间不可见时，提示文案包含可手动访问的 seed page 路径

---

## 建议的验证命令

> 以下命令只作为 implementer 自测 checklist，按当前仓库测试方式执行。

### 1. Python

```bash
python3 -m pytest tests/test_seed_paper_workflow.py tests/test_llm_base_url.py
```

### 2. JS

```bash
node tests/test_docsify_plugin.js
node tests/test_subscriptions_manager.js
```

### 3. 线上回归

修复后，至少做一次完整链路验证：

1. 前端上传一个 seed PDF
2. 确认触发 `seed-paper-related`
3. 确认随后触发 `seed-paper-publish`
4. 前端最终自动跳到 `#/seed-papers/<new_request_id>/index`
5. 打开 seed page，确认 PDF 链接可见且可打开
6. 查看对应 Actions 日志，确认不再出现 `缺少 workflow LLM model`

---

## 非目标（不要过度设计）

本次修复不建议扩散到以下范围：

- 不要重写整个 workflow runner
- 不要为了旧 `requests/seed_papers/*` 页面增加兼容分支
- 不要放宽成“所有 repo 相对路径都允许作为 PDF 链接”
- 不要把 seed paper 修复扩展成整站导航重构

本次目标就是三件事：

1. workflow LLM 告警消失
2. 前端自动拿到最终 seed 页面
3. seed page 的 PDF 能正常打开

---

## 最终验收口径

满足以下条件即可视为本轮修复完成：

- 最新 `seed-paper-related` run 成功且不再报 workflow LLM 缺失
- 最新 `seed-paper-publish` run 成功
- 用户上传 seed paper 后，前端最终自动进入新页面
- 页面中的 PDF 链接可见且可打开
- 相关 Python / JS 测试通过

---

## 备注

如需 reviewer 复核，reviewer 重点检查以下三个点即可：

1. workflow env 是否显式闭环到 `WORKFLOW_LLM_*`
2. 前端是否以“页面可见”为最终完成条件，而不是只看 dispatch 成功
3. docsify 的 PDF 安全策略是否做到“精确放行 archive/seed-papers/*.pdf，同时继续拦截危险 URL”
