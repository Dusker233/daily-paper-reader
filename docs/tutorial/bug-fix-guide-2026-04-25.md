# Bug 修复指南 — 2026-04-25

> 本指南由 reviewer 编写，供 implementer 按步骤修复 5 个已确认的 bug。
> 每个 bug 包含：问题描述 → Root Cause → 修复步骤 → 验证方法。

---

## Bug #1：略读总结截断 + 英文输出

### 问题描述
不论是精读区还是略读区，前面的略读总结内容明显被截断不完整，且内容为英文，无法正常阅读。

### Root Cause
**两个叠加问题：**

1. **LLM 调用方法不存在**（`src/6.generate_docs.py:1111`）
   - 代码调用 `LLM_CLIENT.messages_create(...)`，但 `LLMClient` / `BltClient` 类中**没有任何 `messages_create` 方法**。
   - 可用的方法只有 `.chat()` 和 `.chat_structured()`。
   - 结果：每次调用都抛出 `AttributeError`，被 `except Exception` 捕获后进入 fallback。
   - **这意味着 LLM 从未被真正调用过，100% 走 fallback。**

2. **Fallback 函数提取英文片段**（`src/6.generate_docs.py:1001-1065`）
   - `_build_skim_body_fallback` 使用正则从英文 abstract 中提取句子：
     ```python
     r"(we (?:propose|present|introduce|develop|describe)[^.]{0,200})[。.]?"
     r"(experiments?|results?|show|demonstrate|achieve)[^.]{0,200}?..."
     ```
   - `{0,200}` 和 `{0,150}` 的字符限制导致提取内容被截断。
   - 提取的是英文原文，没有翻译为中文。

### 修复步骤

#### 步骤 1.1：修复 LLM 调用方法

文件：`src/6.generate_docs.py`，约第 1109-1122 行

**当前代码（错误）：**
```python
response = LLM_CLIENT.messages_create(
    model=(LLM_CLIENT.model or "unknown"),
    messages=messages,
)
content = (response.content or [{}])[0].get("text", "").strip()
```

**修改为：**
```python
response = LLM_CLIENT.chat(messages=messages)
content = response.get("content", "").strip()
```

> `LLM_CLIENT.chat()` 返回的是一个 dict，字段为 `"content"`、`"raw_content"`、`"reasoning_content"` 等（见 `src/llm.py:754-768`）。

#### 步骤 1.2：（可选改进）增强 fallback 中文提取

如果希望 fallback 也尽量输出中文，可在 `_build_skim_body_fallback` 中：
- 将英文正则替换为更积极的中文正则匹配
- 或当匹配到英文时，增加中文翻译占位提示

但这属于体验优化，核心修复是步骤 1.1。

### 验证方法
1. 运行测试 `tests/` 中与 `generate_skim_body` 相关的测试
2. 手动执行 `python -c "from src.llm import LLM_CLIENT; print(hasattr(LLM_CLIENT, 'chat'))"` 确认 `.chat()` 存在
3. 触发一次 daily pipeline 或本地调用 `generate_skim_body`，检查日志中不再有 `AttributeError`

---

## Bug #2：精读区 md 源码直接展示

### 问题描述
精读区的论文详细总结直接将 md 源码展示出来了，没有被渲染。

### Root Cause
**KaTeX 公式渲染存在 race condition。**

精读总结中频繁出现 `$$[文中未明确说明公式]$$` 这样的 LaTeX 公式占位符（由 `_build_deep_summary_fallback` 生成，见 `src/6.generate_docs.py:768` 附近）。

`app/docsify-plugin.js:3917-3920` 在 `afterEach` hook 中调用 `renderMathInEl` 来渲染 KaTeX：
```javascript
if (mainContent) {
  const root = isPaperPage ? ensurePageContentRoot() : null;
  renderMathInEl(root || mainContent);
}
```

问题：
- `afterEach` 在 Docsify 完成内容替换后触发，但**此时 KaTeX 的 `auto-render.min.js` 可能尚未加载完成**（脚本带 `defer` 属性，见 `index.html:58-61`）。
- 或者 `root || mainContent` 选择的目标元素不包含新渲染的内容。
- 结果：`$$...$$` 公式标记保持原始文本显示，用户看到"源码"。

