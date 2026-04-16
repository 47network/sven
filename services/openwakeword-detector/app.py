import base64
import io
import logging
import os
from typing import Any
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import urlopen

import numpy as np
import soundfile as sf
from fastapi import FastAPI, HTTPException
from openwakeword.model import Model
from pydantic import BaseModel


logger = logging.getLogger("openwakeword-detector")
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))


def normalize_phrase(value: str | None) -> str:
    text = "".join(ch.lower() if ch.isalnum() else " " for ch in (value or ""))
    return " ".join(text.split())


def parse_model_paths(raw: str | None) -> list[str]:
    return [value.strip() for value in (raw or "").split(",") if value.strip()]


def parse_model_names(raw: str | None) -> list[str]:
    return [value.strip() for value in (raw or "").split(",") if value.strip()]


def parse_phrase_map(raw: str | None) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for chunk in (raw or "").split(","):
        item = chunk.strip()
        if not item or "=" not in item:
            continue
        key, value = item.split("=", 1)
        key_norm = normalize_phrase(key)
        value_norm = normalize_phrase(value)
        if key_norm and value_norm:
            mapping[key_norm] = value_norm
    return mapping


PROJECT_MODELS_DIR = Path(__file__).resolve().parent / "models"
MODEL_PATHS = parse_model_paths(os.getenv("OPENWAKEWORD_MODEL_PATHS"))
MODEL_NAMES = parse_model_names(os.getenv("OPENWAKEWORD_MODEL_NAMES"))
PHRASE_MAP = parse_phrase_map(os.getenv("OPENWAKEWORD_PHRASE_MAP"))
DEFAULT_THRESHOLD = float(os.getenv("OPENWAKEWORD_THRESHOLD", "0.5"))
MAX_AUDIO_BYTES = max(32 * 1024, int(os.getenv("OPENWAKEWORD_MAX_AUDIO_BYTES", str(2 * 1024 * 1024))))
DEBUG_TOP_K = max(1, int(os.getenv("OPENWAKEWORD_DEBUG_TOP_K", "5")))


def resolve_model_paths() -> list[str]:
    resolved: list[str] = []
    for raw in MODEL_PATHS:
        path = Path(raw)
        if not path.is_absolute():
            path = PROJECT_MODELS_DIR / raw
        resolved.append(str(path))
    for name in MODEL_NAMES:
        candidate = PROJECT_MODELS_DIR / name
        if candidate.suffix:
            resolved.append(str(candidate))
        else:
            for suffix in (".onnx", ".tflite"):
                resolved.append(str(candidate.with_suffix(suffix)))
    deduped: list[str] = []
    seen: set[str] = set()
    for item in resolved:
        if item not in seen:
            seen.add(item)
            deduped.append(item)
    return deduped


RESOLVED_MODEL_PATHS = [path for path in resolve_model_paths() if Path(path).exists()]

logger.info(
    "Loading openWakeWord detector",
    extra={
        "model_paths": RESOLVED_MODEL_PATHS,
        "requested_model_names": MODEL_NAMES,
        "phrase_map": PHRASE_MAP,
    },
)
MODEL: Model | None = None
MODEL_LOAD_ERROR: str | None = None

if RESOLVED_MODEL_PATHS:
    try:
        MODEL = Model(wakeword_model_paths=RESOLVED_MODEL_PATHS)
    except Exception as exc:
        MODEL_LOAD_ERROR = str(exc)
        logger.exception("Unable to initialize openWakeWord model", extra={"model_paths": RESOLVED_MODEL_PATHS})
else:
    MODEL_LOAD_ERROR = "No OPENWAKEWORD_MODEL_PATHS/OPENWAKEWORD_MODEL_NAMES configured"
    logger.warning("No wake-word models configured; detector will return detected=false")

app = FastAPI()


class DetectRequest(BaseModel):
    wake_word: str
    threshold: float | None = None
    audio_base64: str | None = None
    audio_url: str | None = None


def _safe_load_error() -> str | None:
    """Sanitise model load error for external responses — no stack traces."""
    if MODEL_LOAD_ERROR is None:
        return None
    # Return only the first line to avoid leaking internal paths or tracebacks
    return MODEL_LOAD_ERROR.split("\n")[0][:200]


@app.get("/healthz")
def healthz() -> dict[str, Any]:
    return {
        "success": True,
        "loaded_models": sorted(list_loaded_labels()),
        "resolved_model_paths": RESOLVED_MODEL_PATHS,
        "model_ready": MODEL is not None,
        "model_load_error": _safe_load_error(),
    }


