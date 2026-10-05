# Root-level Dockerfile so RunPod's "Import Git Repository" builder finds it.
# Builds the GPU video-generation worker from ./gpu-server as a RunPod serverless handler.
FROM pytorch/pytorch:2.4.0-cuda12.1-cudnn9-runtime

WORKDIR /app
COPY gpu-server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Bake the weights into the image so cold starts don't download weights at runtime
RUN python -c "from diffusers import WanPipeline; WanPipeline.from_pretrained('Wan-AI/Wan2.1-T2V-1.3B')"

COPY gpu-server/ .
COPY handler.py .

# Serverless handler (not the plain HTTP server)
ENV MODE=runpod
CMD ["python", "-u", "handler.py"]
