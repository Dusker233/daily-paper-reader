# Bug 修复指南 Round 3 — 2026-04-25

> reviewer 对当前线上剩余问题的核查结果，以及第三轮修复建议。

---

## 核查结论

之前的 **seed paper / related paper 打开 404** 这一类问题，已经基本修好：

- 线上 `docs/seed-papers/1777113876678/index.md` 可访问；
- 该 index 内部链接已经是 hash route：`#/seed-papers/1777113876678/seed-paper`、`#/seed-papers/1777113876678/related/...`；
- 点击 seed paper / related paper 不再是旧的相对 `.md` 路径问题。

但当前线上仍有 4 个**真实剩余问题**：

| 用户看到的问题 | 真实 Root Cause | 现状 |
|---|---|---|
| RSS 入口点进去是 404.md | sidebar 使用了 `href="docs/feed.xml"`，被 Docsify/basePath 体系错误处理 | 未修复 |
| feed.xml 打开后内部 URL 仍是错的 | feed 生成代码仍写出 `https://daily-paper-reader.example.com/...` 占位域名 | 未修复 |
| 点击 sidebar 的 Seed Papers 条目直接报错，打不开 | seed navigation 生成的是 markdown hash link，Docsify 把 `#/seed-papers/...` 当 selector 处理并在 `querySelector` 处抛错 | 未修复 |
| seed paper 首页没有 seed/related evidence，缺少类似日报首页的内容 | seed index 只渲染链接；seed page front matter 未注入 glance 字段；前端也未把 `seed-papers/...` 当成 paper page | 未修复 |

---

## Bug A：RSS 可见入口存在，但点击后进入 404.md

### 问题描述

当前 sidebar 已经有可见的 RSS 链接，但点击后并不会直接打开 feed.xml，而是落入 Docsify 的 404 页面。

### 直接证据

`docs/_sidebar.md:3`

```html
<a class="dpr-sidebar-root-link" href="docs/feed.xml" target="_blank" rel="noopener">RSS 订阅</a>
```

同时前端启用了：

- `app/docsify-plugin.js:6` `basePath: 'docs/'`
- Docsify SPA 路由接管页面内容加载

因此 `docs/feed.xml` 这种相对写法，在当前站点上下文里不是一个稳定的“站外静态资源直链”。

### Root Cause

这里的问题不是 feed.xml 文件不存在，而是 **sidebar 链接写法不对**。

`docs/_sidebar.md` 是被 Docsify 作为文档内容渲染的，`href="docs/feed.xml"` 在当前站点里会落入 Docsify/basePath 的解析路径，最终被当成站内文档路由或错误路径处理，导致用户看到的是 404.md。

### 修复步骤

#### 方案：sidebar 中使用绝对 feed URL，不要使用相对 `docs/feed.xml`

**文件：** `docs/_sidebar.md`

把当前：

```html
<a class="dpr-sidebar-root-link" href="docs/feed.xml" target="_blank" rel="noopener">RSS 订阅</a>
```

改成当前站点的绝对 feed 地址，例如：

```html
<a class="dpr-sidebar-root-link" href="https://dusker233.github.io/daily-paper-reader/docs/feed.xml" target="_blank" rel="noopener">RSS 订阅</a>
```

如果后续希望避免硬编码站点地址，建议不要把这个链接静态写死在 markdown 里，而是在生成 sidebar 时基于 `SITE_URL` / `DPR_SITE_URL` 注入。

### 验证方法

1. 本地或线上打开主页 sidebar；
2. 点击 `RSS 订阅`；
3. 应直接打开 XML，而不是 Docsify 的 404 页面；
4. 地址栏应落到真实 feed 路径，而不是 `#/404` 之类的 SPA 路由。

---

## Bug B：feed.xml 本身可访问，但内部链接仍然使用 placeholder 域名

### 问题描述