另外，`renderMarkdownWithTables` 函数（仅用于聊天讨论区）会保护 LaTeX 公式，但**主页面渲染没有这种保护**，导致 `marked.parse()` 可能错误处理 `$` 字符。

### 修复步骤

#### 步骤 2.1：确保 KaTeX 在内容稳定后渲染

文件：`app/docsify-plugin.js`

找到当前的 `renderMathInEl` 调用位置（约第 3917-3920 行），修改为同时注册 `doneEach` hook：

```javascript
// 在 plugins 函数中，现有的 hook.afterEach 代码附近添加：
hook.doneEach(function() {
  // doneEach 在 DOM 完全更新后触发，比 afterEach 更可靠
  setTimeout(function() {
    const mainContent = document.querySelector('.markdown-section');
    if (mainContent) {
      renderMathInEl(mainContent);
    }
  }, 50); // 短暂延迟确保 KaTeX 库已加载
});
```

> 保留原有的 `afterEach` 调用作为第一层保障，`doneEach` + `setTimeout` 作为第二层保障。

#### 步骤 2.2：（可选）减少公式占位符的突兀感

文件：`src/6.generate_docs.py`

在 `_build_deep_summary_fallback` 中，将 `$$[文中未明确说明公式]$$` 替换为更友好的纯文本描述，例如：
```python
# 原代码（约第 768 行附近）
# 修改为不生成 $$ 占位符，而是生成普通文本
```

但这只是改善体验，不是根因修复。

### 验证方法
1. 本地打开 `index.html`，导航到任意包含 `$$...$$` 的 seed paper 页面
2. 检查浏览器 DevTools Console 是否有 `renderMathInElement is not defined` 错误
3. 确认公式被正确渲染为 KaTeX 输出，或至少 `$` 标记不再显示

---

## Bug #3：前端看不到 RSS 订阅指示

### 问题描述
前端页面没有 RSS/Atom 订阅入口或指示。

### Root Cause
后端正确生成了 `docs/feed.xml`（由 `src/6.generate_docs.py:2707-2713` 的 `write_atom_feed` 函数生成），但前端从未引用它：

- `index.html` 的 `<head>` 中没有 `<link rel="alternate" type="application/atom+xml">` 标签
- 前端 JS/CSS 中没有任何 RSS/Feed 相关的 UI 元素

### 修复步骤

#### 步骤 3.1：在 HTML head 中添加 Atom feed link

文件：`index.html`

在 `<head>` 中找到现有的 `<link>` 标签（约第 20-21 行），在其后添加：

```html
<link rel="alternate" type="application/atom+xml" title="Daily Paper Reader" href="docs/feed.xml">
```

### 验证方法
1. 用浏览器打开页面，查看 `<head>` 中是否出现了上述 `<link>` 标签
2. 点击/访问 `docs/feed.xml` 确认文件存在且内容有效
3. 使用 RSS 阅读器验证可以订阅

---

## Bug #4：Seed Paper / Related Paper 点开之后 404

### 问题描述
Seed paper 和 related paper 的链接点开后显示 404 页面。

### Root Cause
**两个层面的问题：**

1. **已生成的旧文件使用相对链接**
   - `docs/seed-papers/1776789841135/index.md` 中的链接：
     ```markdown
     - [Open seed paper](seed-paper.md)
     - [FAST: ...](related/2604.13453v1.md)
     ```
   - 这些链接是**相对 Markdown 链接**（`.md` 后缀）。
   - Docsify 配置中 `basePath: 'docs/'`，但**没有启用 `relativePath: true`**。
   - 结果：Docsify 将 `seed-paper.md` 解析为 `docs/seed-paper.md`（不存在），而不是 `docs/seed-papers/{id}/seed-paper.md`。

2. **代码已修复但文件未更新**
   - `src/seed_paper_processor.py:541-544` 和 `:558` 已经将链接改为 hash 路由格式：
     ```python
     f"- [Open seed paper](#/seed-papers/{request_id}/seed-paper)"
     page_path = f"#/seed-papers/{request_id}/related/{slug}"
     ```
   - 但现有的 `docs/seed-papers/*/index.md` 文件是**旧代码生成的**，链接格式未更新。

### 修复步骤

#### 步骤 4.1：更新所有已生成的 seed paper index.md

遍历 `docs/seed-papers/*/index.md`，将相对链接替换为 hash 路由：

