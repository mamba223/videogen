"""Plain HTTP GPU server (Vast.ai, a rented VM, your own box). Use with GPU_PROVIDER=http."""
import os

from fastapi import FastAPI, Header, HTTPException, Response
from pydantic import BaseModel, Field

import inference

API_KEY = os.getenv("GPU_API_KEY", "")
app = FastAPI()


class GenerateRequest(BaseModel):
    prompt: str = Field(min_length=3, max_length=2000)
    duration_sec: int = 5
    references: list[str] = []
    seed: int | None = None
    model: str = "wan-2.1"


@app.on_event("startup")
def warm():
    inference.load()


@app.get("/health")
def health():
    return {"ok": True, "active_model": inference.MODEL_FAMILY}


@app.get("/models")
def list_models():
    return {
        "models": [
            {"id": "ltx-video", "name": "LTX-Video", "developer": "Lightricks", "fast": True},
            {"id": "wan-2.1", "name": "Wan 2.1 (1.3B/14B)", "developer": "Alibaba", "photorealistic": True},
            {"id": "hunyuan", "name": "HunyuanVideo (13B)", "developer": "Tencent", "hd": True},
            {"id": "cogvideox", "name": "CogVideoX (2B/5B)", "developer": "THUDM / Zhipu AI"},
        ]
    }


@app.post("/generate")
def generate(req: GenerateRequest, authorization: str | None = Header(default=None)):
    if API_KEY and authorization != f"Bearer {API_KEY}":
        raise HTTPException(status_code=401, detail="unauthorized")
    if req.duration_sec not in (3, 5, 8):
        raise HTTPException(status_code=400, detail="duration_sec must be 3, 5 or 8")
    mp4 = inference.generate_mp4(
        prompt=req.prompt,
        duration_sec=req.duration_sec,
        references=req.references,
        seed=req.seed,
        model=req.model
    )
    return Response(content=mp4, media_type="video/mp4")
