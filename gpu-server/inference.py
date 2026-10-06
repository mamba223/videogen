"""Multi-Model GPU Video Inference Pipeline.
Supports open-source video generation models:
1. LTX-Video (Lightricks) - Fast real-time inference (default)
2. Wan 2.1 (Alibaba) - State-of-the-art cinematic motion & photorealism (1.3B / 14B)
3. HunyuanVideo (Tencent) - 13B parameter high-definition 3D video transformer
4. CogVideoX (THUDM / Zhipu AI) - 3D VAE video diffusion (2B / 5B)

Shared by the HTTP server (Vast.ai, self-hosted GPU) and RunPod serverless handler.
"""
import os
os.environ["HF_HUB_DISABLE_XET"] = "1"
os.environ["HF_HUB_ENABLE_HF_TRANSFER"] = "0"

import tempfile
import threading
import torch

from diffusers.utils import export_to_video, load_image

# Primary model family: wan-2.1 (Flagship cinematic diffusion transformer)
MODEL_FAMILY = os.getenv("MODEL_FAMILY", "wan-2.1").lower()
MODEL_ID = os.getenv("MODEL_ID", "")
STEPS = int(os.getenv("INFERENCE_STEPS", "30"))
WIDTH = int(os.getenv("WIDTH", "704"))   # must be divisible by 32
HEIGHT = int(os.getenv("HEIGHT", "480"))  # must be divisible by 32
FPS = int(os.getenv("FPS", "24"))
NEGATIVE = "worst quality, inconsistent motion, blurry, jittery, distorted, watermark, text, low resolution"

_pipeline = None
_i2v_pipeline = None
_gpu_lock = threading.Lock()  # one generation at a time per GPU


def get_default_model_id(family: str) -> str:
    defaults = {
        "wan-2.1": "Wan-AI/Wan2.1-T2V-1.3B-Diffusers",
        "ltx-video": "Lightricks/LTX-Video",
        "hunyuan": "tencent/HunyuanVideo",
        "cogvideox": "THUDM/CogVideoX-5b",
    }
    return defaults.get(family, "Wan-AI/Wan2.1-T2V-1.3B-Diffusers")


def load(model_family: str = MODEL_FAMILY):
    """Loads the model pipeline on startup or on demand."""
    global _pipeline, _i2v_pipeline, MODEL_FAMILY
    if _pipeline is not None and model_family == MODEL_FAMILY:
        return

    MODEL_FAMILY = model_family
    target_id = MODEL_ID or get_default_model_id(model_family)
    print(f"[Inference] Loading {model_family} pipeline from {target_id}...")

    # 1. LTX-Video
    if model_family in ("ltx-video", "ltx"):
        from diffusers import LTXImageToVideoPipeline, LTXPipeline
        _pipeline = LTXPipeline.from_pretrained(target_id, torch_dtype=torch.bfloat16).to("cuda")
        try:
            _i2v_pipeline = LTXImageToVideoPipeline.from_pipe(_pipeline)
        except Exception:
            _i2v_pipeline = None

    # 2. Wan 2.1 (Alibaba)
    elif model_family in ("wan-2.1", "wan", "wan-1.3b", "wan-14b"):
        try:
            from diffusers import WanImageToVideoPipeline, WanPipeline
            _pipeline = WanPipeline.from_pretrained(target_id, torch_dtype=torch.bfloat16).to("cuda")
            try:
                _i2v_pipeline = WanImageToVideoPipeline.from_pretrained(
                    "Wan-AI/Wan2.1-I2V-14B-480P-Diffusers" if "14B" in target_id else target_id,
                    torch_dtype=torch.bfloat16
                ).to("cuda")
            except Exception:
                _i2v_pipeline = None
        except ImportError:
            print("[Inference WARN] WanPipeline requires diffusers>=0.33. Falling back to LTX-Video.")
            from diffusers import LTXPipeline
            _pipeline = LTXPipeline.from_pretrained("Lightricks/LTX-Video", torch_dtype=torch.bfloat16).to("cuda")

    # 3. HunyuanVideo (Tencent)
    elif model_family in ("hunyuan", "hunyuanvideo"):
        try:
            from diffusers import HunyuanVideoPipeline
            _pipeline = HunyuanVideoPipeline.from_pretrained(target_id, torch_dtype=torch.bfloat16).to("cuda")
            _i2v_pipeline = None
        except ImportError:
            print("[Inference WARN] HunyuanVideo requires diffusers>=0.33. Falling back to LTX-Video.")
            from diffusers import LTXPipeline
            _pipeline = LTXPipeline.from_pretrained("Lightricks/LTX-Video", torch_dtype=torch.bfloat16).to("cuda")

    # 4. CogVideoX (THUDM / Zhipu AI)
    elif model_family in ("cogvideox", "cogvideo"):
        from diffusers import CogVideoXImageToVideoPipeline, CogVideoXPipeline
        _pipeline = CogVideoXPipeline.from_pretrained(target_id, torch_dtype=torch.bfloat16).to("cuda")
        try:
            _i2v_pipeline = CogVideoXImageToVideoPipeline.from_pretrained(
                "THUDM/CogVideoX-5b-I2V" if "5b" in target_id else target_id,
                torch_dtype=torch.bfloat16
            ).to("cuda")
        except Exception:
            _i2v_pipeline = None

    else:
        # Fallback
        from diffusers import LTXPipeline
        _pipeline = LTXPipeline.from_pretrained("Lightricks/LTX-Video", torch_dtype=torch.bfloat16).to("cuda")

    # Enable memory savings if running on single GPU
    if hasattr(_pipeline, "enable_model_cpu_offload"):
        try:
            _pipeline.enable_model_cpu_offload()
        except Exception:
            pass


def generate_mp4(
    prompt: str,
    duration_sec: int = 5,
    references=None,
    seed=None,
    model: str = "wan-2.1"
) -> bytes:
    load(model)
    generator = torch.Generator("cuda").manual_seed(int(seed)) if seed is not None else None

    # Calculate frame counts according to model architecture
    if MODEL_FAMILY in ("ltx-video", "ltx"):
        fps = 24
        num_frames = (int(duration_sec * fps) // 8) * 8 + 1  # LTX needs 8k+1 frames
    elif MODEL_FAMILY in ("wan-2.1", "wan", "wan-1.3b"):
        fps = FPS
        num_frames = int(duration_sec * fps)
    elif MODEL_FAMILY in ("hunyuan", "hunyuanvideo"):
        fps = 24
        num_frames = (int(duration_sec * fps) // 4) * 4 + 1
    elif MODEL_FAMILY in ("cogvideox", "cogvideo"):
        fps = 8
        num_frames = int(duration_sec * fps)
    else:
        fps = 24
        num_frames = int(duration_sec * fps)

    common = dict(
        prompt=prompt,
        negative_prompt=NEGATIVE,
        width=WIDTH,
        height=HEIGHT,
        num_frames=num_frames,
        num_inference_steps=STEPS,
        generator=generator,
    )

    with _gpu_lock:
        if references and _i2v_pipeline is not None:
            # First reference image conditions initial frame for character & location consistency
            out = _i2v_pipeline(image=load_image(references[0]), **common)
        else:
            out = _pipeline(**common)

        fd, path = tempfile.mkstemp(suffix=".mp4")
        os.close(fd)
        try:
            export_to_video(out.frames[0], path, fps=fps)
            with open(path, "rb") as f:
                return f.read()
        finally:
            if os.path.exists(path):
                os.remove(path)
