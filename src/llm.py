import json
import os
import re
import time
from typing import List, Dict, Protocol, Tuple, Any, Optional

import requests

"""
统一的 LLM 客户端封装。

提供商/模型命名规则：'provider/model'，provider 大小写不敏感，model 保留大小写与路径。
当前支持：deepseek、siliconflow、ollama、blt、cstcloud（科技云）。
"""

# 单次实验级别的全局 token 统计（需由调用方在实验开始前手动 reset）
GLOBAL_TOKENS = {
    'prompt': 0,    # 提示词（prompt）部分 token
    'thinking': 0,  # 推理/思维链部分 token（reasoning_tokens）
    'content': 0,   # 可见输出部分 token（completion_tokens - reasoning_tokens）
    'total': 0,     # provider 返回的总 token（通常含 prompt + completion）
}
# 单次实验级别的全局时间统计（秒）
GLOBAL_TIME_SECONDS: float = 0.0

PRIMARY_LLM_BASE_URL = "https://api.gptbest.vip/v1"
DEFAULT_BLT_BASE_URL = "https://api.bltcy.ai/v1"
BLT_PROVIDER_BASE_KEYWORDS = ("bltcy.ai", "gptbest.vip", "blt", "gptbest")
LOCALHOST_BASE_URL_RE = re.compile(r"^http://(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:$|/)", re.IGNORECASE)


class SupportsRerank(Protocol):
    model: str

    def rerank(
        self,
        query: str,
        documents: List[str],
        top_n: Optional[int] = None,
        model: Optional[str] = None,
    ) -> dict:
        ...


def _read_env_text(*names: str) -> str:
    for name in names:
        value = str(os.getenv(name) or "").strip()
        if value:
            return value
    return ""


def _read_env_bool(*names: str) -> Optional[bool]:
    for name in names:
        raw = os.getenv(name)
        if raw is None:
            continue
        value = str(raw).strip().lower()
        if not value:
            continue
        if value in {"1", "true", "yes", "on"}:
            return True
        if value in {"0", "false", "no", "off"}:
            return False
    return None


def _read_env_config(field_names: Dict[str, Tuple[str, ...]]) -> Dict[str, str]:
    return {
        field: _read_env_text(*names)
        for field, names in field_names.items()
    }


def _has_any_config_values(config: Dict[str, str]) -> bool:
    return any(str(value or "").strip() for value in config.values())


def _merge_config_layers(*layers: Dict[str, str]) -> Dict[str, str]:
    merged = {"api_key": "", "base_url": "", "model": ""}
    for layer in layers:
        for field in merged:
            value = str((layer or {}).get(field) or "").strip()
            if value and not merged[field]:
                merged[field] = value
    return merged


def _looks_like_blt_base(base_url: str | None) -> bool:
    lowered = str(base_url or "").strip().lower()
    return any(keyword in lowered for keyword in BLT_PROVIDER_BASE_KEYWORDS)


def _should_use_authorization_header(base_url: str | None, model: str | None) -> bool:
    normalized_base_url = str(base_url or "").strip().lower()
    normalized_model = str(model or "").strip().lower()
    if normalized_model.startswith("minimax-"):
        return False
    if re.search(r"(^|//)api\.minimax(?:i)?\.(?:io|com)(?:$|/)", normalized_base_url, re.IGNORECASE):
        return False
    return True


def _validate_secure_base_url(base_url: str | None) -> str:
    normalized = str(base_url or "").strip()
    if not normalized:
        raise ValueError("缺少可用的 LLM base_url")
    lowered = normalized.lower()
    if lowered.startswith("https://"):
        return normalized
    if LOCALHOST_BASE_URL_RE.match(normalized):
        return normalized
    raise ValueError("LLM base_url 必须使用 https://，仅本地调试允许 http://localhost")


