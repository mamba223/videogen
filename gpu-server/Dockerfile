FROM pytorch/pytorch:2.4.0-cuda12.1-cudnn9-runtime

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Bake the weights into the image so cold starts don't download weights at runtime
RUN python -c "from diffusers import WanPipeline; WanPipeline.from_pretrained('Wan-AI/Wan2.1-T2V-1.3B')"

COPY . .

# MODE=runpod for RunPod serverless, anything else for the plain HTTP server
ENV MODE=http
CMD ["sh", "-c", "if [ \"$MODE\" = \"runpod\" ]; then python -u runpod_handler.py; else uvicorn server:app --host 0.0.0.0 --port 8000; fi"]
