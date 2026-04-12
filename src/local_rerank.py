from __future__ import annotations

import os
from typing import Any, List, Optional

import numpy as np


class LocalRerankClient:
    """Local cross-encoder reranker with BLT-compatible result shape."""

    def __init__(
        self,
        model: str,
        *,
        device: str | None = None,
        batch_size: int | None = None,
    ):
        self.api_key = ""
        self.base_url = ""
        self.model = str(model or "").strip()
        self.provider = "local"
        self.device = str(
            device
            or os.getenv("RERANK_LOCAL_DEVICE")
            or os.getenv("DPR_RERANK_DEVICE")
            or "cpu"
        ).strip()
        self.batch_size = self._resolve_batch_size(batch_size)
        self._cross_encoder = None
        self._loaded_model_name = ""

    @staticmethod
    def _resolve_batch_size(batch_size: int | None) -> int:
        if batch_size is not None:
            return max(int(batch_size), 1)
        raw = (
            os.getenv("RERANK_LOCAL_BATCH_SIZE")
            or os.getenv("DPR_RERANK_BATCH_SIZE")
            or "16"
        )
        try:
            return max(int(raw), 1)
        except Exception:
            return 16

    def _load_model(self, model_name: str):
        if self._cross_encoder is not None and self._loaded_model_name == model_name:
            return self._cross_encoder

        from sentence_transformers import CrossEncoder

        print(
            f"[INFO] loading local reranker: model={model_name} device={self.device}",
            flush=True,
        )
        self._cross_encoder = CrossEncoder(model_name, device=self.device)
        self._loaded_model_name = model_name
        return self._cross_encoder

    def rerank(
        self,
        query: str,
        documents: List[str],
        top_n: Optional[int] = None,
        model: Optional[str] = None,
    ) -> dict[str, Any]:
        if not str(query or "").strip():
            raise ValueError("rerank: query 不能为空")
        if not documents:
            raise ValueError("rerank: documents 不能为空")

        effective_model = str(model or self.model or "").strip()
        if not effective_model:
            raise ValueError("rerank: 缺少本地 rerank model")

        encoder = self._load_model(effective_model)
        pairs = [(query, doc) for doc in documents]
        scores = encoder.predict(
            pairs,
            batch_size=self.batch_size,
            show_progress_bar=False,
        )
        flat_scores = np.asarray(scores, dtype=np.float32).reshape(-1)
        ranked = sorted(
            enumerate(flat_scores.tolist()),
            key=lambda item: item[1],
            reverse=True,
        )
        if top_n is not None:
            ranked = ranked[: max(int(top_n), 0)]

        return {
            "results": [
                {"index": index, "relevance_score": float(score)}
                for index, score in ranked
            ]
        }
