"""Self-hosted Lip-Sync & Character Speech Engine.
Generates speech audio from dialogue text via edge-tts,
detects faces in generated video, warps mouth to match speech phonemes (Wav2Lip),
and muxes speech audio into the final output MP4.
"""
import asyncio
import os
import subprocess
import tempfile
import wave
import cv2
import numpy as np
import torch
import torch.nn as nn
from huggingface_hub import hf_hub_download
import imageio_ffmpeg
import edge_tts
import librosa

# ----------------- 1. Neural Text-To-Speech (TTS) -----------------
VOICE_MAP = {
    # ReelForge Frontend Presets
    "james-cinematic": "en-US-ChristopherNeural",  # Deep, resonant cinematic narrator
    "eleanor-fantasy": "en-GB-SoniaNeural",        # Refined British fantasy storyteller
    "echo-scifi": "en-US-EricNeural",              # Analytical sci-fi terminal
    "marcus-action": "en-US-GuyNeural",            # Dynamic action narrator
    "aria-ambient": "en-US-AriaNeural",            # Warm, intimate documentary
    "clara-classic": "en-US-JennyNeural",          # Clear, balanced documentary
    # Aliases & Fallbacks
    "marcus-noir": "en-US-GuyNeural",
    "eleanor-period": "en-GB-SoniaNeural",
    "james-trailer": "en-US-ChristopherNeural",
    "default": "en-US-AriaNeural",
}

async def _synth_tts(text: str, voice_name: str, out_wav: str):
    temp_mp3 = out_wav + ".mp3"
    communicate = edge_tts.Communicate(text, voice_name)
    await communicate.save(temp_mp3)
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    subprocess.run(
        [ffmpeg_exe, "-y", "-i", temp_mp3, "-ar", "16000", "-ac", "1", out_wav],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=True,
    )
    if os.path.exists(temp_mp3):
        os.remove(temp_mp3)

def generate_speech(text: str, voice_id: str = "aria-ambient") -> str:
    """Generates a 16kHz mono WAV file from text dialogue using neural TTS."""
    voice = VOICE_MAP.get(voice_id, VOICE_MAP["default"])
    fd, out_wav = tempfile.mkstemp(suffix=".wav")
    os.close(fd)

    # Safe execution inside or outside existing asyncio event loops (e.g. FastAPI/Uvicorn)
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(lambda: asyncio.run(_synth_tts(text, voice, out_wav)))
            future.result()
    else:
        asyncio.run(_synth_tts(text, voice, out_wav))

    return out_wav

def get_audio_duration(wav_path: str) -> float:
    """Returns the duration of a WAV file in seconds."""
    try:
        with wave.open(wav_path, "rb") as f:
            frames = f.getnframes()
            rate = f.getframerate()
            return frames / float(rate)
    except Exception:
        y, sr = librosa.load(wav_path, sr=None)
        return len(y) / float(sr)


