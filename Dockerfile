# Root-level Dockerfile so RunPod's "Import Git Repository" builder finds it.
# Builds the GPU video-generation worker from ./gpu-server as a RunPod serverless handler.
FROM pytorch/pytorch:2.5.1-cuda12.4-cudnn9-runtime

WORKDIR /app
COPY gpu-server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Dependencies are installed; weights will be loaded and cached at runtime on the GPU worker

COPY gpu-server/ .
COPY handler.py .

# Serverless handler (not the plain HTTP server)
ENV MODE=runpod
CMD ["python", "-u", "handler.py"]