def resolve_workflow_llm_config(
    model_override: str | None = None,
    default_model: str | None = None,
) -> Dict[str, Any]:
    workflow_config = _read_env_config(
        {
            "api_key": ("WORKFLOW_LLM_API_KEY",),
            "base_url": ("WORKFLOW_LLM_BASE_URL",),
            "model": ("WORKFLOW_LLM_MODEL",),
        }
    )
    summary_config = _read_env_config(
        {
            "api_key": ("SUMMARY_API_KEY", "BLT_SUMMARY_API_KEY"),
            "base_url": (
                "SUMMARY_BASE_URL",
                "BLT_SUMMARY_BASE_URL",
                "LLM_PRIMARY_BASE_URL",
            ),
            "model": ("SUMMARY_MODEL", "BLT_SUMMARY_MODEL"),
        }
    )
    summary_compat_config = _read_env_config(
        {
            "api_key": ("BLT_API_KEY",),
            "base_url": (
                "BLT_PRIMARY_BASE_URL",
                "GPTBEST_BASE_URL",
                "BLT_API_BASE",
            ),
            "model": (),
        }
    )
    legacy_blt_config = dict(summary_compat_config)

    has_workflow_fields = _has_any_config_values(workflow_config)
    has_summary_fields = _has_any_config_values(summary_config)
    has_legacy_fields = _has_any_config_values(legacy_blt_config)

    if has_workflow_fields:
        cfg = dict(workflow_config)
        source = "workflow"
    elif has_summary_fields:
        cfg = _merge_config_layers(summary_config, summary_compat_config)
        source = "summary"
    else:
        cfg = dict(legacy_blt_config)
        source = "legacy_blt" if has_legacy_fields else "none"

    if model_override:
        cfg["model"] = str(model_override).strip()
    if not cfg["model"] and default_model:
        cfg["model"] = str(default_model).strip()
    if source == "legacy_blt" and cfg["api_key"] and not cfg["base_url"]:
        cfg["base_url"] = DEFAULT_BLT_BASE_URL

    return {
        **cfg,
        "source": source,
        "has_workflow_fields": has_workflow_fields,
        "has_summary_fields": has_summary_fields,
        "use_legacy_config": source == "legacy_blt" and has_legacy_fields,
    }


ALLOWED_LOCAL_RERANK_MODELS = {
    "baai/bge-reranker-v2-m3": "BAAI/bge-reranker-v2-m3",
}



def resolve_rerank_llm_config(
    model_override: str | None = None,
    default_model: str | None = None,
) -> Dict[str, Any]:
    enabled_flag = _read_env_bool("RERANK_ENABLED")
    provider_override = str(_read_env_text("RERANK_PROVIDER") or "").strip().lower()
    dedicated_config = _read_env_config(
        {
            "api_key": ("RERANK_API_KEY", "Reranker_LLM_API_KEY"),
            "base_url": ("RERANK_BASE_URL", "Reranker_LLM_BASE_URL"),
            "model": ("RERANK_MODEL", "Reranker_LLM_MODEL"),
        }
    )
    legacy_config = _read_env_config(
        {
            "api_key": ("BLT_API_KEY",),
            "base_url": (
                "BLT_API_BASE",
                "BLT_PRIMARY_BASE_URL",
                "LLM_PRIMARY_BASE_URL",
                "GPTBEST_BASE_URL",
            ),
            "model": ("BLT_RERANK_MODEL",),
        }
    )
    workflow_config = _read_env_config(
        {
            "api_key": ("WORKFLOW_LLM_API_KEY",),
            "base_url": ("WORKFLOW_LLM_BASE_URL",),
            "model": ("WORKFLOW_LLM_MODEL",),
        }
    )
    summary_config = _read_env_config(
        {
            "api_key": ("SUMMARY_API_KEY",),
            "base_url": ("SUMMARY_BASE_URL",),
            "model": ("SUMMARY_MODEL",),
        }
    )

    has_dedicated_fields = _has_any_config_values(dedicated_config)
    has_workflow_fields = _has_any_config_values(workflow_config)
    has_summary_fields = _has_any_config_values(summary_config)
    provider_is_blt_like = provider_override in {"blt", "remote", "openai", "default"}
    use_legacy_config = bool(
        (not provider_override or provider_is_blt_like)
        and not has_dedicated_fields
        and _has_any_config_values(legacy_config)
        and not has_workflow_fields
        and not has_summary_fields
    )

    cfg = _merge_config_layers(dedicated_config, legacy_config if use_legacy_config else {})
    if model_override:
        cfg["model"] = str(model_override).strip()

    provider = provider_override or ("blt" if (has_dedicated_fields or use_legacy_config) else "none")
    if provider in {"remote", "openai", "default"}:
        provider = "blt"
    if provider not in {"none", "blt", "local"}:
        provider = provider_override or provider
    if provider != "local" and not cfg["model"] and default_model:
        cfg["model"] = str(default_model).strip()

    if provider == "local":
        local_model_key = str(cfg["model"] or "").strip().lower()
        if not local_model_key:
            local_model_key = "baai/bge-reranker-v2-m3"
        cfg["model"] = ALLOWED_LOCAL_RERANK_MODELS.get(local_model_key, "")
        missing: List[str] = []
        if not cfg["model"]:
            missing.append("model(allowed: BAAI/bge-reranker-v2-m3)")
        if enabled_flag is False:
            enabled = False
            reason = "RERANK_ENABLED=false"
        elif missing:
            enabled = False
            reason = f"缺少 rerank 配置: {', '.join(missing)}"
        else:
            enabled = True
            reason = ""
        return {
            "enabled": enabled,
            "reason": reason,
            "provider": "local",
            "api_key": "",
            "base_url": "",
            "model": cfg["model"],
            "has_dedicated_fields": has_dedicated_fields,
            "use_legacy_config": False,
        }

    if use_legacy_config and not cfg["base_url"]:
        cfg["base_url"] = DEFAULT_BLT_BASE_URL

    missing = []
    if not cfg["api_key"]:
        missing.append("api_key")
    if not cfg["base_url"]:
        missing.append("base_url")
    if not cfg["model"]:
        missing.append("model")

    if enabled_flag is False:
        enabled = False
        reason = "RERANK_ENABLED=false"
    elif missing:
        enabled = False
        reason = f"缺少 rerank 配置: {', '.join(missing)}"
    elif provider == "blt" and (has_dedicated_fields or use_legacy_config or enabled_flag is True):
        enabled = True
        reason = ""
    else:
        enabled = False
        reason = "未显式配置 rerank 平台"
        provider = "none"

    return {
        "enabled": enabled,
        "reason": reason,
        "provider": provider,
        "api_key": cfg["api_key"],
        "base_url": cfg["base_url"],
        "model": cfg["model"],
        "has_dedicated_fields": has_dedicated_fields,
        "use_legacy_config": use_legacy_config,
    }