# ----------------- 2. Wav2Lip Model Architecture -----------------
class Conv2d(nn.Module):
    def __init__(self, cin, cout, kernel_size, stride, padding, residual=False, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.conv_block = nn.Sequential(
            nn.Conv2d(cin, cout, kernel_size, stride, padding),
            nn.BatchNorm2d(cout)
        )
        self.act = nn.ReLU()
        self.residual = residual

    def forward(self, x):
        out = self.conv_block(x)
        if self.residual:
            out = out + x
        return self.act(out)

class Conv2dTranspose(nn.Module):
    def __init__(self, cin, cout, kernel_size, stride, padding, output_padding=0, residual=False, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.conv_block = nn.Sequential(
            nn.ConvTranspose2d(cin, cout, kernel_size, stride, padding, output_padding=output_padding),
            nn.BatchNorm2d(cout)
        )
        self.act = nn.ReLU()
        self.residual = residual

    def forward(self, x):
        out = self.conv_block(x)
        if self.residual:
            out = out + x
        return self.act(out)

class Wav2Lip(nn.Module):
    def __init__(self):
        super().__init__()
        self.face_encoder_blocks = nn.ModuleList([
            nn.Sequential(Conv2d(6, 16, kernel_size=7, stride=1, padding=3)),
            nn.Sequential(Conv2d(16, 32, kernel_size=3, stride=2, padding=1),
                          Conv2d(32, 32, kernel_size=3, stride=1, padding=1, residual=True),
                          Conv2d(32, 32, kernel_size=3, stride=1, padding=1, residual=True)),
            nn.Sequential(Conv2d(32, 64, kernel_size=3, stride=2, padding=1),
                          Conv2d(64, 64, kernel_size=3, stride=1, padding=1, residual=True),
                          Conv2d(64, 64, kernel_size=3, stride=1, padding=1, residual=True),
                          Conv2d(64, 64, kernel_size=3, stride=1, padding=1, residual=True)),
            nn.Sequential(Conv2d(64, 128, kernel_size=3, stride=2, padding=1),
                          Conv2d(128, 128, kernel_size=3, stride=1, padding=1, residual=True),
                          Conv2d(128, 128, kernel_size=3, stride=1, padding=1, residual=True)),
            nn.Sequential(Conv2d(128, 256, kernel_size=3, stride=2, padding=1),
                          Conv2d(256, 256, kernel_size=3, stride=1, padding=1, residual=True),
                          Conv2d(256, 256, kernel_size=3, stride=1, padding=1, residual=True)),
            nn.Sequential(Conv2d(256, 512, kernel_size=3, stride=2, padding=1),
                          Conv2d(512, 512, kernel_size=3, stride=1, padding=1, residual=True),
                          Conv2d(512, 512, kernel_size=3, stride=1, padding=1, residual=True)),
            nn.Sequential(Conv2d(512, 512, kernel_size=3, stride=1, padding=0),
                          Conv2d(512, 512, kernel_size=1, stride=1, padding=0)),
        ])

        self.audio_encoder = nn.Sequential(
            Conv2d(1, 32, kernel_size=3, stride=1, padding=1),
            Conv2d(32, 32, kernel_size=3, stride=1, padding=1, residual=True),
            Conv2d(32, 32, kernel_size=3, stride=1, padding=1, residual=True),
            Conv2d(32, 64, kernel_size=3, stride=(3, 1), padding=1),
            Conv2d(64, 64, kernel_size=3, stride=1, padding=1, residual=True),
            Conv2d(64, 64, kernel_size=3, stride=1, padding=1, residual=True),
            Conv2d(64, 128, kernel_size=3, stride=3, padding=1),
            Conv2d(128, 128, kernel_size=3, stride=1, padding=1, residual=True),
            Conv2d(128, 128, kernel_size=3, stride=1, padding=1, residual=True),
            Conv2d(128, 256, kernel_size=3, stride=(3, 2), padding=1),
            Conv2d(256, 256, kernel_size=3, stride=1, padding=1, residual=True),
            Conv2d(256, 256, kernel_size=3, stride=1, padding=1, residual=True),
            Conv2d(256, 512, kernel_size=3, stride=1, padding=0),
            Conv2d(512, 512, kernel_size=1, stride=1, padding=0),
        )

        self.face_decoder_blocks = nn.ModuleList([
            nn.Sequential(Conv2d(512, 512, kernel_size=1, stride=1, padding=0)),
            nn.Sequential(Conv2dTranspose(1024, 512, kernel_size=3, stride=1, padding=0),
                          Conv2d(512, 512, kernel_size=3, stride=1, padding=1, residual=True)),
            nn.Sequential(Conv2dTranspose(1024, 512, kernel_size=3, stride=2, padding=1, output_padding=1),
                          Conv2d(512, 512, kernel_size=3, stride=1, padding=1, residual=True),
                          Conv2d(512, 512, kernel_size=3, stride=1, padding=1, residual=True)),
            nn.Sequential(Conv2dTranspose(768, 384, kernel_size=3, stride=2, padding=1, output_padding=1),
                          Conv2d(384, 384, kernel_size=3, stride=1, padding=1, residual=True),
                          Conv2d(384, 384, kernel_size=3, stride=1, padding=1, residual=True)),
            nn.Sequential(Conv2dTranspose(512, 256, kernel_size=3, stride=2, padding=1, output_padding=1),
                          Conv2d(256, 256, kernel_size=3, stride=1, padding=1, residual=True),
                          Conv2d(256, 256, kernel_size=3, stride=1, padding=1, residual=True)),
            nn.Sequential(Conv2dTranspose(320, 128, kernel_size=3, stride=2, padding=1, output_padding=1),
                          Conv2d(128, 128, kernel_size=3, stride=1, padding=1, residual=True),
                          Conv2d(128, 128, kernel_size=3, stride=1, padding=1, residual=True)),
            nn.Sequential(Conv2dTranspose(160, 64, kernel_size=3, stride=2, padding=1, output_padding=1),
                          Conv2d(64, 64, kernel_size=3, stride=1, padding=1, residual=True),
                          Conv2d(64, 64, kernel_size=3, stride=1, padding=1, residual=True)),
        ])

        self.output_block = nn.Sequential(
            Conv2d(80, 32, kernel_size=3, stride=1, padding=1),
            nn.Conv2d(32, 3, kernel_size=1, stride=1, padding=0),
            nn.Sigmoid()
        )

    def forward(self, audio_sequences, face_sequences):
        audio_embedding = self.audio_encoder(audio_sequences)
        feats = []
        x = face_sequences
        for f in self.face_encoder_blocks:
            x = f(x)
            feats.append(x)

        x = audio_embedding
        for f in self.face_decoder_blocks:
            u = feats.pop()
            x = f(torch.cat([x, u], dim=1))

        x = self.output_block(torch.cat([x, feats.pop()], dim=1))
        return x


_wav2lip_model = None
_face_cascade = None

def get_face_detector():
    global _face_cascade
    if _face_cascade is None:
        _face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    return _face_cascade

def get_wav2lip_model():
    global _wav2lip_model
    if _wav2lip_model is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"
        print("[LipSync] Loading Wav2Lip weights from Hugging Face...")
        ckpt_path = None
        sources = [
            ("vinthony/SadTalker", "wav2lip.pth"),
            ("camenduru/Wav2Lip", "checkpoints/wav2lip.pth"),
            ("camenduru/Wav2Lip", "checkpoints/wav2lip_gan.pth"),
        ]
        for repo_id, filename in sources:
            try:
                ckpt_path = hf_hub_download(repo_id=repo_id, filename=filename)
                if ckpt_path and os.path.exists(ckpt_path):
                    print(f"[LipSync] Downloaded weights from {repo_id}/{filename}")
                    break
            except Exception as dl_err:
                print(f"[LipSync] Source {repo_id}/{filename} not available ({dl_err}), trying next...")

        if not ckpt_path or not os.path.exists(ckpt_path):
            raise RuntimeError("Could not retrieve Wav2Lip weights from any HuggingFace repository.")

        model = Wav2Lip().to(device)
        try:
            checkpoint = torch.load(ckpt_path, map_location=device, weights_only=False)
        except TypeError:
            checkpoint = torch.load(ckpt_path, map_location=device)

        state_dict = checkpoint["state_dict"] if "state_dict" in checkpoint else checkpoint
        new_s = {}
        for k, v in state_dict.items():
            new_s[k.replace("module.", "")] = v
        model.load_state_dict(new_s)
        model.eval()
        _wav2lip_model = model
        print("[LipSync] Wav2Lip model successfully loaded and active.")
    return _wav2lip_model


# ----------------- 3. Audio Mel-Spectrogram Processing -----------------
def audio_to_mel(wav_path: str):
    wav, sr = librosa.load(wav_path, sr=16000)
    mel = librosa.feature.melspectrogram(
        y=wav, sr=16000, n_fft=800, hop_length=200, n_mels=80, fmin=55, fmax=7600
    )
    mel = np.log(np.clip(mel, a_min=1e-5, a_max=None))
    return mel, len(wav) / 16000.0


# ----------------- 4. Lip Sync & Video Muxing -----------------
def lip_sync_video(video_path: str, audio_path: str, output_path: str):
    """Warps video mouth frames to synchronize with audio speech and muxes into output_path."""
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    device = "cuda" if torch.cuda.is_available() else "cpu"

    # Read generated video frames
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
    frames = []
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        frames.append(frame)
    cap.release()

    if not frames:
        raise ValueError("Video contains no frames")

    video_duration = len(frames) / float(fps)

    # Process audio spectrogram
    mel, audio_duration = audio_to_mel(audio_path)
    mel_step_size = 16
    mel_idx_mult = 80.0 / float(fps)

    # Scan early frames to locate face reliably
    detector = get_face_detector()
    face_box = None
    for f in frames[: min(15, len(frames))]:
        gray = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)
        detected = detector.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(50, 50))
        if len(detected) > 0:
            face_box = sorted(detected, key=lambda d: d[2] * d[3], reverse=True)[0]
            break

    # If no face is found (e.g. landscape, drone shot, or back turned), cleanly mux audio directly
    if face_box is None:
        print("[LipSync] No frontal face detected. Muxing speech dialogue directly into video.")
        subprocess.run([
            ffmpeg_exe, "-y", "-i", video_path, "-i", audio_path,
            "-filter_complex", f"[1:a]apad=pad_dur={max(0.1, video_duration)}[a]",
            "-map", "0:v:0", "-map", "[a]",
            "-c:v", "copy", "-c:a", "aac",
            "-t", str(video_duration),
            output_path
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        return

    # Expand box slightly to include full chin, jaw, and mouth
    x, y, w, h = face_box
    frame_h, frame_w = frames[0].shape[:2]
    y2 = min(frame_h, int(y + h * 1.15))
    y1 = max(0, int(y - h * 0.1))
    x1 = max(0, int(x - w * 0.1))
    x2 = min(frame_w, int(x + w * 1.1))

    try:
        model = get_wav2lip_model()
        synced_frames = []

        for i, frame in enumerate(frames):
            frame_time = i / float(fps)
            # If character has completed speaking their dialogue, preserve natural video frames
            if frame_time >= audio_duration:
                synced_frames.append(frame.copy())
                continue

            # Mel window corresponding to this frame
            m_start = int(i * mel_idx_mult)
            if m_start + mel_step_size > mel.shape[1]:
                m_start = max(0, mel.shape[1] - mel_step_size)
            m_chunk = mel[:, m_start : m_start + mel_step_size]

            if m_chunk.shape[1] < mel_step_size:
                pad_width = mel_step_size - m_chunk.shape[1]
                m_chunk = np.pad(m_chunk, ((0, 0), (0, pad_width)), mode="constant")

            # Crop and prepare character face
            face_crop = frame[y1:y2, x1:x2]
            fc_h, fc_w = face_crop.shape[:2]
            if fc_h < 10 or fc_w < 10:
                synced_frames.append(frame.copy())
                continue

            face_resized = cv2.resize(face_crop, (96, 96))

            # Mask mouth region (bottom half of 96x96 face crop)
            masked_face = face_resized.copy()
            masked_face[48:, :] = 0

            # 6-channel input [masked_face, full_face]
            concat_face = np.concatenate([masked_face, face_resized], axis=2) / 255.0
            face_tensor = torch.FloatTensor(concat_face).permute(2, 0, 1).unsqueeze(0).to(device)
            mel_tensor = torch.FloatTensor(m_chunk).unsqueeze(0).unsqueeze(0).to(device)

            with torch.no_grad():
                pred = model(mel_tensor, face_tensor)
                pred = pred.squeeze(0).permute(1, 2, 0).cpu().numpy() * 255.0
                pred = np.clip(pred, 0, 255).astype(np.uint8)

            # Resize predicted mouth and blend back with smooth Gaussian feathered mask
            pred_resized = cv2.resize(pred, (fc_w, fc_h))
            mask = np.zeros((fc_h, fc_w), dtype=np.float32)
            mask[int(fc_h * 0.45):, :] = 1.0
            mask = cv2.GaussianBlur(mask, (15, 15), 5)
            mask = mask[:, :, np.newaxis]

            blended_crop = (pred_resized * mask + face_crop * (1.0 - mask)).astype(np.uint8)
            frame_copy = frame.copy()
            frame_copy[y1:y2, x1:x2] = blended_crop
            synced_frames.append(frame_copy)

        # Write synced frames to temporary silent video
        fd, temp_synced = tempfile.mkstemp(suffix=".mp4")
        os.close(fd)
        writer = cv2.VideoWriter(temp_synced, cv2.VideoWriter_fourcc(*"mp4v"), fps, (frame_w, frame_h))
        for sf in synced_frames:
            writer.write(sf)
        writer.release()

        # Mux dialogue speech audio with lip-synced video, padding silence if needed
        subprocess.run([
            ffmpeg_exe, "-y",
            "-i", temp_synced,
            "-i", audio_path,
            "-filter_complex", f"[1:a]apad=pad_dur={max(0.1, video_duration)}[a]",
            "-map", "0:v:0",
            "-map", "[a]",
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-t", str(video_duration),
            output_path
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

        if os.path.exists(temp_synced):
            os.remove(temp_synced)
        print("[LipSync] Neural Wav2Lip sync and audio muxing completed successfully.")

    except Exception as e:
        print(f"[LipSync WARN] Lip sync fallback: {e}. Muxing original audio directly.")
        subprocess.run([
            ffmpeg_exe, "-y", "-i", video_path, "-i", audio_path,
            "-filter_complex", f"[1:a]apad=pad_dur={max(0.1, video_duration)}[a]",
            "-map", "0:v:0", "-map", "[a]",
            "-c:v", "copy", "-c:a", "aac",
            "-t", str(video_duration),
            output_path
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