即使直接打开 `docs/feed.xml`，feed 内部的 `self` 链接和 entry 链接仍然指向错误域名 `https://daily-paper-reader.example.com/...`。

这意味着：

- RSS 订阅器里看到的链接是错的；
- 即使用户成功订阅，点开条目也会跳到错误站点；
- 这是一个**功能表面可见但实际不可用**的问题。

### 直接证据

当前 `docs/feed.xml:5-12`：

```xml
<link href="https://daily-paper-reader.example.com/feed.xml" rel="self"/>
<link href="https://daily-paper-reader.example.com/"/>
...
<link href="https://daily-paper-reader.example.com/#/202604/24/README"/>
```

生成代码里也还能看到 placeholder fallback：

- `src/6.generate_docs.py:2632-2636`
- `src/6.generate_docs.py:2701-2702`
- `src/6.generate_docs.py:3515`

其中：

```python
site_url = str(site_url or "").strip().rstrip("/")
if not site_url:
    site_url = "https://daily-paper-reader.example.com"
```

以及：

```python
site_url = os.getenv("DPR_SITE_URL", "").strip() or "https://daily-paper-reader.example.com"
```

### Root Cause

feed 生成链路仍然允许退回到 placeholder 域名；而当前线上发布出来的 feed，实际就是按这个 placeholder 写出的。

另外，workflow 里其实已经给了正确的 Pages URL fallback：

`.github/workflows/daily-paper-reader.yml:57`

```yaml
DPR_SITE_URL: ${{ vars.SITE_URL || format('https://{0}.github.io/{1}', github.repository_owner, github.event.repository.name) }}
```

所以代码层和 workflow 层现在是**不一致**的。

### 修复步骤

#### 方案：统一 feed 生成逻辑，彻底移除 placeholder fallback

**文件：** `src/6.generate_docs.py`

把两处 placeholder fallback 都改掉：

1. `build_atom_feed_content(...)` 中的 fallback
2. 主生成流程里 `site_url = os.getenv(...) or ...` 的 fallback

建议统一成与 workflow 同一来源的真实站点 URL；至少要保证 fallback 也是当前 repo 的 Pages URL，而不是 `.example.com`。

### 最小修复目标

- `feed.xml` 的 `<link rel="self">` 正确；
- `<feed>` 根链接正确；
- 每个 `<entry><link .../></entry>` 正确；
- 不再出现 `daily-paper-reader.example.com`。

### 建议补充测试

**文件：** `tests/*`

新增针对 Atom feed 的 targeted test，至少断言：

- `example.com` 不会出现在输出中；
- `#/YYYYMM/DD/README` 这类 entry link 使用真实 site_url；
- `self` link 与传入的 site_url 一致。

### 验证方法

1. 重新生成 `docs/feed.xml`；
2. 检查开头几行，不应再出现 `daily-paper-reader.example.com`；
3. 抽查 2 个 entry 链接，应指向真实站点；
4. 浏览器直接打开 feed.xml，确认链接可点开且能回到当前站点页面。

---

## Bug C：点击 sidebar 的 Seed Papers 条目时报 `querySelector` selector 语法错误

### 问题描述

当前不是 seed paper 文件不存在，而是**点击 sidebar 里的 Seed Papers 条目时，前端直接抛异常**：

```text
docsify.min.js:1 Uncaught SyntaxError: Failed to execute 'querySelector' on 'Document': '#/seed-papers/1777113876678/index' is not a valid selector.
```

所以用户看到的是“点不开”，但本质上是前端路由点击链路被错误输入打崩了。

### 直接证据

当前 sidebar 里的 seed 入口是普通 markdown 链接：

`docs/_sidebar.md:319-321`

```markdown
<!--dpr-seed-papers:start-->
* Seed Papers
  * [Wan et al.   2025   CATO End to end optimization of ML based traffic analysis pipelines](#/seed-papers/1777113876678/index)
<!--dpr-seed-papers:end-->
```

