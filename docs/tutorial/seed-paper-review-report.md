# Seed Paper 修复 Review 报告

> 生成时间：2026-04-21
> 角色：reviewer
> 审查对象：`docs/tutorial/seed-paper-fix-report.md` 对应的实现改动

---

## Review 摘要

本次 seed paper 修复的主方向总体正确，3 个关键抓手里有 2 个已经形成有效修复，1 个主链路修复思路正确但仍存在阻塞问题。

**结论：当前不建议直接批准（request changes）。**

原因不是“没修”，而是：

1. timeout 兜底提示里的 seed page 路由与实际自动跳转路由不一致；
2. 修复报告声称 timeout 测试已补齐，但代码中该测试并未真正实现和执行；
3. 新增 polling 测试把真实等待时间带进了测试套件，导致测试耗时异常高。

---

## 实际验证证据

### 1. Python workflow tests

执行：

```bash
python3 -m unittest tests.test_seed_paper_workflow -q
```

结果：

```text
----------------------------------------------------------------------
Ran 31 tests in 0.409s

OK
```

### 2. Docsify plugin tests

执行：

```bash
node tests/test_docsify_plugin.js
```

结果：

```text
docsify plugin tests passed
```

### 3. Subscriptions manager tests

执行：

```bash
node tests/test_subscriptions_manager.js
```

结果：

```text
subscriptions manager tests passed
```

### 4. Subscriptions manager 测试真实耗时

额外测量：

```text
elapsed=210.13s
subscriptions manager tests passed
exit=0
```

这说明测试虽然通过，但新引入的 polling 测试没有把等待抽象掉，而是把真实 wall-clock delay 带进了测试流程。

---

## 审查结论分项

## 修复项 1：WORKFLOW_LLM env 注入

### 结论：✅ 通过

**核查文件**：
- `.github/workflows/seed-paper-related.yml`
- `tests/test_seed_paper_workflow.py`

**确认结果**：
- workflow 已显式注入：
  - `WORKFLOW_LLM_API_KEY`
  - `WORKFLOW_LLM_BASE_URL`
  - `WORKFLOW_LLM_MODEL`
- 对应测试断言已存在。

**关键位置**：
- `.github/workflows/seed-paper-related.yml:183-190`
- `tests/test_seed_paper_workflow.py:206-219`

**review 意见**：
这一项实现和报告基本一致，可以保留。

---

## 修复项 2：前端上传后轮询页面可见并自动跳转

### 结论：⚠️ 部分通过，但存在阻塞问题

**核查文件**：
- `app/subscriptions.manager.js`
- `tests/test_subscriptions_manager.js`
- `docs/tutorial/seed-paper-fix-report.md`

### 正向确认

实现中已经补上：
- dispatch 完成后轮询：
  - `docs/seed-papers/<request_id>/index.md`
  - `docs/seed-papers/<request_id>/seed-paper.md`
- 成功后自动跳转：
  - `#/seed-papers/<request_id>/index`

**关键位置**：
- `app/subscriptions.manager.js:803-842`

### 阻塞问题 A：timeout fallback 路由不一致

自动跳转使用：

```js
#/seed-papers/<request_id>/index
```

但 timeout 提示写的是：

```text
/seed-papers/<request_id>/index
```

**关键位置**：
- 自动跳转：`app/subscriptions.manager.js:835-842`
- timeout 文案：`app/subscriptions.manager.js:844`

**影响**：
当页面未及时生成、只能依赖兜底提示时，用户拿到的是与系统实际导航格式不一致的路径。这一条正好是异常路径，必须与主路径完全对齐。

**要求**：
timeout 文案必须直接复用 `seedPageUrl` 变量。

### 阻塞问题 B：报告宣称 timeout 测试已补，但事实不成立

报告中写明新增并验收：
- `testRunSeedPaperDiscoveryShowsTimeoutMessageWhenPageNotPublished`

但实际代码中该测试只是注释说明，没有真实执行。

**关键位置**：
- 报告：`docs/tutorial/seed-paper-fix-report.md:53-55`
- 报告：`docs/tutorial/seed-paper-fix-report.md:128-140`
- 测试注释：`tests/test_subscriptions_manager.js:754-758`
- 执行入口：`tests/test_subscriptions_manager.js:2443-2445`

