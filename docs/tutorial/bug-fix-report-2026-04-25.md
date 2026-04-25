# Bug 修复报告 — 2026-04-25

> 配套文档：[bug-fix-guide-2026-04-25.md](./bug-fix-guide-2026-04-25.md)
> 本报告记录指南中 5 个 bug 的真实性核查与修复落地结果。

---

## 概览

| Bug | 描述 | 真实性 | 状态 |
|-----|------|--------|------|
| #1 | 略读总结截断 + 英文输出（LLM 调用方法不存在） | ✅ 真实 | ✅ 已修复 |
| #2 | 精读区 md 源码直接展示（KaTeX 渲染时序问题） | ✅ 真实 | ✅ 已修复 |
| #3 | 前端看不到 RSS 订阅指示 | ✅ 真实 | ✅ 已修复 |
| #4 | Seed Paper / Related Paper 点开 404 | ✅ 真实 | ✅ 已修复 |
| #5 | seed-paper-publish Action 失败 | ✅ 真实 | ✅ 已修复 |

5 个 bug 全部经源码核查确认存在，已逐项修复。`python -m unittest` 共 366 个测试全部通过。

---

## Bug #1：LLM 调用方法不存在

### 核查结果

- **文件**：`src/6.generate_docs.py:1111`
- **现象**：调用 `LLM_CLIENT.messages_create(...)`，但通过 `dir(LLMClient)` 验证：
  - `chat` ✅ 存在
  - `messages_create` ❌ 不存在
  - `chat_structured` ✅ 存在
- **影响**：`generate_skim_body` 每次调用都触发 `AttributeError`，被 `except Exception` 捕获后 100% 走 fallback，导致略读总结仅输出英文片段（截断且未翻译）。

### 修复

```python
# Before
response = LLM_CLIENT.messages_create(
    model=(LLM_CLIENT.model or "unknown"),
    messages=messages,
)
content = (response.content or [{}])[0].get("text", "").strip()

# After
response = LLM_CLIENT.chat(messages=messages)
content = (response.get("content") or "").strip()
```

`chat()` 返回的是带 `"content"` 键的 dict（见 `src/llm.py:754-768`），而非 Anthropic SDK 风格的 `response.content[0].text`。

### 验证

- `python3 -m py_compile src/6.generate_docs.py` 通过
- `python3 -c "from llm import LLMClient; print('chat' in dir(LLMClient))"` → `True`
- 所有相关单测通过（366 个）

---

## Bug #2：精读区 md 源码直接展示（KaTeX 渲染时序）

### 核查结果

- **文件**：`app/docsify-plugin.js:894-903`、`index.html:60-61`
- **指南有偏差**：原指南称问题 hook 是 `afterEach`，实际代码已使用 `doneEach`（`app/docsify-plugin.js:3884`）。
- **真实根因**：KaTeX 脚本带 `defer` 属性，可能在 Docsify 首次 `doneEach` 触发时尚未加载完成。原 `renderMathInEl` 在 `window.renderMathInElement` 缺失时直接 `return`，导致首屏公式无法渲染。

### 修复

为 `renderMathInEl` 增加重试机制（最多 3 次，每次延迟 100ms），覆盖 KaTeX 脚本因 `defer` 而延迟加载的窗口期：

```javascript
// app/docsify-plugin.js
const renderMathInEl = (el, retriesLeft = 3) => {
  if (!el) return;
  if (!window.renderMathInElement) {
    if (retriesLeft > 0) {
      setTimeout(() => renderMathInEl(el, retriesLeft - 1), 100);
    }
    return;
  }
  window.renderMathInElement(el, {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '$', right: '$', display: false },
    ],
    throwOnError: false,
  });
};
```

### 验证

- 重试机制为纯前端逻辑，最大延迟 300ms，对正常情况无副作用
- 后续可通过浏览器手动验证：打开任意含 `$$...$$` 的精读页面，公式应正常渲染

---

## Bug #3：前端看不到 RSS 订阅指示

### 核查结果

- **文件**：`index.html`
- **现象**：`docs/feed.xml` 由 `src/6.generate_docs.py:2704` 的 `write_atom_feed` 生成，但 `index.html` 的 `<head>` 中没有 `<link rel="alternate" type="application/atom+xml">`。
- **影响**：浏览器扩展和 RSS 阅读器无法自动发现订阅源。

### 修复

```html
<!-- index.html，紧随网站图标 link 之后 -->
<link rel="alternate" type="application/atom+xml" title="Daily Paper Reader" href="docs/feed.xml">
```

### 验证

- 浏览器 DevTools 查看 `<head>` 应能看到上述 `<link>` 标签
- 部分 RSS 阅读器扩展会因此显示订阅按钮

---

## Bug #4：Seed Paper / Related Paper 点开 404

### 核查结果