这个 block 来自：

`src/seed_paper_processor.py:625-649`

```python
sidebar_block = "\n".join(
    [
        SEED_NAV_START,
        "* Seed Papers",
        f"  * [{clean_title}](#/seed-papers/{clean_request_id}/index)",
        SEED_NAV_END,
    ]
)
```

而站内另一个“非正常 markdown 链接”的例子，是教程入口，它已经改成了虚拟 hash link：

`docs/_sidebar.md:2`

```html
<a class="dpr-sidebar-root-link dpr-sidebar-noactive-link" href="javascript:void(0)" data-dpr-hash="#/tutorial/README">使用教程</a>
```

并由前端专门接管：

`app/docsify-plugin.js:2501-2513`

```javascript
const links = nav.querySelectorAll('a[data-dpr-hash]');
...
const target = normalizeHref(a.getAttribute('data-dpr-hash') || '');
window.location.hash = target;
```

### Root Cause

seed navigation 当前写成了普通 markdown hash 链接 `(#/seed-papers/...)`。这条路径在 Docsify 当前运行链路里，没有走项目里已经写好的 `data-dpr-hash` 接管逻辑，而是落回 Docsify 默认处理。

Docsify 默认链路会把 hash route 当作 selector / anchor 去查 DOM，因此对 `#/seed-papers/1777113876678/index` 这种字符串执行了 `querySelector(...)`，最终抛出：

```text
'#/seed-papers/1777113876678/index' is not a valid selector
```

也就是说，**问题不在 seed page 内容生成，而在 sidebar 入口的链接形态不兼容当前 Docsify 路由处理方式**。

### 修复步骤

#### 方案：Seed Papers sidebar 入口不要再用 markdown hash link，改成虚拟 hash link

**文件：** `src/seed_paper_processor.py`

把当前 sidebar block：

```python
sidebar_block = "\n".join(
    [
        SEED_NAV_START,
        "* Seed Papers",
        f"  * [{clean_title}](#/seed-papers/{clean_request_id}/index)",
        SEED_NAV_END,
    ]
)
```

改成与“使用教程”同类的 HTML 写法，例如：

```python
sidebar_block = "\n".join(
    [
        SEED_NAV_START,
        "* Seed Papers",
        f'  * <a class="dpr-sidebar-root-link dpr-sidebar-noactive-link" href="javascript:void(0)" data-dpr-hash="#/seed-papers/{clean_request_id}/index">{clean_title}</a>',
        SEED_NAV_END,
    ]
)
```

这样它会自动复用现有的：

- `neutralizeSidebarNoactiveLinks()`
- `bindSidebarVirtualHashLinks()`

不再走 Docsify 的默认 selector/anchor 路径。

### 为什么推荐这样修

因为这不是单个页面的 bug，而是 **Seed Papers 导航入口的生成模板**有问题。直接改 `docs/_sidebar.md` 只能修当前这一条，下一次 workflow 更新 sidebar 时还会重新生成错误格式。

所以应该在 `src/seed_paper_processor.py:update_seed_navigation()` 这一层修模板。

### 验证方法

1. 重新生成/更新 sidebar；
2. 打开主页；
3. 点击 `Seed Papers` 下的条目；
4. 应正常跳转到 `#/seed-papers/<id>/index`；
5. Console 不应再出现：

```text
Failed to execute 'querySelector' on 'Document': '#/seed-papers/...' is not a valid selector
```

---

## Bug D：seed paper 首页缺少 seed / related evidence，体验不像日报首页

### 问题描述

用户当前看到的 seed paper 首页（例如 `#/seed-papers/1777113876678/index`）只有：

- Request ID
- Mode
- Related count
- 一个 `Open seed paper` 链接
- 若干 related paper 链接

没有类似日报首页那种“可直接读的证据/摘要/导读”内容。

### 直接证据

线上 `docs/seed-papers/1777113876678/index.md` 当前内容只有：

