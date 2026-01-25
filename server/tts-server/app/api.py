from typing import Optional

from fastapi import FastAPI
from fastapi.responses import FileResponse
from pydantic import BaseModel
import uuid
import os

from .engine import generate_audio

app = FastAPI(title="Spark-TTS Local Service")

OUTPUT_DIR = "generated_audio"
os.makedirs(OUTPUT_DIR, exist_ok=True)


class TTSRequest(BaseModel):
    text: str
    prompt_speech_path: Optional[str] = None
    prompt_text: Optional[str] = None
    gender: Optional[str] = None
    pitch: Optional[str] = None
    speed: Optional[str] = None


@app.post("/tts")
def tts(req: TTSRequest):
    file_id = str(uuid.uuid4())
    path = f"{OUTPUT_DIR}/{file_id}.wav"

    generate_audio(
        req.text,
        path,
        prompt_speech_path=req.prompt_speech_path,
        prompt_text=req.prompt_text,
        gender=req.gender,
        pitch=req.pitch,
        speed=req.speed,
    )

    return FileResponse(
        path,
        media_type="audio/wav",
        filename="speech.wav",
    )
