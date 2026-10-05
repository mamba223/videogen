"""RunPod serverless handler (repo-root entry point so RunPod's GitHub builder can detect it).
Model code lives in gpu-server/inference.py."""
import base64
import os
import sys

# In the Docker image gpu-server/ is copied to /app; locally it sits next to this file.
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "gpu-server"))

import runpod  # noqa: E402

import inference  # noqa: E402

inference.load()  # load weights once per worker, not per job


def handler(job):
    data = job["input"]
    duration = int(data.get("duration_sec", 5))
    if duration not in (3, 5, 8):
        return {"error": "duration_sec must be 3, 5 or 8"}
    model = data.get("model", "wan-2.1")
    mp4 = inference.generate_mp4(
        prompt=data["prompt"],
        duration_sec=duration,
        references=data.get("references"),
        seed=data.get("seed"),
        model=model,
    )
    return {"video_base64": base64.b64encode(mp4).decode()}


runpod.serverless.start({"handler": handler})