def reset_global_tokens():
    """重置本次实验的全局 token 统计。"""
    GLOBAL_TOKENS['prompt'] = 0
    GLOBAL_TOKENS['thinking'] = 0
    GLOBAL_TOKENS['content'] = 0
    GLOBAL_TOKENS['total'] = 0


def get_global_tokens() -> Dict[str, int]:
    """获取本次实验的全局 token 统计（thinking/content/total）。"""
    return dict(GLOBAL_TOKENS)


def reset_global_time():
    """重置本次实验的大模型总耗时统计（秒）。"""
    global GLOBAL_TIME_SECONDS
    GLOBAL_TIME_SECONDS = 0.0


def get_global_time() -> float:
    """获取本次实验的大模型总耗时（秒）。"""
    return float(GLOBAL_TIME_SECONDS)


class LLMClient:
    tokens = {
        'prompt': 0,
        'content': 0,
        'reasoning': 0,
        'total': 0,
    }

    def __init__(self, api_key: str, model: str, base_url: str):
        """
        初始化 LLM 客户端。

        :param api_key: API 密钥
        :param model: 模型名称
        :param base_url: API 的基础 URL
        """
        self.api_key = api_key
        self.model = model
        self.base_url = _validate_secure_base_url(base_url)
        self._base_urls = self._normalize_base_urls([self.base_url])
        # 实例级别的累计统计（无需显式 reset；通常每个实验构造一个 client）
        self._call_index = 0
        self._cum_tokens = {
            'prompt': 0,
            'thinking': 0,
            'content': 0,
            'total': 0,
        }
        # 实例级别的累计耗时（秒）
        self._cum_time_seconds: float = 0.0
        self.kwargs: Dict[str, Any] = {
            'max_tokens': 4000,  # 更安全的默认值，避免超过部分模型上限
            'temperature': 0.6,
            'top_p': 0.3,
            'top_k': 50,
            'frequency_penalty': 0.5,
            'n': 1,
            'stream': False,
        }

    @staticmethod
    def _normalize_base_urls(urls: List[str | None]) -> List[str]:
        out: List[str] = []
        for url in urls:
            if not url:
                continue
            candidate = str(url).strip().rstrip("/")
            if candidate and candidate not in out:
                out.append(candidate)
        return out

    def _iter_request_bases(self) -> List[str]:
        return self._normalize_base_urls(self._base_urls)

    @staticmethod
    def _build_chat_completions_url(base_url: str | None) -> str:
        raw = str(base_url or "").strip().rstrip("/")
        if not raw:
            raise ValueError("缺少可用的 LLM base_url")
        if raw.lower().endswith("/chat/completions"):
            return raw
        if re.search(r"/v\d+$", raw, re.IGNORECASE):
            return f"{raw}/chat/completions"
        return f"{raw}/v1/chat/completions"

    def _iter_retry_bases(self, total_attempts: int = 6) -> List[str]:
        bases = self._iter_request_bases()
        if total_attempts <= 0:
            return []
        if not bases:
            return []

        if len(bases) == 1:
            return [bases[0]] * total_attempts

        attempts: List[str] = []
        for idx in range(total_attempts):
            attempts.append(bases[idx % len(bases)])
        return attempts

    def _provider_name(self, base_url: str | None = None) -> str:
        try:
            url = (base_url or self.base_url or '').lower()
            if 'deepseek' in url:
                return 'deepseek'
            if 'siliconflow' in url or 'siliconflow.cn' in url:
                return 'siliconflow'
            if 'gptbest' in url:
                return 'blt'
            if 'bltcy' in url or 'blt' in url:
                return 'blt'
            if 'ollama' in url or 'localhost' in url:
                return 'ollama'
            if 'cstcloud' in url or 'uni-api.cstcloud.cn' in url:
                return 'cstcloud'
        except Exception:
            pass
        return 'llm'

    @staticmethod
    def _extract_text_content(value: Any) -> str:
        if isinstance(value, str):
            return value
        if isinstance(value, list):
            parts: List[str] = []
            for item in value:
                text = LLMClient._extract_text_content(item)
                if text:
                    parts.append(text)
            return "\n".join(parts).strip()
        if isinstance(value, dict):
            for key in ("text", "content", "value"):
                text = value.get(key)
                if isinstance(text, str) and text.strip():
                    return text
        return ""

    @staticmethod
    def _strip_json_wrappers(text: str) -> str:
        cleaned = (text or "").strip()
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
        return cleaned.strip()

    @staticmethod
    def _repair_json_suffix(text: str) -> str:
        if not text:
            return text

        stack: List[str] = []
        in_str = False
        escaped = False

        for ch in text:
            if in_str:
                if escaped:
                    escaped = False
                    continue
                if ch == "\\":
                    escaped = True
                    continue
                if ch == '"':
                    in_str = False
                continue

            if ch == '"':
                in_str = True
            elif ch == '{':
                stack.append('}')
            elif ch == '[':
                stack.append(']')
            elif ch in ('}', ']'):
                if stack and stack[-1] == ch:
                    stack.pop()

        repaired = text
        if in_str:
            repaired += '"'
        if stack:
            repaired += ''.join(reversed(stack))
        repaired = re.sub(r",(\s*[}\]])", r"\1", repaired)
        return repaired

    @classmethod
    def parse_json_content(cls, text: str) -> Any:
        raw = cls._strip_json_wrappers((text or "").strip())
        if not raw:
            return None

        decoder = json.JSONDecoder()
        candidates: List[str] = []
        first_obj = raw.find("{")
        last_obj = raw.rfind("}")
        first_arr = raw.find("[")
        last_arr = raw.rfind("]")
        if first_obj != -1:
            candidates.append(raw[first_obj:])
            if last_obj != -1 and last_obj >= first_obj:
                candidates.append(raw[first_obj:last_obj + 1])
        if first_arr != -1:
            candidates.append(raw[first_arr:])
            if last_arr != -1 and last_arr >= first_arr:
                candidates.append(raw[first_arr:last_arr + 1])
        candidates.append(raw)

        seen: set[str] = set()
        last_exc: Exception | None = None
        for candidate in candidates:
            if candidate in seen:
                continue
            seen.add(candidate)
            try:
                obj, _idx = decoder.raw_decode(candidate)
                return obj
            except Exception as exc:
                last_exc = exc
                repaired = cls._repair_json_suffix(candidate)
                if repaired == candidate:
                    continue
                try:
                    return json.loads(repaired)
                except Exception as exc2:
                    last_exc = exc2

        raise ValueError(f"模型未返回合法 JSON：{raw[:500]}") from last_exc

    @staticmethod
    def build_json_schema_response_format(
        schema_name: str,
        schema: Dict[str, Any],
        strict: bool = True,
    ) -> Dict[str, Any]:
        return {
            "type": "json_schema",
            "json_schema": {
                "name": schema_name,
                "schema": schema,
                "strict": bool(strict),
            },
        }

    @staticmethod
    def build_json_object_response_format() -> Dict[str, str]:
        return {"type": "json_object"}

    @staticmethod
    def _is_structured_output_unsupported_error(error: Exception) -> bool:
        response = getattr(error, "response", None)
        status_code = getattr(response, "status_code", None)
        text = ""
        if response is not None:
            try:
                text = response.text or ""
            except Exception:
                text = ""
        if not text:
            text = str(error or "")
        lowered = text.lower()
        has_target = any(token in lowered for token in (
            "response_format",
            "json_schema",
            "json object",
            "json_object",
        ))
        has_signal = any(token in lowered for token in (
            "unsupported",
            "not support",
            "not supported",
            "invalid",
            "unknown",
            "unrecognized",
            "extra inputs",
            "unexpected",
            "must be one of",
            "one of",
            "allowed values",
            "enum",
        ))
        if has_target and has_signal:
            return True
        if (
            status_code in (400, 404, 415, 422)
            and "response_format" in lowered
            and any(token in lowered for token in ("json_object", "json_schema", "text"))
        ):
            return True
        if status_code in (400, 404, 415, 422) and "response_format" in lowered:
            return True
        return False

    def _build_auth_headers(self, *, base_url: str | None = None, model: str | None = None) -> Dict[str, str]:
        headers = {
            "Content-Type": "application/json",
        }
        if _should_use_authorization_header(base_url or self.base_url, model or self.model):
            headers["Authorization"] = f"Bearer {self.api_key}"
        else:
            headers["x-api-key"] = self.api_key
        return headers

    def chat(self, messages: List[Dict[str, str]], response_format: Optional[Dict[str, Any]] = None) -> dict:
        """
        统一 Chat Completions 请求。

        :param messages: OpenAI 格式的消息列表
        :param response_format: 可选，结构化输出配置（柏拉图支持）
        """
        model_name = self.model
        if 'qwen3' in model_name.lower():
            if '/think' in model_name:
                self.kwargs['enable_thinking'] = True
                model_name = model_name.replace('/think', '')
            else:
                self.kwargs['enable_thinking'] = False
                model_name = model_name.replace('/think', '')

        payload: Dict[str, Any] = {
            "model": model_name,
            "messages": messages,
        }
        # 仅透传 OpenAI Chat Completions 兼容字段，避免提供商拒绝未知参数
        allowed_keys = {
            'max_tokens', 'temperature', 'top_p', 'n', 'stream',
            'presence_penalty', 'frequency_penalty', 'stop', 'logprobs',
            'tools', 'tool_choice', 'logit_bias',
            'response_format',
        }
        if isinstance(self.kwargs, dict):
            for k, v in self.kwargs.items():
                if k in allowed_keys:
                    payload[k] = v
        if response_format is not None:
            payload['response_format'] = response_format

        # 对输出 token 上限做保护（部分模型 4k 上限，统一取不超过 10000）
        try:
            if isinstance(payload.get('max_tokens'), int) and payload['max_tokens'] > 10000:
                payload['max_tokens'] = 10000
        except Exception:
            pass

        start_time = time.time()
        request_bases = self._iter_retry_bases(total_attempts=6)
        last_error: Exception | None = None
        for attempt_idx, req_base in enumerate(request_bases, start=1):
            request_url = self._build_chat_completions_url(req_base)
            headers = self._build_auth_headers(base_url=req_base, model=model_name)
            try:
                response = requests.post(request_url, headers=headers, json=payload, timeout=120)
                response.raise_for_status()
                try:
                    response_data = response.json()
                except ValueError:
                    print("API 响应无法解析为 JSON，原始文本预览:", response.text[:500])
                    raise

                debug_raw = os.getenv("BLT_DEBUG_RAW") == "1" or os.getenv("LLM_DEBUG_RAW") == "1"
                if debug_raw and self._provider_name(req_base) == "blt":
                    print("[DEBUG] BLT 原始响应包:", response.text)

                if isinstance(response_data, dict) and 'error' in response_data:
                    err = response_data.get('error') or {}
                    print("API 返回错误:", {
                        'type': err.get('type'),
                        'code': err.get('code'),
                        'message': err.get('message') or err,
                    })
                    raise requests.exceptions.HTTPError(f"API error: {err}")

                if 'choices' not in response_data or not response_data['choices']:
                    print("API 响应不包含 choices 字段或为空：", str(response_data)[:500])
                    raise requests.exceptions.HTTPError("API response missing choices")

                choice = response_data['choices'][0] if isinstance(response_data['choices'][0], dict) else {}
                message = choice.get('message', {}) if isinstance(choice, dict) else {}
                content = self._extract_text_content(message.get('content'))
                reasoning_content = self._extract_text_content(message.get('reasoning_content'))
                refusal = str(message.get('refusal') or '').strip()
                finish_reason = choice.get('finish_reason') if isinstance(choice, dict) else None

                usage = response_data.get('usage', {})
                prompt_tokens = usage.get('prompt_tokens', 0)
                completion_tokens = usage.get('completion_tokens', 0)
                total_tokens = usage.get('total_tokens', 0)
                reasoning_tokens = 0
                if 'completion_tokens_details' in usage:
                    reasoning_tokens = usage['completion_tokens_details'].get('reasoning_tokens', 0)

                self.tokens['prompt'] += prompt_tokens
                self.tokens['content'] += completion_tokens - reasoning_tokens
                self.tokens['reasoning'] += reasoning_tokens
                self.tokens['total'] += total_tokens

                try:
                    GLOBAL_TOKENS['prompt'] += int(prompt_tokens)
                    GLOBAL_TOKENS['thinking'] += int(reasoning_tokens)
                    GLOBAL_TOKENS['content'] += int(completion_tokens - reasoning_tokens)
                    GLOBAL_TOKENS['total'] += int(total_tokens)
                except Exception:
                    pass

                try:
                    elapsed = time.time() - start_time
                    self._cum_time_seconds += float(elapsed)
                    try:
                        global GLOBAL_TIME_SECONDS
                        GLOBAL_TIME_SECONDS += float(elapsed)
                    except Exception:
                        pass

                    self._call_index += 1
                    self._cum_tokens['prompt'] += int(prompt_tokens)
                    self._cum_tokens['thinking'] += int(reasoning_tokens)
                    self._cum_tokens['content'] += int(completion_tokens - reasoning_tokens)
                    self._cum_tokens['total'] += int(total_tokens)

                    provider = self._provider_name(req_base)
                    header = f"[{provider}][{self.model}] 第{self._call_index}次"
                    line_cur = (
                        f"本次 tokens：prompt={int(prompt_tokens)}, thinking={int(reasoning_tokens)}, "
                        f"content={int(completion_tokens - reasoning_tokens)}, total={int(total_tokens)}"
                    )
                    line_cum = (
                        f"累计 tokens：prompt={self._cum_tokens['prompt']}, thinking={self._cum_tokens['thinking']}, "
                        f"content={self._cum_tokens['content']}, total={self._cum_tokens['total']}"
                    )
                    line_time = (
                        f"本次用时：{elapsed:.2f}s，"
                        f"累计用时：{self._cum_time_seconds:.2f}s"
                    )
                    print(header + "\n" + line_cur + "\n" + line_cum + "\n" + line_time)
                except Exception:
                    pass

                return {
                    "content": content,
                    "raw_content": message.get('content'),
                    "reasoning_content": reasoning_content,
                    "refusal": refusal,
                    "finish_reason": finish_reason,
                    "message": message,
                    "raw_response": response_data,
                    "tokens": {
                        "prompt": prompt_tokens,
                        "content": completion_tokens - reasoning_tokens,
                        "reasoning": reasoning_tokens,
                        "total": total_tokens
                    }
                }

            except Exception as e:
                last_error = e
                if response_format is not None and self._is_structured_output_unsupported_error(e):
                    raise
                if attempt_idx < len(request_bases):
                    next_base = request_bases[attempt_idx] if attempt_idx < len(request_bases) else ''
                    print(
                        f"请求失败（base={req_base}，第 {attempt_idx} 次），"
                        f"将回退到 {next_base}"
                    )
                    if hasattr(e, "response") and e.response is not None:
                        try:
                            print("错误详情(JSON):", e.response.json())
                        except ValueError:
                            try:
                                print("错误详情(TEXT):", e.response.text[:500])
                            except Exception:
                                pass
                    continue
                print(f"通过 requests 调用 API 时出错: {e}")
                if hasattr(e, "response") and e.response is not None:
                    try:
                        print("错误详情(JSON):", e.response.json())
                    except ValueError:
                        try:
                            print("错误详情(TEXT):", e.response.text[:500])
                        except Exception:
                            pass
                raise

        if last_error is not None:
            raise last_error
        raise RuntimeError("LLM 请求未命中可用 base")

    def chat_structured(
        self,
        messages: List[Dict[str, str]],
        schema_name: str,
        schema: Dict[str, Any],
        *,
        strict: bool = True,
        allow_json_object_fallback: bool = True,
    ) -> Dict[str, Any]:
        attempts: List[Tuple[str, Dict[str, Any]]] = [
            (
                "json_schema",
                self.build_json_schema_response_format(
                    schema_name=schema_name,
                    schema=schema,
                    strict=strict,
                ),
            )
        ]
        if allow_json_object_fallback:
            attempts.append(("json_object", self.build_json_object_response_format()))

        last_error: Exception | None = None
        for idx, (format_name, response_format) in enumerate(attempts):
            try:
                response = self.chat(messages=messages, response_format=response_format)
            except Exception as exc:
                last_error = exc
                if idx + 1 < len(attempts) and self._is_structured_output_unsupported_error(exc):
                    print(
                        f"[INFO] Structured Outputs 不受支持，回退到 {attempts[idx + 1][0]}。"
                    )
                    continue
                raise

            parsed = None
            parse_error: Exception | None = None
            if not response.get("refusal"):
                content = str(response.get("content") or "").strip()
                if content:
                    try:
                        parsed = self.parse_json_content(content)
                    except Exception as exc:
                        parse_error = exc

            structured = dict(response)
            structured["parsed"] = parsed
            structured["parse_error"] = parse_error
            structured["response_format_used"] = format_name
            return structured

        if last_error is not None:
            raise last_error
        raise RuntimeError("结构化输出请求未命中可用格式")

    def rerank(
        self,
        query: str,
        documents: List[str],
        top_n: Optional[int] = None,
        model: Optional[str] = None,
    ) -> dict:
        """OpenAI-compatible /v1/rerank 接口（默认不支持）。"""
        raise NotImplementedError("rerank 接口默认不可用，请使用支持 /v1/rerank 的客户端调用。")


