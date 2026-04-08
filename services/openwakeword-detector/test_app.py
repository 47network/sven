"""Tests for the openwakeword-detector FastAPI service.

Covers all pure utility functions and the HTTP endpoints with a mocked Model.
"""

import io
import base64
from unittest.mock import MagicMock, patch

import numpy as np
import pytest
import soundfile as sf
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# normalize_phrase
# ---------------------------------------------------------------------------

class TestNormalizePhrase:
    """Tests for normalize_phrase(value)."""

    def test_lowercases_and_strips(self):
        from app import normalize_phrase
        assert normalize_phrase("  Hey Sven  ") == "hey sven"

    def test_removes_punctuation(self):
        from app import normalize_phrase
        assert normalize_phrase("Hey, Sven!") == "hey sven"

    def test_collapses_whitespace(self):
        from app import normalize_phrase
        assert normalize_phrase("hey   sven") == "hey sven"

    def test_none_returns_empty(self):
        from app import normalize_phrase
        assert normalize_phrase(None) == ""

    def test_empty_string_returns_empty(self):
        from app import normalize_phrase
        assert normalize_phrase("") == ""

    def test_numeric_characters_preserved(self):
        from app import normalize_phrase
        assert normalize_phrase("Agent 47") == "agent 47"

    def test_special_symbols_stripped(self):
        from app import normalize_phrase
        assert normalize_phrase("hey@sven#123") == "hey sven 123"


# ---------------------------------------------------------------------------
# parse_model_paths
# ---------------------------------------------------------------------------

class TestParseModelPaths:
    """Tests for parse_model_paths(raw)."""

    def test_single_path(self):
        from app import parse_model_paths
        assert parse_model_paths("/opt/models/hey_sven.onnx") == ["/opt/models/hey_sven.onnx"]

    def test_multiple_paths(self):
        from app import parse_model_paths
        result = parse_model_paths("/a.onnx, /b.tflite")
        assert result == ["/a.onnx", "/b.tflite"]

    def test_none_returns_empty(self):
        from app import parse_model_paths
        assert parse_model_paths(None) == []

    def test_empty_string_returns_empty(self):
        from app import parse_model_paths
        assert parse_model_paths("") == []

    def test_whitespace_only_returns_empty(self):
        from app import parse_model_paths
        assert parse_model_paths("   ,  , ") == []

    def test_strips_entries(self):
        from app import parse_model_paths
        result = parse_model_paths("  /a.onnx ,  /b.onnx  ")
        assert result == ["/a.onnx", "/b.onnx"]


# ---------------------------------------------------------------------------
# parse_model_names
# ---------------------------------------------------------------------------

class TestParseModelNames:
    """Tests for parse_model_names(raw)."""

    def test_single_name(self):
        from app import parse_model_names
        assert parse_model_names("hey_mycroft_v0.1") == ["hey_mycroft_v0.1"]

    def test_multiple_names(self):
        from app import parse_model_names
        result = parse_model_names("hey_mycroft_v0.1, alexa")
        assert result == ["hey_mycroft_v0.1", "alexa"]

    def test_none_returns_empty(self):
        from app import parse_model_names
        assert parse_model_names(None) == []


# ---------------------------------------------------------------------------
# parse_phrase_map
# ---------------------------------------------------------------------------

class TestParsePhraseMap:
    """Tests for parse_phrase_map(raw)."""

    def test_single_mapping(self):
        from app import parse_phrase_map
        result = parse_phrase_map("hey sven=hey mycroft")
        assert result == {"hey sven": "hey mycroft"}

    def test_multiple_mappings(self):
        from app import parse_phrase_map
        result = parse_phrase_map("hey sven=hey mycroft, ok sven=hey jarvis")
        assert result == {"hey sven": "hey mycroft", "ok sven": "hey jarvis"}

    def test_normalizes_keys_and_values(self):
        from app import parse_phrase_map
        result = parse_phrase_map(" Hey  Sven = Hey  Mycroft ")
        assert result == {"hey sven": "hey mycroft"}

    def test_none_returns_empty(self):
        from app import parse_phrase_map
        assert parse_phrase_map(None) == {}

    def test_empty_string_returns_empty(self):
        from app import parse_phrase_map
        assert parse_phrase_map("") == {}

    def test_skips_entries_without_equals(self):
        from app import parse_phrase_map
        result = parse_phrase_map("hey sven=hey mycroft, bad entry, ok sven=alexa")
        assert result == {"hey sven": "hey mycroft", "ok sven": "alexa"}

    def test_skips_entries_with_empty_key_or_value(self):
        from app import parse_phrase_map
        result = parse_phrase_map("=value, key=")
        assert result == {}


# ---------------------------------------------------------------------------
# resolve_target_label
# ---------------------------------------------------------------------------

