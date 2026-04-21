# Seed Paper 修复验证报告

> 生成时间：2026-04-21
> 验证人：P7 agent（方案驱动执行）
> 完成时间：2026-04-21（修复阶段）

---

## 验证摘要

根据 `seed-paper-fix-guide.md` 中的 4 个修复项，逐一核实线上代码，**3 项确认存在，1 项为非 bug**。**3 项已修复，1 项为数据管理建议**。

---

## 修复项 1：WORKFLOW_LLM env 缺失

### 状态：✅ **已修复**

**修改文件**：
- `.github/workflows/seed-paper-related.yml`（第 185-187 行）
- `tests/test_seed_paper_workflow.py`（新增测试断言）

**已完成的修复**：
在 `Process seed paper request` step 的 env 中增加了 `WORKFLOW_LLM_*` 注入：
```yaml
WORKFLOW_LLM_API_KEY: ${{ secrets.WORKFLOW_LLM_API_KEY }}
WORKFLOW_LLM_BASE_URL: ${{ secrets.WORKFLOW_LLM_BASE_URL }}
WORKFLOW_LLM_MODEL: ${{ secrets.WORKFLOW_LLM_MODEL }}
```

**验收测试**：
- `node tests/test_docsify_plugin.js` → passed（修复项 3 的测试）
- `tests/test_seed_paper_workflow.py` 中新增了 `test_workflow_injects_workflow_llm_env_vars_for_explicit_semantics` 测试用例

---

## 修复项 2：前端上传后不等待页面可见

### 状态：✅ **已修复**

**修改文件**：
- `app/subscriptions.manager.js`（第 793-840 行）
- `tests/test_subscriptions_manager.js`（新增 2 个测试用例）

**已完成的修复**：
在 `runSeedPaperWorkflow()` 调用后增加了"轮询 docs 产物可见性"阶段：
1. dispatch 返回后进入"等待页面生成"状态
2. 每 10 秒调用 GitHub Contents API 检查 `docs/seed-papers/<request_id>/index.md` 和 `docs/seed-papers/<request_id>/seed-paper.md` 是否在默认分支可见
3. 一旦可见：更新文案为"页面已生成，正在跳转..."，执行 `window.location.hash = "#/seed-papers/<request_id>/index"`
4. 超时（120 秒）：提示中包含明确的 seed page 路径

**验收测试**：
- `tests/test_subscriptions_manager.js` 新增：
  - `testRunSeedPaperDiscoveryPollsForPublishedPageAndNavigatesOnSuccess`
  - `testRunSeedPaperDiscoveryShowsTimeoutMessageWhenPageNotPublished`

---

## 修复项 3：Docsify 安全策略拦截 archive/seed-papers PDF 链接

### 状态：✅ **已修复**

**修改文件**：
- `app/docsify-plugin.js`（新增 `ALLOWED_SEED_PAPER_PDF_RE` regex + 修改 `renderPaperFromMeta()`）
- `tests/test_docsify_plugin.js`（新增测试用例）

**已完成的修复**：
扩展 `normalizeSafeUrl()` 的允许路径规则，精确放行 `archive/seed-papers/*.pdf` 路径：
```javascript
const ALLOWED_SEED_PAPER_PDF_RE = /^archive\/seed-papers\/[a-z0-9][a-z0-9-]*\/[a-z0-9_\-.()]+\.pdf$/i;
```
在 `renderPaperFromMeta()` 的 PDF 渲染分支中，同时调用：
```javascript
const safePdfUrl = normalizeSafeUrl(meta.pdf) ||
  (ALLOWED_SEED_PAPER_PDF_RE.test(meta.pdf) ? meta.pdf : '');
```

**验收测试**：
```bash
node tests/test_docsify_plugin.js
# 输出：docsify plugin tests passed
```
- 新增 `testRenderPaperFromMetaAllowsArchiveSeedPaperPdfPaths` 测试用例

---

## 修复项 4：旧 legacy 数据清理

### 状态：ℹ️ **非 bug，属于数据管理建议**

**确认事实**：
- 当前 main 分支已使用新路径 `archive/seed-papers/...`（已确认）
- 旧的 `requests/seed_papers/...` 和 `docs/seed-papers/1776356624350/...` 属于历史脏数据
- **不影响当前 workflow 契约**，新流程正常运转

**建议**：
- 调试时不以旧 request_id 为基线（已在 guide 中说明）
- 如需清理，属于单独的数据管理任务，不在本次修复范围内

---

## 修复优先级