**影响**：
这不是覆盖率不足的问题，而是“修复报告与真实代码状态不一致”。审查口径上不能接受。

### 问题 C：测试设计引入真实 10 秒等待

从代码实现和实测耗时可以确认：
- `app/subscriptions.manager.js:831-832` 存在真实 `setTimeout`
- `tests/test_subscriptions_manager.js` 没有 mock/注入等待机制
- 整体测试实测耗时 `210.13s`

**影响**：
- 本地回归速度显著下降
- CI 可靠性和吞吐下降
- timeout 路径仍没有真正自动化覆盖

**要求**：
将 polling sleep 抽成可注入依赖，或在测试中 mock 定时器。

---

## 修复项 3：Docsify 安全策略放行 archive/seed-papers PDF

### 结论：✅ 通过

**核查文件**：
- `app/docsify-plugin.js`
- `tests/test_docsify_plugin.js`

### 正向确认

新增 allowlist：
- `archive/seed-papers/<id>/<file>.pdf`

同时仍保持对以下危险路径的拦截：
- `javascript:`
- `data:`
- path traversal (`..`)

**关键位置**：
- allowlist regex：`app/docsify-plugin.js:3595-3599`
- PDF 渲染分支：`app/docsify-plugin.js:3755-3763`
- 新增测试：`tests/test_docsify_plugin.js:213-271`

**review 意见**：
这一项修复边界控制得比较收敛，没有明显扩大攻击面，可以保留。

---

## 修复项 4：legacy 数据问题

### 结论：ℹ️ 属于独立数据治理，不阻塞本次修复

报告中将其标记为非 bug / 数据管理建议，这个判断是合理的。

**review 意见**：
- 本次不要求为了旧 `requests/seed_papers/*` 兼容而污染新链路
- 但后续如有数据治理任务，可单独处理

---

## 对修复报告本身的评价

### 准确部分

- 对修复项 1 的描述基本准确
- 对修复项 3 的描述基本准确
- 对修复项 2 的主思路描述基本准确

### 不准确部分

1. 把“注释掉的 timeout test”写成“已新增并验收”
2. 没有指出 timeout fallback 路由与自动跳转路由不一致
3. 没有揭示新增测试引入了真实 210s 的 wall-clock 延迟

**结论**：
报告不能作为“已全部验收通过”的依据，需要修正后再作为正式交付材料。

---

## 最终审查意见

### 审查结论：**Request changes**

### 必改项

1. **修正 timeout fallback 路由**
   - 文件：`app/subscriptions.manager.js:844`
   - 要求：改为复用 `#/seed-papers/<id>/index`

2. **把 timeout 测试真正实现并接入执行入口**
   - 文件：`tests/test_subscriptions_manager.js`
   - 要求：不能只写注释说明，必须变成可执行自动化测试

3. **消除测试中的真实轮询等待**
   - 文件：`app/subscriptions.manager.js` / `tests/test_subscriptions_manager.js`
   - 要求：将等待机制做成可 mock / 可注入，避免 210s 级别测试耗时

4. **修正修复报告中的失真描述**
   - 文件：`docs/tutorial/seed-paper-fix-report.md`
   - 要求：删除或更正“timeout 测试已验收通过”的表述

### 可保留项

- workflow env 注入修复
- docsify archive PDF allowlist 修复
- 前端 dispatch 后轮询 docs 落地的整体思路

---

## 建议的 reviewer comment 结构

如果后续要发到 PR，可按下面结构拆 comment：

### Review comment（总评）
- 当前不建议直接批准
- 说明 2 个阻塞问题 + 1 个测试设计问题

### Line comments
1. `app/subscriptions.manager.js:844`
   - timeout 路由应与自动跳转路由一致
2. `tests/test_subscriptions_manager.js:754-758`
   - 报告声称 timeout test 已补，但这里只是注释
3. `tests/test_subscriptions_manager.js`（polling 测试相关段落）
   - 当前测试引入真实等待，建议改成 injectable/mockable wait

---

## 最终结论（给项目 owner）

这版修复已经把“主功能修复”做到了 70%-80%，但“验证闭环”和“异常路径兜底”还没收口。

**不建议现在 merge。**

等 implementer 修完以下 4 个点后，再做一次快速复审即可：

- timeout fallback 路由修正
- timeout test 真正落地
- 测试等待机制去真实 sleep
- 修复报告纠偏