```markdown
# Wan et al.   2025   CATO End to end optimization of ML based traffic analysis pipelines

- Request ID: `1777113876678`
- Mode: `both`
- Related count: `5`

## Seed paper
- [Open seed paper](#/seed-papers/1777113876678/seed-paper)

## Related papers
- [FedLLM: ...](#/seed-papers/1777113876678/related/...)
- [Quantifying data reuse ...](#/seed-papers/1777113876678/related/...)
- ...
```

对应生成逻辑也确实只输出这些内容：

`src/seed_paper_processor.py:533-564`

```python
def _build_index_content(request: dict[str, Any], related_pages: list[dict[str, str]]) -> str:
    ...
    return "\n".join([
        f"# {_escape_markdown_text(title)}",
        ...
        "## Seed paper",
        f"- [Open seed paper](#/seed-papers/{request_id}/seed-paper)",
        "",
        "## Related papers",
        related_block,
    ])
```

### Root Cause 1：seed index 本身只渲染“链接页”，没有摘要/evidence 区

`_build_index_content(...)` 现在只是一个 link hub，不是一个“日报式 landing page”。

而且 related evidence 目前取的是 selection 阶段的原始字段：

`src/seed_paper_processor.py:537-547`

```python
score_str = f" [{page.get('score', '-')}]" if page.get('score') else ""
evidence_str = f" - {_escape_markdown_text(page.get('evidence', ''))}" if page.get('evidence') else ""
```

很多请求在 recall/ranking 阶段并没有现成 `evidence`，所以 index 页自然什么都显示不出来。

### Root Cause 2：seed-paper.md 自己的 front matter 也没有被补齐

线上 `docs/seed-papers/1777113876678/seed-paper.md` front matter 只有：

```yaml
---
title: ...
title_zh: ...
authors: Unknown
date: Unknown
pdf: ...
tags: [LLM, Deep Learning]
---
```

没有：

- `evidence`
- `tldr`
- `motivation`
- `method`
- `result`
- `conclusion`
- `key_findings`
- `limitations`

而 `src/seed_paper_processor.py:311-351` 的 `_render_seed_page(...)` 当前流程是：

1. 先 `build_markdown_content(...)` 写出 seed-paper.md；
2. 然后才生成 glance；
3. 再把 glance 作为 `## 速览` block 追加进去；
4. 但**没有**像 related page 一样把 glance 结果同步回 front matter。

### Root Cause 3：前端没有把 `seed-papers/...` 识别成 paper page

即使 front matter 里真的有 `evidence` / `tldr` / `method` 等字段，前端当前也未必会显示，因为 paper-page 渲染入口只匹配日期路由。

`app/docsify-plugin.js:2519-2521`

```javascript
const isPaperRouteFile = (file) => {
  const f = String(file || '');
  return /^(?:\d{6}\/\d{2}|\d{8}-\d{8})\/(?!README\.md$).+\.md$/i.test(f);
};
```

这会排除：

- `seed-papers/<id>/seed-paper.md`
- `seed-papers/<id>/related/*.md`

而 `renderPaperFromMeta(meta)` 的注入是在 `beforeEach` 里走 `isPaperRouteFile(file)` 的：

- `app/docsify-plugin.js:3856-3871`

所以 seed paper / related paper 当前绕开了增强版 top-meta 渲染路径。

---

## Bug C 的修复步骤

### 步骤 C.1：让 seed page 先拿到 glance 字段，再写 markdown

**文件：** `src/seed_paper_processor.py`

在 `_render_seed_page(...)` 中，不要先写 markdown 再补 `## 速览`。

建议改成和 daily paper 更接近的顺序：

1. 先生成 glance；
2. `paper["_glance_overview"] = glance`；
3. 再调用 `build_markdown_content(...)`；
4. 这样 `build_markdown_content(...)` 会直接把 `evidence / tldr / motivation / method / result / conclusion / key_findings / limitations` 写进 front matter；
5. 然后再补 `## 精读` block。

