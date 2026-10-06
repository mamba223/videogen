"""RunPod serverless handler. Use with GPU_PROVIDER=runpod."""
import base64

import runpod

import inference

inference.load()  # load weights once per worker, not per job


def handler(job):
    data = job["input"]
    duration = int(data.get("duration_sec", 5))
    if duration not in (3, 5, 8):
        return {"error": "duration_sec must be 3, 5 or 8"}
    model = data.get("model", "wan-2.1")
    dialogue = data.get("dialogue") or data.get("narration")
    voice = data.get("voice") or data.get("voice_id")
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


runpod.serverless.start({"handler": handler})