- **文件**：`docs/seed-papers/*/index.md`（共 7 个文件）
- **现象**：现有 index.md 使用相对 `.md` 链接（如 `[Open seed paper](seed-paper.md)`），但 Docsify 的 `basePath: 'docs/'` 会把它解析为 `docs/seed-paper.md`（不存在）。
- **代码状态**：`src/seed_paper_processor.py:540-558` 已经在新代码中输出 hash 路由（`#/seed-papers/{id}/seed-paper`），但既有文件未跟随更新。

### 修复

使用 Python 脚本对所有 7 个 index.md 做正则替换：

| 旧链接 | 新链接 |
|--------|--------|
| `[Open seed paper](seed-paper.md)` | `[Open seed paper](#/seed-papers/{id}/seed-paper)` |
| `[Title](related/foo.md)` | `[Title](#/seed-papers/{id}/related/foo)` |

实际更新文件（共 7 个）：
- `docs/seed-papers/1776356624350/index.md`
- `docs/seed-papers/1776494644826/index.md`
- `docs/seed-papers/1776601904977/index.md`
- `docs/seed-papers/1776650081839/index.md`
- `docs/seed-papers/1776704802761/index.md`
- `docs/seed-papers/1776760574807/index.md`
- `docs/seed-papers/1776789841135/index.md`

### 验证

- `docs/seed-papers/1776789841135/index.md` 链接示例：
  ```
  - [Open seed paper](#/seed-papers/1776789841135/seed-paper)
  - [FAST: ...](#/seed-papers/1776789841135/related/2604.13453v1)
  ```
- 所有链接均使用 hash 路由，Docsify 不会把它当文件路径
- 后续新生成的 seed paper 会直接使用 `_build_index_content` 输出的正确格式

---

## Bug #5：seed-paper-publish Action 失败

### 核查结果

- **文件**：`.github/workflows/seed-paper-publish.yml:166-168`
- **现象**：原校验逻辑：
  ```python
  if "seed-paper.md" not in index_text or "related/" not in index_text:
      raise SystemExit("Trusted publish index is missing expected links")
  ```
  在 Bug #4 修复后，新格式的 index.md 不再含 `"seed-paper.md"` 字符串，触发 SystemExit。

### 修复

兼容新旧两种格式：

```python
index_text = index_path.read_text(encoding="utf-8")
# 兼容两种 index 链接格式：
# 1) 旧版相对链接：[Open seed paper](seed-paper.md) / (related/foo.md)
# 2) 新版 hash 路由：[Open seed paper](#/seed-papers/{id}/seed-paper) / (#/seed-papers/{id}/related/{slug})
has_seed_link = "seed-paper.md" in index_text or "/seed-paper)" in index_text
has_related_links = "](related/" in index_text or "/related/" in index_text
if not has_seed_link or not has_related_links:
    raise SystemExit("Trusted publish index is missing expected links")
```

### 验证

- 三组样本测试：
  | 输入 | 期望 | 实际 |
  |------|------|------|
  | 旧格式 | True | ✅ True |
  | 新格式 | True | ✅ True |
  | 无效格式 | False | ✅ False |

- `tests/test_seed_paper_workflow.py::SeedPaperWorkflowConfigTest` 31 个测试全部通过
- `assertIn('Trusted publish index is missing expected links', run_script)` 仍然命中（错误消息字符串保留）

---

## 修复涉及的文件清单

| 文件 | 涉及的 Bug | 变更类型 |
|------|-----------|----------|
| `src/6.generate_docs.py` | #1 | 代码修改 |
| `app/docsify-plugin.js` | #2 | 代码修改 |
| `index.html` | #3 | 新增 `<link>` 标签 |
| `docs/seed-papers/1776356624350/index.md` | #4 | 链接替换 |
| `docs/seed-papers/1776494644826/index.md` | #4 | 链接替换 |
| `docs/seed-papers/1776601904977/index.md` | #4 | 链接替换 |
| `docs/seed-papers/1776650081839/index.md` | #4 | 链接替换 |
| `docs/seed-papers/1776704802761/index.md` | #4 | 链接替换 |
| `docs/seed-papers/1776760574807/index.md` | #4 | 链接替换 |
| `docs/seed-papers/1776789841135/index.md` | #4 | 链接替换 |
| `.github/workflows/seed-paper-publish.yml` | #5 | 校验逻辑修改 |

---

## 全量测试结果

```
$ python3 -m unittest discover -s tests -p "test_*.py"
Ran 366 tests in 18.811s
OK
```

---

## 后续建议

1. **Bug #1**：建议增强 fallback 输出中文翻译，避免 LLM 不可用时退化为英文片段（指南中提到的可选改进）
2. **Bug #2**：可考虑在 `index.html` 中将 KaTeX 脚本改为非 `defer` 加载，从根本上消除时序问题（但会阻塞 HTML 解析，需权衡）
3. **Bug #4**：建议为 `_build_index_content` 增加单元测试，确保未来不会回归到相对链接格式
4. **Bug #5**：长期可考虑改用 Markdown AST 解析校验，而非字符串匹配
