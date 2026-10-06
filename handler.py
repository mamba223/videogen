"""RunPod serverless handler (repo-root entry point so RunPod's GitHub builder can detect it).
Model code lives in gpu-server/inference.py."""
import base64
import os
import sys

# Disable Hugging Face experimental xet background writer which crashes on multi-GB model weights
os.environ["HF_HUB_DISABLE_XET"] = "1"
os.environ["HF_HUB_ENABLE_HF_TRANSFER"] = "0"

# Auto-detect mount with most free space (/runpod-volume, /workspace, or /) and direct HF_HOME / TMPDIR there
import shutil
os.system("df -h")

candidates = ["/runpod-volume", "/workspace", "/tmp", "/"]
best_dir = "/"
max_free = 0
for d in candidates:
    if os.path.exists(d):
        try:
            total, used, free = shutil.disk_usage(d)
            print(f"[Storage] {d}: {total // (1024**3)}GB total, {free // (1024**3)}GB free")
            if free > max_free:
                max_free = free
                best_dir = d
        except Exception:
            pass

cache_dir = os.path.join(best_dir, "hf_cache")
os.makedirs(cache_dir, exist_ok=True)
os.environ["HF_HOME"] = cache_dir
os.environ["TMPDIR"] = cache_dir
print(f"[Storage] Directed HuggingFace cache & TMPDIR to: {cache_dir} ({max_free // (1024**3)}GB available)")

# In the Docker image gpu-server/ is copied to /app; locally it sits next to this file.
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "gpu-server"))

import runpod  # noqa: E402
import inference  # noqa: E402

_loaded_model = None

def ensure_model(model_name: str):
    global _loaded_model
    if _loaded_model != model_name:
        print(f"[Worker] Loading model weights for {model_name}...")
        inference.load(model_name)
        _loaded_model = model_name
        print(f"[Worker] Model {model_name} successfully loaded.")

def handler(job):
    try:
        data = job.get("input", {})
        duration = int(data.get("duration_sec", 5))
        if duration not in (3, 5, 8):
            return {"error": "duration_sec must be 3, 5 or 8"}
        model = data.get("model", "wan-2.1")
        dialogue = data.get("dialogue") or data.get("narration")
        voice = data.get("voice") or data.get("voice_id")
        ensure_model(model)
        mp4 = inference.generate_mp4(
            prompt=data["prompt"],
            duration_sec=duration,
            references=data.get("references"),
            seed=data.get("seed"),
            model=model,
            dialogue=dialogue,
            voice=voice,
        )
        return {"video_base64": base64.b64encode(mp4).decode()}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}

print("[Worker] RunPod serverless handler initialized and listening for jobs...")
runpod.serverless.start({"handler": handler})