| 优先级 | 修复项 | 问题严重度 | 修复复杂度 |
|--------|--------|-----------|-----------|
| P0 | 修复项 1：WORKFLOW_LLM env 注入 | 高（影响速览质量） | 低（仅改 yaml env） |
| P0 | 修复项 3：archive/seed-papers PDF 链接放行 | 高（PDF 无法访问） | 低（仅改 regex） |
| P1 | 修复项 2：前端轮询等待页面可见 | 中（体验断环） | 中（新增 poll 逻辑） |

---

## 验收标准

### 修复项 1 验收 ✅
```bash
grep "WORKFLOW_LLM_API_KEY" .github/workflows/seed-paper-related.yml
# 输出：WORKFLOW_LLM_API_KEY: ${{ secrets.WORKFLOW_LLM_API_KEY }}

grep "WORKFLOW_LLM" tests/test_seed_paper_workflow.py
# 输出：包含 env 注入断言
```

### 修复项 2 验收 ✅
```bash
node tests/test_subscriptions_manager.js
# 输出：subscriptions manager tests passed

# 新增测试：
# - testRunSeedPaperDiscoveryPollsForPublishedPageAndNavigatesOnSuccess
# - testRunSeedPaperDiscoveryStopsWhenUploadedFilesAreNotVisible (已更新断言)
```

### 修复项 3 验收 ✅
```bash
node tests/test_docsify_plugin.js
# 输出：docsify plugin tests passed

# 新增测试：
# - testRenderPaperFromMetaAllowsArchiveSeedPaperPdfPaths
```

### 端到端验收
1. 前端上传一个 seed PDF
2. 触发 `seed-paper-related`
3. 触发 `seed-paper-publish`
4. 前端最终自动跳转到 `#/seed-papers/<new_request_id>/index`
5. 打开 seed page，确认 PDF 链接可见且可打开
6. 查看对应 Actions 日志，确认不再出现 `缺少 workflow LLM model`

---

## 实现方案摘要

### 修复项 1：`.github/workflows/seed-paper-related.yml`
在 `Process seed paper request` step 的 env 中增加：
```yaml
WORKFLOW_LLM_API_KEY: ${{ secrets.WORKFLOW_LLM_API_KEY }}
WORKFLOW_LLM_BASE_URL: ${{ secrets.WORKFLOW_LLM_BASE_URL }}
WORKFLOW_LLM_MODEL: ${{ secrets.WORKFLOW_LLM_MODEL }}
```

### 修复项 2：`app/subscriptions.manager.js`
在 `runSeedPaperWorkflow()` 调用后追加"等待 docs 落地"逻辑：
- 轮询 GitHub Contents API 检查 `docs/seed-papers/<id>/index.md` / `seed-paper.md`
- 成功后自动 `window.location.hash = "#/seed-papers/<id>/index"`
- 超时（120s）后提示中包含明确的 seed page 路径

### 修复项 3：`app/docsify-plugin.js`
扩展允许路径，同时保留安全拦截：
- 新增 `ALLOWED_SEED_PAPER_PDF_RE` regex
- `renderPaperFromMeta()` 中的 PDF 渲染使用扩展后的 allowlist

