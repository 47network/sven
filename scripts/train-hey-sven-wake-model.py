#!/usr/bin/env python3
"""
Train a custom "hey sven" wake-word model using openWakeWord.

This script uses openwakeword's automated training pipeline to produce a
production-quality model from synthetic speech. The output is an ONNX model
ready to be placed in services/openwakeword-detector/models/.

Prerequisites:
  pip install openwakeword[train] piper-tts mutagen speechbrain

Usage:
  python3 scripts/train-hey-sven-wake-model.py

  # With custom output directory:
  python3 scripts/train-hey-sven-wake-model.py --output-dir /tmp/hey_sven_model

  # With more positive examples for higher quality:
  python3 scripts/train-hey-sven-wake-model.py --n-samples 5000

Environment Variables:
  HEY_SVEN_N_SAMPLES        Number of synthetic positive samples (default: 3000)
  HEY_SVEN_N_NEGATIVE_HOURS Hours of negative data to download (default: 1)
  HEY_SVEN_EPOCHS           Training epochs (default: 50)
  HEY_SVEN_OUTPUT_DIR       Output directory for trained model

After training, copy the output model into the detector:
  cp <output_dir>/hey_sven.onnx services/openwakeword-detector/models/hey_sven.onnx

Then set environment variables:
  OPENWAKEWORD_MODEL_NAMES=hey_sven
  OPENWAKEWORD_PHRASE_MAP="hey sven=hey_sven"
"""

import argparse
import logging
import os
import shutil
import sys
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("train-hey-sven")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DETECTOR_MODELS_DIR = PROJECT_ROOT / "services" / "openwakeword-detector" / "models"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train a custom 'hey sven' wake-word model for openWakeWord.",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=os.getenv("HEY_SVEN_OUTPUT_DIR", str(PROJECT_ROOT / "tmp" / "hey_sven_training")),
        help="Directory for training artifacts and final model.",
    )
    parser.add_argument(
        "--n-samples",
        type=int,
        default=int(os.getenv("HEY_SVEN_N_SAMPLES", "3000")),
        help="Number of synthetic positive samples to generate (default: 3000).",
    )
    parser.add_argument(
        "--n-negative-hours",
        type=float,
        default=float(os.getenv("HEY_SVEN_N_NEGATIVE_HOURS", "1")),
        help="Hours of negative (non-wake-word) audio to use (default: 1).",
    )
    parser.add_argument(
        "--epochs",
        type=int,
        default=int(os.getenv("HEY_SVEN_EPOCHS", "50")),
        help="Training epochs (default: 50).",
    )
    parser.add_argument(
        "--install-to-detector",
        action="store_true",
        default=False,
        help="Copy the trained model into services/openwakeword-detector/models/ after training.",
    )
    return parser.parse_args()


def check_dependencies() -> None:
    """Verify required packages are available before starting."""
    missing = []
    try:
        import openwakeword  # noqa: F401
    except ImportError:
        missing.append("openwakeword")

    try:
        from openwakeword import train as _train  # noqa: F401
    except ImportError:
        missing.append("openwakeword[train]")

    if missing:
        logger.error(
            "Missing required packages: %s. Install with: pip install openwakeword[train] piper-tts mutagen speechbrain",
            ", ".join(missing),
        )
        sys.exit(1)


def generate_positive_samples(output_dir: Path, n_samples: int) -> Path:
    """Generate synthetic positive samples using openwakeword's TTS pipeline."""
    from openwakeword.train import generate_clips

    clips_dir = output_dir / "positive_clips"
    clips_dir.mkdir(parents=True, exist_ok=True)

    phrases = [
        "hey sven",
        "hey Sven",
        "Hey Sven",
        "HEY SVEN",
    ]

    logger.info(
        "Generating %d positive samples for phrases: %s",
        n_samples,
        phrases,
    )

    generate_clips(
        text_input=phrases,
        output_dir=str(clips_dir),
        n_samples=n_samples,
        language="en",
    )

    count = sum(1 for f in clips_dir.iterdir() if f.suffix in (".wav", ".mp3", ".flac", ".ogg"))
    logger.info("Generated %d positive audio clips in %s", count, clips_dir)
    return clips_dir


def download_negative_data(output_dir: Path, hours: float) -> Path:
    """Download negative (background/non-wake-word) audio data."""
    from openwakeword.train import download_negative_data as _download_negative

    negative_dir = output_dir / "negative_data"
    negative_dir.mkdir(parents=True, exist_ok=True)

    logger.info("Downloading %.1f hours of negative audio data…", hours)

    _download_negative(
        output_dir=str(negative_dir),
        n_hours=hours,
    )

    logger.info("Negative data ready in %s", negative_dir)
    return negative_dir


def train_model(
    output_dir: Path,
    positive_dir: Path,
    negative_dir: Path,
    epochs: int,
) -> Path:
    """Train the wake-word model and export to ONNX."""
    from openwakeword.train import train_model as _train_model

    model_dir = output_dir / "trained_model"
    model_dir.mkdir(parents=True, exist_ok=True)

    logger.info(
        "Training hey_sven model (epochs=%d, positive=%s, negative=%s)",
        epochs,
        positive_dir,
        negative_dir,
    )

    _train_model(
        model_name="hey_sven",
        positive_clips_dir=str(positive_dir),
        negative_clips_dir=str(negative_dir),
        output_dir=str(model_dir),
        epochs=epochs,
    )

    # Find the output ONNX file
    onnx_files = list(model_dir.rglob("*.onnx"))
    if not onnx_files:
        logger.error("Training completed but no ONNX model was produced in %s", model_dir)
        sys.exit(1)

    model_path = onnx_files[0]
    logger.info("Trained model: %s", model_path)
    return model_path


def install_model(model_path: Path) -> Path:
    """Copy the trained model to the detector's models directory."""
    dest = DETECTOR_MODELS_DIR / "hey_sven.onnx"
    DETECTOR_MODELS_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(str(model_path), str(dest))
    logger.info("Installed model to %s", dest)
    return dest


def main() -> None:
    args = parse_args()
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    logger.info("Training configuration:")
    logger.info("  output_dir:       %s", output_dir)
    logger.info("  n_samples:        %d", args.n_samples)
    logger.info("  n_negative_hours: %.1f", args.n_negative_hours)
    logger.info("  epochs:           %d", args.epochs)
    logger.info("  install_to_detector: %s", args.install_to_detector)

    check_dependencies()

    positive_dir = generate_positive_samples(output_dir, args.n_samples)
    negative_dir = download_negative_data(output_dir, args.n_negative_hours)
    model_path = train_model(output_dir, positive_dir, negative_dir, args.epochs)

    final_onnx = output_dir / "hey_sven.onnx"
    shutil.copy2(str(model_path), str(final_onnx))
    logger.info("Final model: %s", final_onnx)

    if args.install_to_detector:
        install_model(final_onnx)

    logger.info("Training complete.")
    logger.info("")
    logger.info("Next steps:")
    logger.info("  1. Copy model:  cp %s services/openwakeword-detector/models/hey_sven.onnx", final_onnx)
    logger.info("  2. Set env:     OPENWAKEWORD_MODEL_NAMES=hey_sven")
    logger.info("  3. Set env:     OPENWAKEWORD_PHRASE_MAP=\"hey sven=hey_sven\"")
    logger.info("  4. Restart:     docker compose up -d openwakeword-detector")
    logger.info("  5. Test:        curl http://localhost:4410/healthz")


if __name__ == "__main__":
    main()
