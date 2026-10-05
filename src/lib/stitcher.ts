/**
 * Client-side video stitcher.
 * Concatenates multiple scene MP4 clips into a single continuous video file
 * using HTML5 Canvas & MediaRecorder. Enables creators to download their full
 * episodic story in one file ready for TikTok, Instagram Reels, or YouTube Shorts.
 */

export async function stitchAndDownloadVideo(
  clips: string[],
  title = "reelforge-episode",
  onProgress?: (progressPercent: number) => void
): Promise<void> {
  if (!clips || clips.length === 0) {
    throw new Error("No clips to stitch");
  }

  // If there's only 1 clip, download directly
  if (clips.length === 1) {
    const res = await fetch(clips[0]);
    const blob = await res.blob();
    downloadBlob(blob, `${title}.mp4`);
    onProgress?.(100);
    return;
  }

  onProgress?.(5);

  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 1280;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not initialize 2D canvas");

  const stream = canvas.captureStream(30);

  // Pick supported mime type
  const mimeType = MediaRecorder.isTypeSupported("video/mp4")
    ? "video/mp4"
    : MediaRecorder.isTypeSupported("video/webm;codecs=h264")
    ? "video/webm;codecs=h264"
    : "video/webm";

  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 4_000_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const recordingFinished = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: mimeType }));
    };
  });

  recorder.start(100);

  const hiddenVideo = document.createElement("video");
  hiddenVideo.muted = true;
  hiddenVideo.crossOrigin = "anonymous";
  hiddenVideo.playsInline = true;

  try {
    for (let idx = 0; idx < clips.length; idx++) {
      const clipUrl = clips[idx];
      onProgress?.(Math.round(((idx) / clips.length) * 90) + 5);

      await new Promise<void>((resolve, reject) => {
        hiddenVideo.src = clipUrl;
        hiddenVideo.onloadedmetadata = () => {
          hiddenVideo.play().catch(reject);
        };

        const drawLoop = () => {
          if (hiddenVideo.paused || hiddenVideo.ended) return;
          // Maintain aspect ratio with cover fit
          const hRatio = canvas.width / hiddenVideo.videoWidth;
          const vRatio = canvas.height / hiddenVideo.videoHeight;
          const ratio = Math.max(hRatio, vRatio);
          const centerShiftX = (canvas.width - hiddenVideo.videoWidth * ratio) / 2;
          const centerShiftY = (canvas.height - hiddenVideo.videoHeight * ratio) / 2;

          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(
            hiddenVideo,
            0,
            0,
            hiddenVideo.videoWidth,
            hiddenVideo.videoHeight,
            centerShiftX,
            centerShiftY,
            hiddenVideo.videoWidth * ratio,
            hiddenVideo.videoHeight * ratio
          );

          if (!hiddenVideo.ended) {
            requestAnimationFrame(drawLoop);
          }
        };

        hiddenVideo.onplay = () => {
          requestAnimationFrame(drawLoop);
        };

        hiddenVideo.onended = () => {
          resolve();
        };

        hiddenVideo.onerror = (e) => {
          reject(new Error(`Failed to load clip ${idx + 1}`));
        };
      });
    }

    onProgress?.(95);
    recorder.stop();
    const finalBlob = await recordingFinished;
    const ext = mimeType.includes("mp4") ? "mp4" : "webm";
    downloadBlob(finalBlob, `${title.replace(/[^a-zA-Z0-9_\-]+/g, "_")}.${ext}`);
    onProgress?.(100);
  } finally {
    hiddenVideo.src = "";
    hiddenVideo.remove();
    canvas.remove();
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