@app.post("/v1/detect")
def detect(body: DetectRequest) -> dict[str, Any]:
    if not body.audio_base64 and not body.audio_url:
        raise HTTPException(status_code=400, detail="audio_base64 or audio_url is required")

    audio_bytes = resolve_audio_bytes(body)
    samples = decode_audio(audio_bytes)
    scores = predict_scores(samples)
    threshold = body.threshold if body.threshold is not None else DEFAULT_THRESHOLD
    target_label = resolve_target_label(body.wake_word, scores)
    confidence = scores.get(target_label, 0.0) if target_label else 0.0
    matched_label = target_label if target_label and confidence >= threshold else None
    top_scores = sorted(scores.items(), key=lambda item: item[1], reverse=True)[:DEBUG_TOP_K]

    logger.info(
        "Detector evaluated wake-word audio window",
        extra={
            "requested_wake_word": body.wake_word,
            "target_label": target_label,
            "matched_label": matched_label,
            "confidence": confidence,
            "threshold": threshold,
            "top_scores": top_scores,
        },
    )

    return {
        "success": True,
        "data": {
            "detected": bool(matched_label),
            "requested_wake_word": body.wake_word,
            "matched_label": matched_label,
            "target_label": target_label,
            "confidence": confidence,
            "threshold": threshold,
            "scores": scores,
            "top_scores": [{"label": label, "score": score} for label, score in top_scores],
            "model_ready": MODEL is not None,
            "model_load_error": _safe_load_error(),
        },
    }


def _validate_audio_url(url: str) -> str:
    """Validate audio_url to prevent SSRF — only allow http/https schemes."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="audio_url must use http or https scheme")
    if not parsed.hostname:
        raise HTTPException(status_code=400, detail="audio_url must include a hostname")
    return url


def resolve_audio_bytes(body: DetectRequest) -> bytes:
    if body.audio_base64:
        normalized = body.audio_base64.strip()
        if normalized.startswith("data:") and "," in normalized:
            normalized = normalized.split(",", 1)[1]
        try:
            payload = base64.b64decode(normalized, validate=True)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid audio_base64 payload")
    else:
        try:
            validated_url = _validate_audio_url(body.audio_url)
            with urlopen(validated_url, timeout=10) as response:
                payload = response.read(MAX_AUDIO_BYTES + 1)
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=400, detail="Unable to fetch audio_url")

    if not payload:
        raise HTTPException(status_code=400, detail="Audio payload is empty")
    if len(payload) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail=f"Audio payload exceeds {MAX_AUDIO_BYTES} bytes")
    return payload


def decode_audio(payload: bytes) -> np.ndarray:
    try:
        audio, sample_rate = sf.read(io.BytesIO(payload), dtype="float32", always_2d=False)
    except Exception:
        raise HTTPException(status_code=400, detail="Unable to decode audio payload")

    if isinstance(audio, np.ndarray) and audio.ndim > 1:
        audio = np.mean(audio, axis=1)

    if sample_rate != 16000:
        raise HTTPException(status_code=400, detail=f"Unsupported sample rate {sample_rate}; expected 16000 Hz")

    clipped = np.clip(audio, -1.0, 1.0)
    return (clipped * 32767).astype(np.int16)


def predict_scores(samples: np.ndarray) -> dict[str, float]:
    if MODEL is None:
        return {}
    try:
        predictions = MODEL.predict_clip(samples)
    except Exception as exc:
        logger.exception("openWakeWord inference failed")
        raise HTTPException(status_code=500, detail="openWakeWord inference failed") from exc

    aggregate: dict[str, float] = {}
    for frame in predictions:
        for label, score in frame.items():
            aggregate[label] = max(float(score), aggregate.get(label, 0.0))
    return aggregate


def resolve_target_label(requested_wake_word: str, scores: dict[str, float]) -> str | None:
    normalized_scores = {normalize_phrase(label): label for label in scores.keys()}
    normalized_request = normalize_phrase(requested_wake_word)
    preferred = PHRASE_MAP.get(normalized_request, normalized_request)

    if preferred in normalized_scores:
        return normalized_scores[preferred]

    for normalized_label, original_label in normalized_scores.items():
        if preferred and (preferred in normalized_label or normalized_label in preferred):
            return original_label
    return None


def list_loaded_labels() -> set[str]:
    return set(getattr(MODEL, "models", {}).keys()) if MODEL is not None else set()