class DeepSeekClient(LLMClient):
    def __init__(self, api_key: str, model: str, base_url: str = "https://api.deepseek.com"):
        super().__init__(api_key=api_key, model=model, base_url=base_url)


class SiliconflowClient(LLMClient):
    def __init__(self, api_key: str, model: str, base_url: str = "https://api.siliconflow.cn/v1"):
        super().__init__(api_key=api_key, model=model, base_url=base_url)


class CSTCloudClient(LLMClient):
    """CSTCloud（科技云）提供商，OpenAI Chat Completions 兼容接口。

    默认基址：https://uni-api.cstcloud.cn/v1
    使用示例：model="CSTCloud/gpt-oss-120b" 或 "CSTCloud/qwen3:235b"
    建议环境变量：CSTCLOUD_API_KEY
    """
    def __init__(self, api_key: str, model: str, base_url: str = "https://uni-api.cstcloud.cn/v1"):
        super().__init__(api_key=api_key, model=model, base_url=base_url)


SliconflowClient = SiliconflowClient


class OllamaClient(LLMClient):
    def __init__(self, api_key: str, model: str, base_url: str = "http://localhost:11111/v1"):
        super().__init__(api_key=api_key, model=model, base_url=base_url)


class BltClient(LLMClient):
    """BLT（柏拉图）网关，OpenAI Chat Completions 兼容接口。"""
    def __init__(self, api_key: str, model: str, base_url: str = None):
        explicit_base = str(base_url or "").strip()
        primary_base = explicit_base or _read_env_text(
            "WORKFLOW_LLM_BASE_URL",
            "SUMMARY_BASE_URL",
            "BLT_SUMMARY_BASE_URL",
            "LLM_PRIMARY_BASE_URL",
            "BLT_PRIMARY_BASE_URL",
            "GPTBEST_BASE_URL",
        ) or PRIMARY_LLM_BASE_URL
        legacy_base = explicit_base or _read_env_text("BLT_API_BASE") or primary_base or DEFAULT_BLT_BASE_URL
        super().__init__(api_key=api_key, model=model, base_url=primary_base)
        self._base_urls = self._normalize_base_urls([primary_base, legacy_base])

    def rerank(
        self,
        query: str,
        documents: List[str],
        top_n: Optional[int] = None,
        model: Optional[str] = None,
    ) -> dict:
        """
        调用柏拉图 Rerank 接口（/v1/rerank）。

        :param query: 查询文本
        :param documents: 待排序文档列表
        :param top_n: 返回的 Top N（可选）
        :param model: 重排模型名（可选，默认使用 self.model）
        """
        if not query:
            raise ValueError("rerank: query 不能为空")
        if not documents:
            raise ValueError("rerank: documents 不能为空")

        payload: Dict[str, Any] = {
            "model": model or self.model,
            "query": query,
            "documents": documents,
        }
        if top_n is not None:
            payload["top_n"] = int(top_n)

        request_bases = self._iter_retry_bases(total_attempts=6)
        last_error: Exception | None = None
        for attempt_idx, req_base in enumerate(request_bases, start=1):
            request_url = f"{req_base.rstrip('/')}/rerank"
            headers = self._build_auth_headers(base_url=req_base, model=payload["model"])
            try:
                response = requests.post(request_url, headers=headers, json=payload, timeout=120)
                response.raise_for_status()
                try:
                    response_data = response.json()
                except ValueError:
                    print("Rerank 响应无法解析为 JSON，原始文本预览:", response.text[:500])
                    raise

                if isinstance(response_data, dict) and 'error' in response_data:
                    err = response_data.get('error') or {}
                    print("Rerank 返回错误:", {
                        'type': err.get('type'),
                        'code': err.get('code'),
                        'message': err.get('message') or err,
                    })
                    raise requests.exceptions.HTTPError(f"Rerank API error: {err}")

                return response_data
            except Exception as e:
                last_error = e
                if attempt_idx < len(request_bases):
                    next_base = request_bases[attempt_idx] if attempt_idx < len(request_bases) else ''
                    print(
                        f"Rerank 请求失败（base={req_base}，第 {attempt_idx} 次），"
                        f"将回退到 {next_base}"
                    )
                    continue
                print(f"通过 requests 调用 Rerank API 时出错: {e}")
                print("Rerank 请求摘要:", {
                    "url": request_url,
                    "model": payload.get("model"),
                    "query_len": len(query or ""),
                    "documents": len(documents),
                    "top_n": payload.get("top_n"),
                })
                if e.response is not None:
                    try:
                        print("错误详情(JSON):", e.response.json())
                    except ValueError:
                        try:
                            print("错误详情(TEXT):", e.response.text[:500])
                        except Exception:
                            pass
                else:
                    print("错误详情: 未收到服务端响应（可能是网络/SSL问题）。")
                raise

        if last_error is not None:
            raise last_error
        raise RuntimeError("rerank 未命中可用 base")


