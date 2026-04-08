# openwakeword-detector

**Wake-word Detection Backend**

Open-source wake-word detector service for Sven. It accepts audio references from the wake-word ingest service, evaluates them with `openWakeWord`, and returns a match decision plus confidence scores. This is intended to replace generic ASR-based hotword matching with a real detector path.

## Port

`4410`

## Dependencies

- Python 3.11
- `openwakeword`
- Optional custom wake-word model files (`.tflite`, `.onnx`, or packaged model paths supported by `openwakeword`)

## Required Environment Variables

One of:

```
OPENWAKEWORD_MODEL_PATHS
OPENWAKEWORD_MODEL_NAMES
```

Optional:

```
OPENWAKEWORD_PORT
OPENWAKEWORD_THRESHOLD
OPENWAKEWORD_PHRASE_MAP
OPENWAKEWORD_MAX_AUDIO_BYTES
OPENWAKEWORD_DEBUG_TOP_K
```

`OPENWAKEWORD_PHRASE_MAP` is a comma-separated alias map, for example:

```bash
OPENWAKEWORD_PHRASE_MAP="hey sven=hey_sven,sven=hey_sven"
```

`OPENWAKEWORD_MODEL_NAMES` resolves model names relative to
`services/openwakeword-detector/models`, so bundled proof or custom models can
be activated without hardcoding absolute paths. Example:

```bash
OPENWAKEWORD_MODEL_NAMES="hey_mycroft_v0.1"
```

For a real Sven wake word, place the exported custom model in
`services/openwakeword-detector/models/` and point either
`OPENWAKEWORD_MODEL_NAMES` or `OPENWAKEWORD_MODEL_PATHS` at it.

### Interim "Hey Sven" Configuration

Until a custom "hey sven" model is trained, the "hey mycroft" model is used
as a stand-in with phrase mapping:

```bash
OPENWAKEWORD_MODEL_NAMES=hey_mycroft_v0.1
OPENWAKEWORD_PHRASE_MAP="hey sven=hey mycroft"
OPENWAKEWORD_THRESHOLD=0.4
```

To train a proper custom model, run:

```bash
python3 scripts/train-hey-sven-wake-model.py --install-to-detector
```

Then switch configuration to:

```bash
OPENWAKEWORD_MODEL_NAMES=hey_sven
OPENWAKEWORD_PHRASE_MAP="hey sven=hey_sven"
```

## Running

```bash
docker compose up -d openwakeword-detector
```

For local development:

```bash
cd services/openwakeword-detector
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 4410
```
