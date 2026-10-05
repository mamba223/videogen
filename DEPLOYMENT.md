# ReelForge Production Deployment Guide

This guide walks you through deploying **ReelForge** to production across Vercel, Supabase, GPU infrastructure, and mobile app stores.

---

## 1. Supabase Backend Setup

### A. Create Project
1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Under **Project Settings > API**, note your:
   - `Project URL`
   - `anon public` key
   - `service_role` key (keep secret!)

### B. Run Database Schema
1. Open the Supabase dashboard **SQL Editor**.
2. Copy and paste the entire contents of [`supabase/schema.sql`](file:///c:/Users/masiko/Downloads/Video_gen/reelforge/supabase/schema.sql).
3. Click **Run**. This provisions all tables, Row Level Security (RLS) policies, indexes, and queue functions:
   - `profiles`, `videos`, `scenes`, `series`, `story_assets`, `likes`, `comments`, `follows`, `reports`, `credit_ledger`
   - `claim_scenes`, `complete_scene`, `fail_scene`, `spend_credits`

### C. Create Storage Buckets
1. In the Supabase dashboard, go to **Storage**.
2. Create two buckets:
   - `clips` (**Public** bucket: stores rendered MP4 scenes).
   - `story-assets` (**Private** bucket: stores uploaded PDF/DOCX scripts and character reference images).

---

## 2. Deploy Web App to Vercel

1. Push your repository to GitHub or GitLab.
2. In [Vercel](https://vercel.com), click **Add New > Project** and import the `reelforge` directory.
3. Configure the **Environment Variables** in Vercel:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# LLM Script Decomposition (Pick one)
GROQ_API_KEY=gsk_...
# or OPENROUTER_API_KEY=sk-or-v1-...
# or OPENAI_API_KEY=sk-...

# Voiceover / Narration (Optional)
ELEVENLABS_API_KEY=your-elevenlabs-key
# or OPENAI_API_KEY=sk-...

# Stripe Monetization (Optional)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```
4. Click **Deploy**. Vercel will build and assign your production domain.

---

## 3. Stripe Webhook Configuration

1. In the [Stripe Dashboard](https://dashboard.stripe.com), go to **Developers > Webhooks**.
2. Add an endpoint: `https://your-domain.com/api/stripe/webhook`.
3. Select event: `checkout.session.completed`.
4. Copy the **Signing secret** into your Vercel environment variables as `STRIPE_WEBHOOK_SECRET`.

---

## 4. Run the GPU Worker Queue

The GPU worker claims pending scene jobs from Supabase, generates video clips, and uploads them to the `clips` bucket.

### Option A: RunPod Serverless (Pay-per-second, zero idle cost)
1. Deploy `gpu-server/Dockerfile` to RunPod Serverless with an NVIDIA RTX 4090 / A100 GPU.
2. Set RunPod template environment variables:
   - Handler: `runpod_handler.handler`
3. In `worker/.env`:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   GPU_PROVIDER=runpod
   RUNPOD_ENDPOINT_ID=your-endpoint-id
   RUNPOD_API_KEY=your-runpod-key
   ```
4. Start worker daemon:
   ```bash
   cd worker
   npm install
   node index.mjs
   ```

### Option B: Vast.ai or Dedicated Cloud GPU (Lowest cost per hour)
1. Rent an RTX 3090 / 4090 instance on [Vast.ai](https://vast.ai) or RunPod Secure Cloud.
2. Run `gpu-server/server.py`:
   ```bash
   cd gpu-server
   pip install -r requirements.txt
   uvicorn server:app --host 0.0.0.0 --port 8000
   ```
3. In `worker/.env`:
   ```env
   GPU_PROVIDER=http
   GPU_ENDPOINT_URL=http://your-gpu-ip:8000
   GPU_API_KEY=your-secret-api-key
   ```

---

## 5. Dual-Speed Generation Engine: Speed vs. Quality

ReelForge provides a clean, 2-tier engine design balancing rapid idea exploration with Hollywood-grade cinematic releases:

| Engine Mode | Model & Checkpoint | Generation Speed | Native FPS | Best For |
| :--- | :--- | :---: | :---: | :--- |
| **🌟 Cinematic Flagship** | `Wan-AI/Wan2.1-T2V-1.3B` / `14B` | **~25–35 sec** | 16 FPS | Final releases, character consistency, series bibles, photorealism |
| **⚡ Turbo Draft** | `Lightricks/LTX-Video` | **~10–15 sec** | 24 FPS | Fast idea testing, prompt iterations, and quick story drafts |

- **Creator Control**: Creators toggle between **Cinematic Quality** and **Turbo Speed** directly with one click in the Studio (`/create`).
- **GPU Deployment**: The worker and GPU pipeline (`gpu-server/inference.py`) automatically route jobs based on the selected mode.

---

## 6. Build and Publish the Mobile App (Expo)

```bash
cd mobile
npm install

# Build for iOS (Apple App Store / TestFlight)
npx eas-cli build -p ios

# Build for Android (Google Play Store / APK)
npx eas-cli build -p android
```

---

## 7. Pre-Flight Verification

Run the automated verification script before launching:
```bash
node scripts/verify-production.mjs
```