def parse_provider_model(model_str: str) -> Tuple[str, str]:
    """
    解析模型字符串为 (provider, model)。

    规则：第一个 '/' 之前为提供商（大小写不敏感），之后的全部为模型名（大小写敏感，允许包含 '/').
    示例：
    - "deepseek/deepseek-chat" -> ("deepseek", "deepseek-chat")
    - "SiliconFlow/Qwen/Qwen3-8B" -> ("siliconflow", "Qwen/Qwen3-8B")
    - "ollama/llama3.1:8b" -> ("ollama", "llama3.1:8b")
    """
    if not isinstance(model_str, str) or '/' not in model_str:
        raise ValueError("缺少模型提供商：请使用 'provider/model' 格式，例如 'CSTCloud/gpt-oss-120b'")
    provider, model = model_str.split('/', 1)
    return provider.lower(), model


class ClientFactory:
    @staticmethod
    def from_env(scope: str = "default", model_override: str | None = None, default_model: str | None = None):
        """
        基于环境变量创建具体客户端。

        scope:
        - default: 兼容旧 LLM_MODEL=provider/model 入口
        - workflow: 新工作流平台配置入口
        - rerank: 独立 rerank 平台配置入口
        """
        scope_name = str(scope or "default").strip().lower()
        if scope_name == "workflow":
            cfg = resolve_workflow_llm_config(model_override=model_override, default_model=default_model)
            if not cfg["api_key"]:
                raise ValueError("缺少 workflow LLM API Key")
            if not cfg["model"]:
                raise ValueError("缺少 workflow LLM model")
            if not cfg["base_url"]:
                raise ValueError("缺少 workflow LLM base_url")
            base_url = cfg["base_url"]
            if _looks_like_blt_base(base_url):
                return BltClient(api_key=cfg["api_key"], model=cfg["model"], base_url=base_url)
            return LLMClient(api_key=cfg["api_key"], model=cfg["model"], base_url=base_url)

        if scope_name == "rerank":
            cfg = resolve_rerank_llm_config(model_override=model_override, default_model=default_model)
            if not cfg["enabled"]:
                raise ValueError(cfg["reason"] or "rerank 未启用")
            if cfg.get("provider") == "local":
                try:
                    from local_rerank import LocalRerankClient
                except Exception:  # pragma: no cover - 兼容 package 导入路径
                    from src.local_rerank import LocalRerankClient
                return LocalRerankClient(model=cfg["model"])
            return BltClient(api_key=cfg["api_key"], model=cfg["model"], base_url=cfg["base_url"])

        model_env = (os.getenv('LLM_MODEL') or '').strip()
        if not model_env:
            workflow_cfg = resolve_workflow_llm_config(model_override=model_override, default_model=default_model)
            if workflow_cfg["api_key"] and workflow_cfg["model"]:
                if not workflow_cfg["base_url"]:
                    raise ValueError("缺少 workflow LLM base_url")
                base_url = workflow_cfg["base_url"]
                if _looks_like_blt_base(base_url):
                    return BltClient(api_key=workflow_cfg["api_key"], model=workflow_cfg["model"], base_url=base_url)
                return LLMClient(api_key=workflow_cfg["api_key"], model=workflow_cfg["model"], base_url=base_url)
            raise ValueError("缺少必要环境变量: LLM_MODEL（格式为 'provider/model'）")

        provider, model = parse_provider_model(model_env)
        api_key = (os.getenv('LLM_API_KEY') or '').strip() or None
        base_url = (os.getenv('LLM_BASE_URL') or '').strip() or None

        if provider == 'deepseek':
            base_url = base_url or "https://api.deepseek.com"
            return DeepSeekClient(api_key=api_key or os.getenv('DEEPSEEK_API_KEY', ''), model=model, base_url=base_url)
        if provider in ('siliconflow', 'silicon-flow', 'sflow'):
            base_url = base_url or "https://api.siliconflow.cn/v1"
            return SiliconflowClient(api_key=api_key or os.getenv('SILICONFLOW_API_KEY', ''), model=model, base_url=base_url)
        if provider == 'ollama':
            base_url = base_url or "http://localhost:11111/v1"
            return OllamaClient(api_key=api_key or '', model=model, base_url=base_url)
        if provider in ('blt', 'bltcy', 'plato'):
            return BltClient(api_key=api_key or os.getenv('BLT_API_KEY', ''), model=model, base_url=base_url or os.getenv('BLT_API_BASE', 'https://api.bltcy.ai/v1'))
        if provider in ('cstcloud', 'cst', 'cst-cloud', 'keji', 'keji-yun'):
            return CSTCloudClient(api_key=api_key or os.getenv('CSTCLOUD_API_KEY', ''), model=model, base_url=base_url or 'https://uni-api.cstcloud.cn/v1')
        if api_key:
            return LLMClient(api_key=api_key, model=model, base_url=base_url or PRIMARY_LLM_BASE_URL)
        raise ValueError(f"不支持的提供商: {provider}，请使用 'deepseek'、'siliconflow'、'blt'、'cstcloud' 或 'ollama'")

    @staticmethod
    def from_config(_config: dict | None = None):
        """
        兼容旧调用入口，但不再读取 config 文件，统一从环境变量读取。
        """
        return ClientFactory.from_env()