如果不想调整顺序，至少也要在 seed page 上补一个“全量 front matter 同步”逻辑，而不是只补 block。

### 步骤 C.2：不要只同步 `evidence/tldr`，要同步整套 glance 字段

当前 related page 只做了 `_upsert_frontmatter_evidence(...)`，它只回填：

- `evidence`
- `tldr`

这对于 seed page 也不够。

如果目标是让 seed paper 页面具有和普通 paper 页类似的顶部信息区，建议新增一个更通用的 front matter 回填逻辑，把 `parse_glance_overview_fields(...)` 解析出的字段整体写回去。

### 步骤 C.3：扩展前端 paper route 匹配，让 seed paper / related 走同一套 meta 渲染

**文件：** `app/docsify-plugin.js`

至少需要把以下逻辑扩展到支持 `seed-papers/...`：

- `isPaperRouteFile(...)`
- `isPaperHref(...)`
- 如有必要，相关的 active-state / navigation helper

目标是让下面这些页面也进入 `renderPaperFromMeta(meta)` 的渲染路径：

- `seed-papers/<id>/seed-paper.md`
- `seed-papers/<id>/related/<slug>.md`

### 步骤 C.4：seed index 页不要只放链接，要显示 seed summary + related evidence

**文件：** `src/seed_paper_processor.py`

修改 `_build_index_content(...)` 的输入和输出。

建议：

#### 4.1 seed paper 部分

除了 `Open seed paper` 链接，再加一段来自 seed glance 的结构化内容，至少包含：

- TLDR
- Evidence
- 若有则附上 Method / Result / Conclusion

#### 4.2 related papers 部分

不要只依赖 selection 阶段原始 `record['evidence']`。

更稳的方式是：

- 在 `_render_related_pages(...)` 生成每个 related page 的 glance 后，解析出 `tldr/evidence`；
- 把这些字段写入 `written.append({...})`；
- `_build_index_content(...)` 用这些“生成后”的 evidence/tldr 渲染 index。

这样即使 recall/ranking 阶段没有原始 evidence，最终 landing page 仍然有可读内容。

---

## 修复优先级

| 优先级 | Bug | 原因 |
|---|---|---|
| P0 | Bug A：RSS 链接点开是 404 | 用户已经看到入口，但功能不可用 |
| P0 | Bug B：feed.xml 内部 URL 错误 | 即使订阅成功，entry 链接也全是错的 |
| P0 | Bug C：Seed Papers sidebar 条目点击即报错 | 当前入口直接不可用，阻断 seed 页面访问 |
| P0 | Bug D：seed index 缺少可读内容 | 用户进入 seed 入口后的第一页几乎没有阅读价值 |
| P1 | Bug D：seed paper / related page 不走 paper meta 渲染 | 影响页面完整体验，但优先级略低于 landing page 无内容 |

---

## 结论

这轮核查后，可以明确区分两个结论：

1. **之前的 seed paper 内容发布 / hash route 404 bug 已经修好。** 现在不是旧的 `.md` 相对路径 404。
2. 但当前又暴露出一个新的 seed 入口问题：**sidebar 的 Seed Papers 导航模板不兼容当前 Docsify 路由处理，点击会直接触发 `querySelector` selector 异常。**
3. 当前真正剩下的是四个体验层面的 bug：
   - RSS 入口 URL 写法不对；
   - feed.xml 内部 URL 仍然错误；
   - Seed Papers sidebar 条目点击即报错；
   - seed landing / seed page 没有接上日报/论文页那套 evidence + meta 渲染链路。

implementer 这一轮不要再围绕旧的“seed 404”修，而应转向修：

- feed URL 正确性；
- Seed Papers sidebar 导航模板；
- seed 页面内容完整性；
- seed 路由与普通 paper route 的前端一致性。