```bash
# 示例：对 request_id = 1776789841135 的修复
# 旧链接：
#   [Open seed paper](seed-paper.md)
#   [Title](related/xxx.md)
# 新链接：
#   [Open seed paper](#/seed-papers/1776789841135/seed-paper)
#   [Title](#/seed-papers/1776789841135/related/xxx)
```

可以写一个 Python 脚本批量处理所有 `docs/seed-papers/*/index.md`：

```python
import re
from pathlib import Path

for index_path in sorted(Path("docs/seed-papers").glob("*/index.md")):
    request_id = index_path.parent.name
    text = index_path.read_text(encoding="utf-8")

    # Fix seed paper link
    text = re.sub(
        r"\[Open seed paper\]\(seed-paper\.md\)",
        f"[Open seed paper](#/seed-papers/{request_id}/seed-paper)",
        text,
    )

    # Fix related links
    text = re.sub(
        rf"\[([^\]]+)\]\(related/([^)]+)\.md\)",
        rf"[\1](#/seed-papers/{request_id}/related/\2)",
        text,
    )

    index_path.write_text(text, encoding="utf-8")
    print(f"Updated: {index_path}")
```

#### 步骤 4.2：（长期方案）保持代码与生成文件一致

确认 `src/seed_paper_processor.py` 中的 `_build_index_content` 已经输出 hash 路由（当前代码已经是正确的），之后新创建的 seed paper 不会再出现此问题。

### 验证方法
1. 本地打开 `index.html`，从 sidebar 进入 seed paper index 页面
2. 点击 "Open seed paper" 链接，确认能正常显示 seed-paper.md 内容
3. 点击 related paper 链接，确认能正常显示对应的 related/*.md 内容

---

## Bug #5：seed-paper-publish Action 失败

### 问题描述
`seed-paper-publish` workflow 在 `main` 分支上失败。

### Root Cause
验证脚本与新的 index 格式不兼容。

`.github/workflows/seed-paper-publish.yml:166-168`：
```python
index_text = index_path.read_text(encoding="utf-8")
if "seed-paper.md" not in index_text or "related/" not in index_text:
    raise SystemExit("Trusted publish index is missing expected links")
```

由于 `_build_index_content` 已改为输出 hash 路由（如 `#/seed-papers/{id}/seed-paper` 和 `#/seed-papers/{id}/related/{slug}`），index.md 中不再包含字符串 `"seed-paper.md"` 和 `"related/"`，导致验证失败。

### 修复步骤

#### 步骤 5.1：更新验证逻辑

文件：`.github/workflows/seed-paper-publish.yml`，第 166-168 行

**当前代码（错误）：**
```python
index_text = index_path.read_text(encoding="utf-8")
if "seed-paper.md" not in index_text or "related/" not in index_text:
    raise SystemExit("Trusted publish index is missing expected links")
```

**修改为：**
```python
index_text = index_path.read_text(encoding="utf-8")
# 兼容旧格式（相对 .md 链接）和新格式（hash 路由）
has_seed_link = "seed-paper" in index_text or "seed-paper.md" in index_text
has_related_links = "related/" in index_text or "#/seed-papers/" in index_text
if not has_seed_link or not has_related_links:
    raise SystemExit("Trusted publish index is missing expected links")
```

### 验证方法
1. 在本地或 PR 中修改 workflow 文件
2. 触发一次 `seed-paper-related` workflow（手动运行）
3. 确认下游的 `seed-paper-publish` 能够成功执行
4. 检查 publish 后的 commit 是否包含正确的 seed paper 文档

---

## 修复优先级建议

| 优先级 | Bug | 原因 |
|--------|-----|------|
| P0 | #1 | 影响所有新论文的略读总结质量，100% fallback |
| P0 | #5 | 阻断 seed paper 发布流程 |
| P1 | #4 | 影响现有 seed paper 的可访问性 |
| P1 | #2 | 影响精读区阅读体验 |
| P2 | #3 | 功能缺失，不影响核心使用 |

---

## 相关文件清单

| 文件 | 涉及的 Bug |
|------|-----------|
| `src/6.generate_docs.py` | #1, #2 |
| `app/docsify-plugin.js` | #2 |
| `index.html` | #3 |
| `docs/seed-papers/*/index.md` | #4 |
| `src/seed_paper_processor.py` | #4（代码已正确） |
| `.github/workflows/seed-paper-publish.yml` | #5 |
