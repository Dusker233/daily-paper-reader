# Bug 修复指南 Round 2 — 2026-04-25

>  reviewer 对线上修复效果的核查结果，以及第二轮修复指南。

---

## 核查结论

PR #21 修复的 5 个 bug 中，**#3 RSS feed link、#4 Seed paper hash 路由** 已正确部署到线上。但用户反馈仍有三个问题，经核查 root cause 如下：

| 用户反馈 | 真实 Root Cause | 状态 |
|---------|----------------|------|
| 主页上看不到 RSS 入口 | `<link rel="alternate">` 只在 `<head>` 中，没有可见 UI | 需第二轮修复 |
| 精读区 md 源码未渲染 | LLM 返回的 deep summary 被 ` ```markdown ` 代码块包裹，直接插入 markdown 文件 | 需第二轮修复 |
| seed paper 404 | 新 seed paper `1777113876678` 因 publish workflow 失败，从未推送到线上 | 需重新触发 workflow |

---

## Bug A：精读区 md 源码未渲染（真正 Root Cause）

### 问题描述

用户看到的不是 KaTeX 公式未渲染，而是**整个 deep summary 区块被 Docsify 当作代码块显示**。

例如：https://belanato2.com/#/202604/24/2604.20483v1-forecasting-individual-netflows-using-a-predictive-masked-graph-autoencoder

打开后"精读"区块显示为：

```markdown
## 1. TLDR
本文提出了一种结合图神经网络...

## 2. 核心故事与贡献
- **问题与动机**：...
```

所有 `##`、`-`、`**`、`| ` 等 markdown 语法都显示为原始文本，没有渲染成 HTML。

### Root Cause

`generate_deep_summary`（`src/6.generate_docs.py:867`）返回的内容被 LLM 包裹在 fenced code block 中：

```markdown
## 论文详细总结（自动生成）

```markdown
## 1. TLDR
...
## 2. 核心故事与贡献
...
```
```

`upsert_auto_block` 直接把这块内容原样写入 markdown 文件。Docsify 的 marked 渲染器看到外层的 ` ```markdown `，就把整个区块当作代码块处理，内部的 markdown 语法不会被解析。

**注意：这不是 PR #21 修复的 KaTeX race condition 问题。** KaTeX retry 修复针对的是 `$$...$$` 公式渲染，与当前问题无关。

### 修复步骤

#### 方案：在内容插入前 strip markdown fence

**文件：** `src/6.generate_docs.py`

**步骤 A.1：** 在 `generate_deep_summary` 函数末尾（约第 900 行，return 之前），添加 fence stripping：

```python
def _strip_markdown_fence(text: str) -> str:
    """Remove ```markdown ... ``` wrapper if present."""
    text = text.strip()
    # Strip opening fence: ```markdown or ```
    if text.startswith("```markdown"):
        text = text[len("```markdown"):].lstrip("\n")
    elif text.startswith("```"):
        first_newline = text.find("\n")
        if first_newline != -1:
            text = text[first_newline + 1:]
    # Strip closing fence
    if text.rstrip().endswith("```"):
        text = text.rstrip()[:-3].rstrip()
    return text.strip()
```

**步骤 A.2：** 在 `generate_deep_summary` 的返回值路径上应用 stripping：

找到约第 867-900 行的逻辑：

```python
# Before (current code)
if "（完）" in summary:
    return summary
# ...
if "（完）" in merged:
    return merged
# ...
return _build_deep_summary_fallback(title, abstract_en, source_text)
```

改为：

```python
# After
if "（完）" in summary:
    return _strip_markdown_fence(summary)
# ...
if "（完）" in merged:
    return _strip_markdown_fence(merged)
# ...
return _strip_markdown_fence(_build_deep_summary_fallback(title, abstract_en, source_text))
```

**步骤 A.3：** 在 `upsert_auto_block` 中也添加通用保护（防御性编程）：

找到 `src/6.generate_docs.py:625-632`：

```python
# Before
def upsert_auto_block(md_path: str, heading: str, content: str) -> None:
    clean_content = _normalize_text(content)
    if not clean_content:
        return
    block = f"\n\n---\n\n{key}\n\n{content}".rstrip() + "\n"