class TestResolveTargetLabel:
    """Tests for resolve_target_label(requested_wake_word, scores)."""

    def test_exact_normalized_match(self):
        from app import resolve_target_label
        scores = {"hey_mycroft_v0.1": 0.8, "alexa_v0.1": 0.3}
        # When PHRASE_MAP maps "hey sven" → "hey mycroft", the normalized
        # comparison should find "hey_mycroft_v0.1" via substring match.
        # But for this unit test we test direct match without phrase map.
        result = resolve_target_label("hey_mycroft_v0.1", scores)
        assert result == "hey_mycroft_v0.1"

    def test_partial_substring_match(self):
        from app import resolve_target_label
        scores = {"hey_mycroft_v0.1": 0.8}
        result = resolve_target_label("hey mycroft", scores)
        # normalize_phrase("hey_mycroft_v0.1") = "hey mycroft v0 1"
        # normalize_phrase("hey mycroft") = "hey mycroft"
        # "hey mycroft" is in "hey mycroft v0 1" → match
        assert result == "hey_mycroft_v0.1"

    def test_no_match_returns_none(self):
        from app import resolve_target_label
        scores = {"alexa_v0.1": 0.8}
        result = resolve_target_label("hey sven", scores)
        # Without a phrase map entry at module level, this should not match
        # "alexa_v0.1" because "hey sven" has no substring overlap with "alexa v0 1"
        assert result is None

    def test_empty_scores_returns_none(self):
        from app import resolve_target_label
        result = resolve_target_label("hey sven", {})
        assert result is None


# ---------------------------------------------------------------------------
# Audio decoding helpers
# ---------------------------------------------------------------------------

def _make_wav_base64(duration_seconds: float = 0.1, sample_rate: int = 16000) -> str:
    """Generate a valid 16kHz mono WAV as base64."""
    samples = np.zeros(int(sample_rate * duration_seconds), dtype=np.float32)
    buf = io.BytesIO()
    sf.write(buf, samples, sample_rate, format="WAV")
    return base64.b64encode(buf.getvalue()).decode("ascii")


def _make_wav_bytes(duration_seconds: float = 0.1, sample_rate: int = 16000) -> bytes:
    """Generate valid 16kHz mono WAV bytes."""
    samples = np.zeros(int(sample_rate * duration_seconds), dtype=np.float32)
    buf = io.BytesIO()
    sf.write(buf, samples, sample_rate, format="WAV")
    return buf.getvalue()


# ---------------------------------------------------------------------------
# resolve_audio_bytes
# ---------------------------------------------------------------------------

class TestResolveAudioBytes:
    """Tests for resolve_audio_bytes(body)."""

    def test_base64_payload(self):
        from app import resolve_audio_bytes, DetectRequest
        wav_b64 = _make_wav_base64()
        body = DetectRequest(wake_word="hey sven", audio_base64=wav_b64)
        result = resolve_audio_bytes(body)
        assert len(result) > 0

    def test_base64_with_data_uri_prefix(self):
        from app import resolve_audio_bytes, DetectRequest
        wav_b64 = _make_wav_base64()
        body = DetectRequest(
            wake_word="hey sven",
            audio_base64=f"data:audio/wav;base64,{wav_b64}",
        )
        result = resolve_audio_bytes(body)
        assert len(result) > 0

    def test_invalid_base64_raises_400(self):
        from app import resolve_audio_bytes, DetectRequest
        from fastapi import HTTPException
        body = DetectRequest(wake_word="hey sven", audio_base64="!!!invalid!!!")
        with pytest.raises(HTTPException) as exc_info:
            resolve_audio_bytes(body)
        assert exc_info.value.status_code == 400


# ---------------------------------------------------------------------------
# decode_audio
# ---------------------------------------------------------------------------

class TestDecodeAudio:
    """Tests for decode_audio(payload)."""

    def test_valid_16k_wav(self):
        from app import decode_audio
        payload = _make_wav_bytes(duration_seconds=0.1, sample_rate=16000)
        result = decode_audio(payload)
        assert isinstance(result, np.ndarray)
        assert result.dtype == np.int16

    def test_wrong_sample_rate_raises_400(self):
        from app import decode_audio
        from fastapi import HTTPException
        payload = _make_wav_bytes(duration_seconds=0.1, sample_rate=44100)
        with pytest.raises(HTTPException) as exc_info:
            decode_audio(payload)
        assert exc_info.value.status_code == 400
        assert "16000" in str(exc_info.value.detail)

    def test_invalid_audio_raises_400(self):
        from app import decode_audio
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            decode_audio(b"not audio data")
        assert exc_info.value.status_code == 400

    def test_stereo_downmixed_to_mono(self):
        from app import decode_audio
        stereo = np.zeros((1600, 2), dtype=np.float32)
        buf = io.BytesIO()
        sf.write(buf, stereo, 16000, format="WAV")
        result = decode_audio(buf.getvalue())
        assert result.ndim == 1


# ---------------------------------------------------------------------------
# predict_scores
# ---------------------------------------------------------------------------

