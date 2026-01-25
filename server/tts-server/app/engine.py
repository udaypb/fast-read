import os
import platform
import sys
from pathlib import Path

import torch
import soundfile as sf

BASE_DIR = Path(__file__).resolve().parent.parent
VENDOR_DIR = BASE_DIR / "vendor" / "Spark-TTS"
DEFAULT_MODEL_DIR = BASE_DIR / "pretrained_models" / "Spark-TTS-0.5B"
MODEL_DIR = Path(os.environ.get("SPARK_TTS_MODEL_DIR", str(DEFAULT_MODEL_DIR)))

if not VENDOR_DIR.is_dir():
    raise RuntimeError(
        "Spark-TTS code not found. Clone https://github.com/SparkAudio/Spark-TTS "
        f"into {VENDOR_DIR}."
    )

sys.path.insert(0, str(VENDOR_DIR))

from cli.SparkTTS import SparkTTS  # noqa: E402


def _resolve_device() -> torch.device:
    if platform.system() == "Darwin" and torch.backends.mps.is_available():
        return torch.device("mps")
    if torch.cuda.is_available():
        return torch.device("cuda:0")
    return torch.device("cpu")


DEVICE = _resolve_device()
print(f"Spark-TTS using device: {DEVICE}")

if not (MODEL_DIR / "config.yaml").is_file():
    raise RuntimeError(
        "Spark-TTS model files not found. Download the Hugging Face weights into "
        f"{DEFAULT_MODEL_DIR} (or set SPARK_TTS_MODEL_DIR to the model folder)."
    )

MODEL = SparkTTS(str(MODEL_DIR), DEVICE)
SAMPLE_RATE = MODEL.sample_rate

DEFAULT_GENDER = os.environ.get("SPARK_TTS_DEFAULT_GENDER", "female")
DEFAULT_PITCH = os.environ.get("SPARK_TTS_DEFAULT_PITCH", "moderate")
DEFAULT_SPEED = os.environ.get("SPARK_TTS_DEFAULT_SPEED", "moderate")


def generate_audio(
    text: str,
    output_path: str,
    prompt_speech_path: str | None = None,
    prompt_text: str | None = None,
    gender: str | None = None,
    pitch: str | None = None,
    speed: str | None = None,
):
    if prompt_speech_path:
        wav = MODEL.inference(
            text,
            prompt_speech_path=prompt_speech_path,
            prompt_text=prompt_text,
        )
    else:
        wav = MODEL.inference(
            text,
            gender=gender or DEFAULT_GENDER,
            pitch=pitch or DEFAULT_PITCH,
            speed=speed or DEFAULT_SPEED,
        )

    sf.write(output_path, wav, samplerate=SAMPLE_RATE)
    return output_path
