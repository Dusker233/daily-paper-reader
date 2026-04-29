#!/usr/bin/env python3
"""
Batch strip ```markdown ... ``` fences from existing deep summary blocks.

PR #22 fixed the generation code to strip fences before writing, but all
previously generated papers still have the wrapper. This script cleans them.
"""

import re
import sys
from pathlib import Path


def strip_deep_summary_fence(text: str) -> str | None:
    """
    Find the deep summary block and strip its outer ```markdown ... ``` fence.

    The block looks like:
      ## 论文详细总结（自动生成）

      ```markdown
      ## 1. TLDR
      ...
      ```

    We strip ONLY the outermost fence; inner ```python etc. blocks are kept.
    Returns modified text, or None if no change needed.
    """
    marker = "## 论文详细总结（自动生成）"
    idx = text.find(marker)
    if idx == -1:
        return None

    # Split into: before_marker + marker + after_marker
    before = text[:idx]
    after_marker = text[idx + len(marker):]

    # Look for ```markdown or ``` immediately after the heading
    fence_start_match = re.match(r"\n\n```([A-Za-z0-9_+-]*)\n", after_marker)
    if not fence_start_match:
        return None

    lang = fence_start_match.group(1)
    body_start = fence_start_match.end()
    body = after_marker[body_start:]

    # Find the matching closing ``` at the end of the block
    # The fence usually ends at the very end of the content, or before ---/next heading
    body_rstripped = body.rstrip()
    if not body_rstripped.endswith("```"):
        return None

    # Strip the trailing ```
    stripped_body = body_rstripped[:-3].rstrip()

    # Rebuild
    new_text = before + marker + "\n\n" + stripped_body + "\n"
    return new_text


def process_file(path: Path) -> bool:
    """Process a single markdown file. Returns True if modified."""
    text = path.read_text(encoding="utf-8")
    new_text = strip_deep_summary_fence(text)
    if new_text is None:
        return False
    path.write_text(new_text, encoding="utf-8")
    return True


def main() -> int:
    docs_dir = Path("docs")
    if not docs_dir.is_dir():
        print("Error: docs/ directory not found", file=sys.stderr)
        return 1

    files = list(docs_dir.rglob("*.md"))
    modified = 0
    skipped = 0

    for f in files:
        text = f.read_text(encoding="utf-8")
        if "论文详细总结（自动生成）" not in text:
            continue

        # Check if it actually has a fence
        marker = "## 论文详细总结（自动生成）"
        idx = text.find(marker)
        after = text[idx + len(marker): idx + len(marker) + 20]
        if "```" not in after:
            skipped += 1
            continue

        if process_file(f):
            print(f"  [FIXED] {f}")
            modified += 1
        else:
            print(f"  [SKIP ] {f} (has heading but no outer fence)")
            skipped += 1

    print(f"\nDone: {modified} files fixed, {skipped} files skipped, {len(files)} total scanned.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