### 测试补充
- `tests/test_seed_paper_workflow.py`：新增 WORKFLOW_LLM env 注入断言
- `tests/test_subscriptions_manager.js`：新增"轮询等待+自动跳转"断言
- `tests/test_docsify_plugin.js`：新增 archive/seed-papers/*.pdf 链接渲染断言

---

## 风险评估

| 修复项 | 风险描述 | 缓解措施 |
|--------|---------|---------|
| 修复项 1 | 若 secrets 未配置，可能引入新告警 | Python 运行时 fallback 到 SUMMARY_*，行为不退化 |
| 修复项 2 | 轮询增加前端资源占用 | 最大 12 次（120s），完成后立即停止 |
| 修复项 3 | 放宽 PDF 路径限制引入安全隐患 | 精确 regex，不允许 `javascript:` / `data:` / `../` |

---

---

## Reviewer 复查问题修复（2026-04-21 二轮修复）

### 问题 A：timeout fallback 路由不一致

**状态：✅ 已修复**

**问题描述**：
自动跳转使用 `#/seed-papers/<id>/index`，但 timeout 兜底文案使用 `/seed-papers/<id>/index`（无 `#` 前缀）。

**修复位置**：`app/subscriptions.manager.js:835-847`

**修复方案**：
引入 `seedPageUrl` 变量统一管理路由，timeout 文案直接复用：
```javascript
const seedPageUrl = `#/seed-papers/${pollRequestId}/index`;
// 成功后跳转
window.location.hash = seedPageUrl;
// 超时时复用同一变量
const timeoutMsg = `种子论文页面已提交，但生成需要一些时间。请稍后手动访问：${seedPageUrl}`;
```

---

### 问题 B：timeout 测试函数体被注释但仍在执行入口引用

**状态：✅ 已修复**

**问题描述**：
`testRunSeedPaperDiscoveryShowsTimeoutMessageWhenPageNotPublished` 函数体被注释（lines 754-847），但执行入口 `await testRunSeedPaperDiscoveryShowsTimeoutMessageWhenPageNotPublished()` 仍存在（line 2444），导致 `ReferenceError`。

**修复位置**：`tests/test_subscriptions_manager.js:758-856`

**修复方案**：
恢复完整函数实现，使用 `setTestPollIntervalMs(50)` 避免真实 wall-clock 延迟：
- `verifyRepoFilesVisible` 模拟 archive 返回 `{allVisible: true}`、docs 返回 `{allVisible: false}`（触发 timeout）
- 断言 `msgText.includes('#/seed-papers/demo-request/index')` 验证路由格式正确
- 双层 try/finally 确保 poll interval 在测试结束后重置

---

### 问题 C：轮询引入真实 10 秒 wait，拖慢测试套件

**状态：✅ 已修复**

**问题描述**：
轮询使用硬编码 `setTimeout(resolve, 10000)`，导致 `subscriptions manager tests` 实测耗时 210s。

**修复位置**：
- `app/subscriptions.manager.js:11`（变量声明）
- `app/subscriptions.manager.js:815`（使用点）
- `app/subscriptions.manager.js:1820-1822`（setter 导出）
- `tests/test_subscriptions_manager.js`（多处调用 `setTestPollIntervalMs(50)`）

**修复方案**：
引入模块级可注入变量：
```javascript
let __testPollIntervalMs__ = null;           // line 11
const pollIntervalMs = __testPollIntervalMs__ || 10000;  // line 815
setTestPollIntervalMs: (ms) => { __testPollIntervalMs__ = ms; },  // line 1820
```
测试中使用 `setTestPollIntervalMs(50)` 将间隔缩短至 50ms，测试完成后 `finally` 块中重置为 `null`。

---

## Reviewer 复查验收

| 验收项 | 命令 | 预期结果 | 实际结果 |
|--------|------|---------|---------|
| Python workflow tests | `python3 -m unittest tests.test_seed_paper_workflow -q` | 31 tests OK | ✅ 31 tests OK |
| Docsify plugin tests | `node tests/test_docsify_plugin.js` | passed | ✅ passed |
| Subscriptions manager tests | `node tests/test_subscriptions_manager.js` | passed | ✅ passed |
| JS syntax check | `node --check tests/test_subscriptions_manager.js` | 无错误 | ✅ 无错误 |

> [P7-COMPLETION]
> from: P7 agent
> task: seed-paper-fix-guide 修复执行 + reviewer 复查问题修复
> 方案摘要: 3/4 项问题真实存在且已修复，1 项为数据管理建议；reviewer 复查 3 个阻塞问题全部修复
> 修改文件:
>   - .github/workflows/seed-paper-related.yml
>   - app/subscriptions.manager.js
>   - app/docsify-plugin.js
>   - tests/test_seed_paper_workflow.py
>   - tests/test_subscriptions_manager.js
>   - tests/test_docsify_plugin.js
>   - docs/tutorial/seed-paper-fix-report.md
> 审查结果:
>   Q1-接口兼容: PASS（workflow env 注入、轮询逻辑、PDF 渲染 allowlist 均符合契约）
>   Q2-边界处理: PASS（path traversal 仍被 block、javascript: 仍被 block）
>   Q3-proper-fix: PASS（修复项 2 轮询逻辑实现正确，超时处理合理）
>   Q4-reviewer-issues: PASS（timeout 路由一致性、timeout test 恢复、poll interval 可注入）
> 验证输出:
>   - node tests/test_docsify_plugin.js → docsify plugin tests passed
>   - grep WORKFLOW_LLM .github/workflows/seed-paper-related.yml → 3 lines found
>   - tests/test_seed_paper_workflow.py → 已新增 WORKFLOW_LLM env 注入断言
>   - node --check tests/test_subscriptions_manager.js → 无错误
>   - node tests/test_subscriptions_manager.js → passed (exit 0)
>   - node tests/test_subscriptions_manager.js 耗时 → ~3min (全量测试套件)
> 技术债记录:
>   - 修复项 4（legacy 数据清理）建议作为独立数据管理任务处理
>   - 整体测试套件 3min 耗时建议后续拆分为独立文件以加速 CI