```

改为：

```python
# After
def upsert_auto_block(md_path: str, heading: str, content: str) -> None:
    clean_content = _strip_markdown_fence(_normalize_text(content))
    if not clean_content:
        return
    block = f"\n\n---\n\n{key}\n\n{clean_content}".rstrip() + "\n"
```

### 验证方法

1. 找一份已有的、包含 deep summary 的 markdown 文件（如 `docs/202604/24/2604.20483v1-*.md`）
2. 手动删除其中的 ` ```markdown ` 和结尾的 ` ``` `
3. 本地用 Docsify 预览，确认"精读"区块正常渲染为 HTML
4. 运行 `python3 -m unittest discover -s tests`，确保测试通过

---

## Bug B：RSS 入口不可见

### 问题描述

`<link rel="alternate" type="application/atom+xml">` 已添加到 `index.html` 的 `<head>` 中，但页面上没有任何可见的 RSS 订阅按钮或链接。普通用户无法发现 feed 的存在。

### 修复步骤

#### 方案：在 sidebar 底部添加可见的 RSS 链接

**文件：** `docs/_sidebar.md`

**步骤 B.1：** 在 sidebar 文件末尾（或合适位置）添加：

```markdown
---

* [RSS 订阅](/feed.xml)
```

或者，如果希望更醒目，可以加一个图标：

```markdown
---

* [RSS 订阅 feed.xml](/feed.xml)
```

**文件：** `index.html`（可选，如果希望在页面顶部也显示）

**步骤 B.2（可选）：** 在 `index.html` 的 `<body>` 内、sidebar 区域外添加一个 RSS 订阅按钮。但这需要改前端 JS，复杂度较高。建议先用 sidebar 方案。

### 验证方法

1. 本地打开 `index.html`
2. 展开 sidebar，确认底部有 "RSS 订阅" 链接
3. 点击链接，确认能打开 `docs/feed.xml`

---

## Bug C：seed paper 1777113876678 404

### 问题描述

新的 seed paper request `1777113876678` 在 `seed-paper-related` workflow 中成功生成了文档，但 `seed-paper-publish` workflow 因旧的验证逻辑（检查 `"seed-paper.md"` 字符串）而失败，导致文档从未推送到线上。

PR #21 已修复 publish 的验证逻辑，但这个 seed paper 是在修复**之前**触发的，需要重新处理。

### 修复步骤

#### 方案：重新触发 seed-paper-related workflow

**步骤 C.1：** 在 GitHub Actions 页面手动触发 `seed-paper-related` workflow：
- 进入仓库 → Actions → `seed-paper-related`
- 点击 "Run workflow"
- 参数：
  - `request_id`: `1777113876678`
  - `request_path`: `archive/seed-papers/1777113876678/request.json`
  - `seed_mode`: `both`（或根据 request.json 中的实际 mode）

**步骤 C.2：** 等待 `seed-paper-related` 成功完成后，确认下游的 `seed-paper-publish` 自动触发并也成功完成。

**步骤 C.3：** 验证线上文件存在：
```bash
curl -sL "https://dusker233.github.io/daily-paper-reader/docs/seed-papers/1777113876678/index.md" | head -5
```

应返回 markdown 内容而非 404。

---

## 修复优先级

| 优先级 | Bug | 原因 |
|--------|-----|------|
| P0 | Bug A（精读未渲染） | 影响所有已有论文的阅读体验，最直观的问题 |
| P1 | Bug C（seed paper 404） | 阻断新 seed paper 的访问 |
| P2 | Bug B（RSS 不可见） | 功能缺失，不影响核心使用 |

---

## 相关文件

| 文件 | 涉及的 Bug | 变更类型 |
|------|-----------|----------|
| `src/6.generate_docs.py` | Bug A | 新增 `_strip_markdown_fence`，修改 `generate_deep_summary` 和 `upsert_auto_block` |
| `docs/_sidebar.md` | Bug B | 新增 RSS 订阅链接 |
| `seed-paper-related` workflow | Bug C | 手动重新触发 |
