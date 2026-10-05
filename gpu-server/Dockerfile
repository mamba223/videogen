FROM pytorch/pytorch:2.5.1-cuda12.4-cudnn9-runtime

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Weights are loaded at runtime on the GPU worker

COPY . .

# MODE=runpod for RunPod serverless, anything else for the plain HTTP server
ENV MODE=http
CMD ["sh", "-c", "if [ \"$MODE\" = \"runpod\" ]; then python -u runpod_handler.py; else uvicorn server:app --host 0.0.0.0 --port 8000; fi"]