class TestPredictScores:
    """Tests for predict_scores(samples)."""

    def test_returns_empty_when_model_is_none(self):
        import app as app_module
        original = app_module.MODEL
        try:
            app_module.MODEL = None
            result = app_module.predict_scores(np.zeros(1600, dtype=np.int16))
            assert result == {}
        finally:
            app_module.MODEL = original

    def test_aggregates_max_across_frames(self):
        import app as app_module
        mock_model = MagicMock()
        mock_model.predict_clip.return_value = [
            {"hey_mycroft_v0.1": 0.3, "alexa_v0.1": 0.9},
            {"hey_mycroft_v0.1": 0.7, "alexa_v0.1": 0.5},
        ]
        original = app_module.MODEL
        try:
            app_module.MODEL = mock_model
            result = app_module.predict_scores(np.zeros(1600, dtype=np.int16))
            assert result["hey_mycroft_v0.1"] == pytest.approx(0.7)
            assert result["alexa_v0.1"] == pytest.approx(0.9)
        finally:
            app_module.MODEL = original


# ---------------------------------------------------------------------------
# /healthz endpoint
# ---------------------------------------------------------------------------

class TestHealthzEndpoint:
    """Tests for GET /healthz."""

    def test_returns_success(self):
        from app import app
        client = TestClient(app)
        response = client.get("/healthz")
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert "loaded_models" in body
        assert "model_ready" in body


# ---------------------------------------------------------------------------
# /v1/detect endpoint
# ---------------------------------------------------------------------------

class TestDetectEndpoint:
    """Tests for POST /v1/detect with mocked Model."""

    def test_missing_audio_returns_400(self):
        from app import app
        client = TestClient(app)
        response = client.post("/v1/detect", json={
            "wake_word": "hey sven",
        })
        assert response.status_code == 400

    def test_detect_with_base64_and_mocked_model(self):
        import app as app_module
        mock_model = MagicMock()
        mock_model.predict_clip.return_value = [
            {"hey_mycroft_v0.1": 0.85},
        ]
        original = app_module.MODEL
        try:
            app_module.MODEL = mock_model
            client = TestClient(app_module.app)
            wav_b64 = _make_wav_base64(duration_seconds=0.5)
            response = client.post("/v1/detect", json={
                "wake_word": "hey_mycroft_v0.1",
                "audio_base64": wav_b64,
                "threshold": 0.5,
            })
            assert response.status_code == 200
            body = response.json()
            assert body["success"] is True
            assert body["data"]["detected"] is True
            assert body["data"]["confidence"] == pytest.approx(0.85)
            assert body["data"]["matched_label"] == "hey_mycroft_v0.1"
        finally:
            app_module.MODEL = original

    def test_detect_below_threshold_not_detected(self):
        import app as app_module
        mock_model = MagicMock()
        mock_model.predict_clip.return_value = [
            {"hey_mycroft_v0.1": 0.2},
        ]
        original = app_module.MODEL
        try:
            app_module.MODEL = mock_model
            client = TestClient(app_module.app)
            wav_b64 = _make_wav_base64(duration_seconds=0.5)
            response = client.post("/v1/detect", json={
                "wake_word": "hey_mycroft_v0.1",
                "audio_base64": wav_b64,
                "threshold": 0.5,
            })
            assert response.status_code == 200
            body = response.json()
            assert body["data"]["detected"] is False
            assert body["data"]["matched_label"] is None
        finally:
            app_module.MODEL = original

    def test_detect_returns_top_scores(self):
        import app as app_module
        mock_model = MagicMock()
        mock_model.predict_clip.return_value = [
            {"hey_mycroft_v0.1": 0.85, "alexa": 0.1},
        ]
        original = app_module.MODEL
        try:
            app_module.MODEL = mock_model
            client = TestClient(app_module.app)
            wav_b64 = _make_wav_base64(duration_seconds=0.5)
            response = client.post("/v1/detect", json={
                "wake_word": "hey_mycroft_v0.1",
                "audio_base64": wav_b64,
            })
            body = response.json()
            top_scores = body["data"]["top_scores"]
            assert isinstance(top_scores, list)
            assert len(top_scores) >= 1
            assert top_scores[0]["label"] == "hey_mycroft_v0.1"
        finally:
            app_module.MODEL = original

    def test_detect_no_model_returns_not_detected(self):
        import app as app_module
        original = app_module.MODEL
        try:
            app_module.MODEL = None
            client = TestClient(app_module.app)
            wav_b64 = _make_wav_base64(duration_seconds=0.5)
            response = client.post("/v1/detect", json={
                "wake_word": "hey sven",
                "audio_base64": wav_b64,
            })
            assert response.status_code == 200
            body = response.json()
            assert body["data"]["detected"] is False
            assert body["data"]["model_ready"] is False
        finally:
            app_module.MODEL = original

    def test_empty_base64_returns_400(self):
        from app import app
        client = TestClient(app)
        response = client.post("/v1/detect", json={
            "wake_word": "hey sven",
            "audio_base64": "",
        })
        assert response.status_code == 400

    def test_payload_too_large_returns_413(self):
        import app as app_module
        original_max = app_module.MAX_AUDIO_BYTES
        try:
            app_module.MAX_AUDIO_BYTES = 100
            client = TestClient(app_module.app)
            wav_b64 = _make_wav_base64(duration_seconds=1.0)
            response = client.post("/v1/detect", json={
                "wake_word": "hey sven",
                "audio_base64": wav_b64,
            })
            assert response.status_code == 413
        finally:
            app_module.MAX_AUDIO_BYTES = original_max
